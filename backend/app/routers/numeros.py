"""Tenant-scoped number management and safe Uazapi connection lifecycle."""
from __future__ import annotations

import re
import uuid
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import require_tenant_role
from app.models.numero import NumeroBot
from app.models.tenant import Cliente
from app.models.user import User, UserRole
from app.schemas.numero import NumeroBotCreate, NumeroBotOut, NumeroBotUpdate, UazapiStatusOut
from app.services.connection_credentials import CredentialError, DuplicateCredentialError, get_connection_token, save_connection_credentials
from app.services.connection_backfill import schedule_backfill
from app.services.connection_sync import reconcile_remote_webhook
from app.services.uazapi import UazapiError, uazapi

router = APIRouter(prefix="/tenants", tags=["numeros"])


def _phone_matches(numero: NumeroBot, phone: str | None) -> bool | None:
    if not phone:
        return None
    return re.sub(r"\D", "", numero.numero) == re.sub(r"\D", "", phone)


async def _numero_for_update(db: AsyncSession, cliente_id: UUID, numero_id: UUID) -> NumeroBot:
    numero = (await db.execute(select(NumeroBot).where(NumeroBot.id == numero_id, NumeroBot.cliente_id == cliente_id).with_for_update())).scalar_one_or_none()
    if not numero:
        raise HTTPException(404, "Número não encontrado")
    return numero


async def _require_active_tenant(db: AsyncSession, cliente_id: UUID) -> None:
    if not await db.scalar(select(Cliente.ativo).where(Cliente.id == cliente_id)):
        raise HTTPException(403, "Tenant inativo")


async def _ensure_x9_webhook(numero: NumeroBot, token: str) -> None:
    """Always reconcile remotely; never delete or replace third-party destinations."""
    try:
        await reconcile_remote_webhook(numero)
    except UazapiError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc
    except CredentialError as exc:
        raise HTTPException(503, "Credencial Uazapi indisponível") from exc


def _status_out(numero: NumeroBot, data: dict, remote_state: str | None = None) -> UazapiStatusOut:
    state = remote_state or uazapi.extract_status(data)
    phone = uazapi.extract_phone(data)
    return UazapiStatusOut(status=state if state in {"connected", "connecting", "disconnected"} else "disconnected", qr_code=uazapi.extract_qr(data), pairing_code=data.get("pairingCode") or data.get("pairing_code"), phone=phone, phone_matches_registered=_phone_matches(numero, phone), sync_enabled=numero.sync_enabled, sync_state=numero.sync_state)


@router.get("/{cliente_id}/numeros", response_model=List[NumeroBotOut])
async def list_numeros(cliente_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_tenant_role(UserRole.viewer, UserRole.manager, UserRole.admin))):
    return (await db.execute(select(NumeroBot).where(NumeroBot.cliente_id == cliente_id).order_by(NumeroBot.created_at))).scalars().all()


@router.post("/{cliente_id}/numeros", response_model=NumeroBotOut, status_code=201)
async def create_numero(cliente_id: UUID, body: NumeroBotCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_tenant_role(UserRole.admin, UserRole.manager))):
    if await db.scalar(select(NumeroBot.id).where(NumeroBot.cliente_id == cliente_id, NumeroBot.numero == body.numero)):
        raise HTTPException(400, "Número já cadastrado para este cliente")
    numero = NumeroBot(cliente_id=cliente_id, numero=body.numero, nome=body.nome, sync_enabled=True, analysis_enabled=True, sync_state="pending_connection")
    db.add(numero)
    await db.flush()
    await db.refresh(numero)
    return numero


@router.patch("/{cliente_id}/numeros/{numero_id}", response_model=NumeroBotOut)
async def update_numero(cliente_id: UUID, numero_id: UUID, body: NumeroBotUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_tenant_role(UserRole.admin, UserRole.manager))):
    numero = await _numero_for_update(db, cliente_id, numero_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(numero, field, value)
    if body.ativo is False:
        # Revokes queued/callback analysis work bound to this connection.
        numero.sync_enabled = False
        numero.analysis_enabled = False
        numero.connection_generation = uuid.uuid4()
        numero.sync_state = "disabled"
    await db.flush()
    await db.refresh(numero)
    return numero


@router.delete("/{cliente_id}/numeros/{numero_id}", status_code=204)
async def delete_numero(cliente_id: UUID, numero_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_tenant_role(UserRole.admin))):
    await db.delete(await _numero_for_update(db, cliente_id, numero_id))


