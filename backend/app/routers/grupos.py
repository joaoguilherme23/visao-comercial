"""
Router de Grupos — endpoints REST restritos a admin/superadmin.

3 endpoints:
    GET /grupos/{cliente_id}
    GET /grupos/{cliente_id}/{grupo_id}/mensagens
    GET /grupos/{cliente_id}/{grupo_id}/participantes

Permissionamento:
- get_user_tenant_access garante que o usuário tem vínculo ativo com o tenant
  (ou é superadmin, retornando None).
- Check inline adicional: superadmin bypassa; caso contrário, role precisa ser
  UserRole.admin. Qualquer outra role => 403.

Tenant isolation:
- Listagem: filtro por cliente_id na query.
- Mensagens/Participantes: validação prévia de que grupo_id pertence ao cliente_id
  antes de consultar as mensagens (evita enumeration entre tenants).
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_user_tenant_access
from app.models.user import User, UserRole, UserTenant
from app.schemas.grupos import (
    GrupoListItemOut,
    GrupoMensagensPageOut,
    GrupoParticipantesOut,
)
from app.services.grupos_service import (
    _verificar_grupo_pertence,
    listar_grupos,
    listar_mensagens,
    listar_participantes,
)

router = APIRouter(prefix="/grupos", tags=["grupos"])


def _require_admin_or_superadmin(
    current_user: User,
    tenant_access: Optional[UserTenant],
) -> None:
    """
    Exige role admin (ou superadmin).

    - Superadmin: get_user_tenant_access retorna None => bypass.
    - Usuário comum: tenant_access é UserTenant e role deve ser admin.
    """
    if current_user.is_superadmin:
        return
    if tenant_access is None or tenant_access.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores do tenant",
        )


@router.get("/{cliente_id}", response_model=list[GrupoListItemOut])
async def listar_grupos_endpoint(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_access: Optional[UserTenant] = Depends(get_user_tenant_access),
) -> list[GrupoListItemOut]:
    """Lista todos os grupos do tenant (inclui grupos cuja última msg é do bot)."""
    _require_admin_or_superadmin(current_user, tenant_access)
    return await listar_grupos(session=db, cliente_id=cliente_id)


@router.get(
    "/{cliente_id}/{grupo_id}/mensagens",
    response_model=GrupoMensagensPageOut,
)
async def listar_mensagens_endpoint(
    cliente_id: UUID,
    grupo_id: UUID,
    limit: int = Query(50, ge=1, le=200, description="Máx mensagens por página (1-200)."),
    offset: int = Query(0, ge=0, description="Offset de paginação."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_access: Optional[UserTenant] = Depends(get_user_tenant_access),
) -> GrupoMensagensPageOut:
    """
    Retorna mensagens paginadas de um grupo.

    Mensagens do bot (X9/AIA) são excluídas via filtro por participant_name.
    """
    _require_admin_or_superadmin(current_user, tenant_access)

    if not await _verificar_grupo_pertence(db, grupo_id, cliente_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo não encontrado neste tenant",
        )

    return await listar_mensagens(
        session=db,
        cliente_id=cliente_id,
        grupo_id=grupo_id,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{cliente_id}/{grupo_id}/participantes",
    response_model=GrupoParticipantesOut,
)
async def listar_participantes_endpoint(
    cliente_id: UUID,
    grupo_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_access: Optional[UserTenant] = Depends(get_user_tenant_access),
) -> GrupoParticipantesOut:
    """
    Lista participantes agregados de um grupo.

    Participantes do bot (X9/AIA) são excluídos via filtro por participant_name.
    """
    _require_admin_or_superadmin(current_user, tenant_access)

    if not await _verificar_grupo_pertence(db, grupo_id, cliente_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo não encontrado neste tenant",
        )

    return await listar_participantes(
        session=db,
        cliente_id=cliente_id,
        grupo_id=grupo_id,
    )
