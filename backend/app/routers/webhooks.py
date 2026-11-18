"""Authenticated Uazapi callback endpoint."""
from __future__ import annotations

import hmac
import json
import logging
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.numero import NumeroBot
from app.models.tenant import Cliente
from app.services.connection_credentials import token_digest
from app.services.uazapi_webhook import UazapiPayloadError, process_uazapi_event, validate_event_shape

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])
MAX_WEBHOOK_BYTES = 5 * 1024 * 1024


def _digits(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    digits = re.sub(r"\D", "", value.split("@", 1)[0])
    return digits or None


def _payload_identity_matches(numero: NumeroBot, payload: dict[str, Any]) -> bool:
    """A token-valid payload must not contradict its bound instance or owner."""
    instance = payload.get("instance")
    claimed_instance = payload.get("instanceName") or payload.get("instance_id")
    owner = payload.get("owner")
    if isinstance(instance, dict):
        claimed_instance = claimed_instance or instance.get("name") or instance.get("id")
        owner = owner or instance.get("owner")
    elif isinstance(instance, str):
        claimed_instance = claimed_instance or instance
    if claimed_instance is not None:
        if not isinstance(claimed_instance, str) or not numero.provider_instance_id:
            return False
        if not hmac.compare_digest(numero.provider_instance_id, claimed_instance):
            return False
    if owner is not None:
        registered, claimed_owner = _digits(numero.numero), _digits(owner)
        if not registered or not claimed_owner or not hmac.compare_digest(registered, claimed_owner):
            return False
    return True


@router.post("/uazapi", status_code=status.HTTP_200_OK)
async def receive_uazapi_webhook(request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit() and int(content_length) > MAX_WEBHOOK_BYTES:
        raise HTTPException(status_code=413, detail="Webhook muito grande")
    raw = await request.body()
    if len(raw) > MAX_WEBHOOK_BYTES:
        raise HTTPException(status_code=413, detail="Webhook muito grande")
    try:
        payload = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail="JSON inválido") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Payload inválido")
    token = payload.get("token")
    if not isinstance(token, str) or not token:
        raise HTTPException(status_code=401, detail="Instância não autenticada")
    candidates = (await db.execute(
        select(NumeroBot)
        .where(NumeroBot.token_digest == token_digest(token))
        .with_for_update()
        .limit(2)
    )).scalars().all()
    if len(candidates) != 1:
        logger.warning("uazapi_webhook_rejected", extra={"reason": "credential_lookup"})
        raise HTTPException(status_code=401, detail="Instância não autenticada")
    numero = candidates[0]
    if not await db.scalar(select(Cliente.ativo).where(Cliente.id == numero.cliente_id)):
        raise HTTPException(status_code=403, detail="Tenant inativo")
    if not numero.ativo:
        raise HTTPException(status_code=403, detail="Sincronização não habilitada")
    if not _payload_identity_matches(numero, payload):
        logger.warning("uazapi_webhook_rejected", extra={"reason": "identity_mismatch", "numero_id": str(numero.id)})
        raise HTTPException(status_code=401, detail="Instância não autenticada")
    # A token alone does not prove the WhatsApp account paired to it belongs to
    # this tenant. Connection status must verify the registered phone first.
    if payload.get("EventType") != "connection" and (
        not numero.sync_enabled or numero.sync_state not in {"sync_enabled", "receiving"}
    ):
        raise HTTPException(status_code=403, detail="Conexão ainda não verificada")
    try:
        validate_event_shape(payload)
        # The lookup above already starts SQLAlchemy's transaction.  Explicit
        # commit here guarantees a successful ACK is never sent before the
        # message and its analysis outbox are durable.
        accepted = await process_uazapi_event(db, numero, payload)
        await db.commit()
    except UazapiPayloadError as exc:
        await db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        await db.rollback()
        # Provider content can surface in database/HTTP exception traces; do
        # not render a traceback or exception message into application logs.
        logger.error("uazapi_webhook_processing_failed", extra={"numero_id": str(numero.id), "exception_type": type(exc).__name__})
        raise HTTPException(status_code=500, detail="Falha ao processar evento") from exc
    return {"received": True, "accepted": accepted}