@router.post("/{cliente_id}/numeros/{numero_id}/connect", response_model=UazapiStatusOut)
async def connect_numero(cliente_id: UUID, numero_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_tenant_role(UserRole.admin, UserRole.manager))):
    """Serialize provisioning per number; never rotate/recreate an existing credential."""
    await _require_active_tenant(db, cliente_id)
    numero = await _numero_for_update(db, cliente_id, numero_id)
    if not numero.sync_enabled:
        # Explicit administrator action re-enables a previously disconnected
        # connection and invalidates prior queued analysis authority.
        numero.sync_enabled = True
        numero.analysis_enabled = True
        numero.connection_generation = uuid.uuid4()
    try:
        token = get_connection_token(numero)
    except CredentialError as exc:
        # An encrypted binding that cannot be read is a configuration incident,
        # not evidence that a new remote instance should be created.
        if numero.token_encrypted or numero.token_digest or numero.provider_instance_id:
            raise HTTPException(503, "Credencial Uazapi indisponível") from exc
        name = f"x9_{str(numero.id).replace('-', '')[:16]}"
        try:
            created = await uazapi.create_instance(name)
        except UazapiError as exc:
            raise HTTPException(exc.status_code, exc.message) from exc
        instance = created.get("instance") if isinstance(created.get("instance"), dict) else {}
        token, provider_id = created.get("token") or instance.get("token"), instance.get("name") or instance.get("id") or name
        if not isinstance(token, str) or not token or not isinstance(provider_id, str):
            raise HTTPException(502, "Uazapi não retornou uma credencial válida")
        try:
            await save_connection_credentials(db, numero, provider_instance_id=provider_id, token=token)
        except DuplicateCredentialError as exc:
            raise HTTPException(409, "Credencial Uazapi já vinculada") from exc
        except CredentialError as exc:
            raise HTTPException(503, "Credencial Uazapi indisponível") from exc
    try:
        await _ensure_x9_webhook(numero, token)
        data = await uazapi.connect(token, history_days=getattr(settings, "UAZAPI_HISTORY_DAYS", 7))
    except UazapiError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc
    numero.sync_state = "connecting"
    await db.flush()
    return _status_out(numero, data, "connecting")


@router.get("/{cliente_id}/numeros/{numero_id}/status", response_model=UazapiStatusOut)
async def get_numero_status(cliente_id: UUID, numero_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_tenant_role(UserRole.viewer, UserRole.manager, UserRole.admin))):
    numero = await _numero_for_update(db, cliente_id, numero_id)
    try:
        token = get_connection_token(numero)
    except CredentialError:
        return UazapiStatusOut(status="disconnected", sync_enabled=numero.sync_enabled, sync_state=numero.sync_state)
    try:
        data = await uazapi.get_status(token)
    except UazapiError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc
    # Status tracking intentionally never changes the business `ativo` flag.
    # It does verify pairing and retains a durable ready state across polling.
    remote_state = uazapi.extract_status(data)
    phone_matches = _phone_matches(numero, uazapi.extract_phone(data))
    if remote_state == "connected" and phone_matches is True:
        # Polling is read-only for legacy connections; it never opts a tenant
        # into ingestion/analysis that was disabled by migration or an admin.
        numero.sync_state = "sync_enabled" if numero.sync_enabled else "connected_unmanaged"
    elif remote_state == "connected" and phone_matches is False:
        numero.sync_enabled = False
        numero.analysis_enabled = False
        numero.connection_generation = uuid.uuid4()
        numero.sync_state = "connection_mismatch"
    elif remote_state == "connected":
        numero.sync_state = "connection_unverified"
    else:
        # Polling observes transient provider state; it does not revoke the
        # tenant's explicit intent or queued work.
        numero.sync_state = remote_state
    await db.flush()
    result = _status_out(numero, data, remote_state)
    if getattr(current_user, "role", None) == UserRole.viewer:
        result.qr_code = None
        result.pairing_code = None
    return result


@router.post("/{cliente_id}/numeros/{numero_id}/sync", response_model=UazapiStatusOut)
async def sync_numero(cliente_id: UUID, numero_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_tenant_role(UserRole.admin, UserRole.manager))):
    await _require_active_tenant(db, cliente_id)
    numero = await _numero_for_update(db, cliente_id, numero_id)
    try:
        token = get_connection_token(numero)
        data = await uazapi.get_status(token)
    except CredentialError as exc:
        raise HTTPException(409, "Instância Uazapi ainda não configurada") from exc
    except UazapiError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc
    state, phone = uazapi.extract_status(data), uazapi.extract_phone(data)
    if state != "connected":
        numero.sync_state = "pending_connection"
        await db.commit()
        raise HTTPException(409, "Conecte o WhatsApp antes de habilitar a sincronização")
    if _phone_matches(numero, phone) is not True:
        numero.sync_state = "connection_mismatch"
        numero.sync_enabled = False
        numero.analysis_enabled = False
        numero.connection_generation = uuid.uuid4()
        await db.commit()
        raise HTTPException(409, "O telefone conectado não corresponde ao número cadastrado")
    await _ensure_x9_webhook(numero, token)
    numero.sync_enabled, numero.analysis_enabled, numero.sync_state = True, True, "sync_enabled"
    schedule_backfill(numero)
    await db.flush()
    return _status_out(numero, data, state)


@router.post("/{cliente_id}/numeros/{numero_id}/disconnect", response_model=UazapiStatusOut)
async def disconnect_numero(cliente_id: UUID, numero_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_tenant_role(UserRole.admin, UserRole.manager))):
    numero = await _numero_for_update(db, cliente_id, numero_id)
    try:
        token = get_connection_token(numero)
    except CredentialError:
        return UazapiStatusOut(status="disconnected", sync_enabled=numero.sync_enabled, sync_state=numero.sync_state)
    try:
        await uazapi.disconnect(token)
    except UazapiError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc
    # A disconnected number must invalidate all pending job/callback authority.
    numero.sync_enabled, numero.analysis_enabled = False, False
    numero.connection_generation = uuid.uuid4()
    numero.sync_state = "disconnected"
    await db.flush()
    return UazapiStatusOut(status="disconnected", sync_enabled=False, sync_state=numero.sync_state)
