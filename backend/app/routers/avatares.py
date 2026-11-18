"""
/avatares — sincronização de fotos de perfil do WhatsApp pra leads e grupos.

Quem pode usar: superadmin OU usuário com is_manager_multi=true E
UserTenant.role=admin ATIVO na empresa-alvo (require_admin_in_tenant).

Endpoints:
  POST /avatares/{cliente_id}/{tipo}/sync           — IDs específicos no body
  POST /avatares/{cliente_id}/{tipo}/sync-pendentes — primeiros N sem foto

`tipo`: "leads" ou "grupos".
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_admin_in_tenant
from app.models.user import User
from app.schemas.avatares import (
    SyncBatchBody,
    SyncPendingBody,
    SyncResponse,
    EntidadeTipo,
)
from app.services import avatar_service

router = APIRouter(prefix="/avatares", tags=["avatares"])


def _validar_tipo(tipo: str) -> EntidadeTipo:
    if tipo not in ("leads", "grupos"):
        raise HTTPException(
            status_code=400, detail="tipo deve ser 'leads' ou 'grupos'"
        )
    return tipo  # type: ignore[return-value]


@router.post(
    "/{cliente_id}/{tipo}/sync",
    response_model=SyncResponse,
)
async def sync_batch(
    cliente_id: UUID,
    tipo: str,
    body: SyncBatchBody,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_in_tenant()),
):
    """Sincroniza fotos de até 30 entidades específicas (por IDs)."""
    tipo_v = _validar_tipo(tipo)
    return await avatar_service.sync_batch(
        db=db,
        cliente_id=cliente_id,
        tipo=tipo_v,
        ids=body.ids,
        force=body.force,
    )


@router.post(
    "/{cliente_id}/{tipo}/sync-pendentes",
    response_model=SyncResponse,
)
async def sync_pendentes(
    cliente_id: UUID,
    tipo: str,
    body: SyncPendingBody,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_in_tenant()),
):
    """
    Pega os primeiros N registros do tenant SEM foto_url e sincroniza.
    Ideal pro botão "Sincronizar fotos" do admin — não precisa selecionar
    IDs, só rodar.
    """
    tipo_v = _validar_tipo(tipo)
    return await avatar_service.sync_all_pending(
        db=db,
        cliente_id=cliente_id,
        tipo=tipo_v,
        limit=body.limit,
    )
