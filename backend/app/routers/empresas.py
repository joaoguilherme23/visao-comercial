"""
/empresas/{cliente_id}/consultores — gestão de equipe de uma empresa.

Quem pode usar: superadmin OU usuário com is_manager_multi=true E
UserTenant.role=admin ATIVO na empresa-alvo (require_admin_in_tenant).

Endpoints:
  GET    /empresas/{cliente_id}/consultores         lista
  POST   /empresas/{cliente_id}/consultores         cria novo (User + UserTenant)
  POST   /empresas/{cliente_id}/consultores/atribuir-existente  atribui user já existente
  PATCH  /empresas/{cliente_id}/consultores/{ut_id}/role        muda role
  DELETE /empresas/{cliente_id}/consultores/{ut_id}             remove acesso (soft)
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin_in_tenant
from app.models.user import User
from app.services import email_service
from app.schemas.user import (
    ConsultorOut,
    CreateConsultorBody,
    AttachConsultorExistingBody,
    UpdateConsultorRoleBody,
    EmailConflictOut,
)
from app.services import empresa_service
from app.services.empresa_service import (
    EmailConflictError,
    AlreadyAssignedError,
)

router = APIRouter(prefix="/empresas", tags=["empresas"])


@router.get(
    "/{cliente_id}/consultores",
    response_model=list[ConsultorOut],
)
async def listar_consultores(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_in_tenant()),
):
    """Lista os consultores ATIVOS vinculados à empresa."""
    return await empresa_service.listar_consultores(db, cliente_id)


@router.post(
    "/{cliente_id}/consultores",
    response_model=ConsultorOut,
    status_code=201,
    responses={
        409: {
            "model": EmailConflictOut,
            "description": "Email já existe no sistema. Use /atribuir-existente.",
        }
    },
)
async def criar_consultor(
    cliente_id: UUID,
    body: CreateConsultorBody,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_in_tenant()),
):
    """
    Cria um Consultor novo + atribui à empresa.
    Usuário não recebe senha — email de convite é disparado automaticamente.

    Se email já existir, retorna 409 com `existing_user_id` —
    caller deve oferecer fluxo "atribuir existente" ou trocar de email.
    """
    try:
        user, ut = await empresa_service.criar_consultor(
            db=db,
            cliente_id=cliente_id,
            email=body.email,
            nome=body.nome,
        )
    except EmailConflictError as e:
        raise HTTPException(
            status_code=409,
            detail={
                "detail": "email_exists",
                "existing_user_id": str(e.existing_user.id),
                "existing_user_nome": e.existing_user.nome,
            },
        )
    background_tasks.add_task(email_service.send_invite, user.nome, user.email, user.reset_token)
    return {
        "user_id": user.id,
        "email": user.email,
        "nome": user.nome,
        "role": ut.role,
        "is_active": user.is_active,
        "must_change_password": user.must_change_password,
        "user_tenant_id": ut.id,
        "created_at": ut.created_at,
    }


@router.post(
    "/{cliente_id}/consultores/atribuir-existente",
    response_model=ConsultorOut,
    status_code=201,
)
async def atribuir_existente(
    cliente_id: UUID,
    body: AttachConsultorExistingBody,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_in_tenant()),
):
    """Atribui um usuário existente à empresa como consultor."""
    try:
        ut = await empresa_service.atribuir_existente(
            db=db,
            cliente_id=cliente_id,
            user_id=body.user_id,
        )
    except AlreadyAssignedError:
        raise HTTPException(status_code=409, detail="Usuário já vinculado a esta empresa")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Carrega user pra montar response
    from sqlalchemy import select
    from app.models.user import User as UserModel
    user = (await db.execute(select(UserModel).where(UserModel.id == body.user_id))).scalar_one()
    return {
        "user_id": user.id,
        "email": user.email,
        "nome": user.nome,
        "role": ut.role,
        "is_active": user.is_active,
        "must_change_password": user.must_change_password,
        "user_tenant_id": ut.id,
        "created_at": ut.created_at,
    }


@router.patch(
    "/{cliente_id}/consultores/{user_tenant_id}/role",
    response_model=ConsultorOut,
)
async def atualizar_role(
    cliente_id: UUID,
    user_tenant_id: UUID,
    body: UpdateConsultorRoleBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_in_tenant()),
):
    """Muda o role do consultor (manager <-> viewer <-> admin)."""
    try:
        ut = await empresa_service.atualizar_role(
            db=db,
            cliente_id=cliente_id,
            user_tenant_id=user_tenant_id,
            role=body.role,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    from sqlalchemy import select
    from app.models.user import User as UserModel
    user = (await db.execute(select(UserModel).where(UserModel.id == ut.user_id))).scalar_one()

    # Auto-rebaixamento bloqueado: cliente não pode mudar o próprio role
    if ut.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Não é possível alterar o próprio role")

    return {
        "user_id": user.id,
        "email": user.email,
        "nome": user.nome,
        "role": ut.role,
        "is_active": user.is_active,
        "must_change_password": user.must_change_password,
        "user_tenant_id": ut.id,
        "created_at": ut.created_at,
    }


@router.delete("/{cliente_id}/consultores/{user_tenant_id}", status_code=204)
async def remover_consultor(
    cliente_id: UUID,
    user_tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_in_tenant()),
):
    """Remove o consultor da empresa (soft delete: is_active=false no UserTenant)."""
    # Bloqueia auto-remoção: cliente não pode tirar a si mesmo
    from sqlalchemy import select
    from app.models.user import UserTenant as UT
    ut = (await db.execute(select(UT).where(UT.id == user_tenant_id))).scalar_one_or_none()
    if ut and ut.user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Você não pode remover a si mesmo da empresa",
        )

    try:
        await empresa_service.remover_consultor(
            db=db,
            cliente_id=cliente_id,
            user_tenant_id=user_tenant_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
