from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_user_tenant_access
from app.models.user import User
from app.schemas.notificacao import NotificacaoOut
from app.services.notificacao_service import get_notificacoes

router = APIRouter(prefix="/notificacoes", tags=["notificacoes"])


@router.get("/{cliente_id}", response_model=List[NotificacaoOut])
async def listar_notificacoes(
    cliente_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """
    Retorna notificações computadas para o tenant.
    Cache Redis de 25s absorve polls consecutivos sem sobrecarregar o banco.
    """
    return await get_notificacoes(UUID(cliente_id), db)
