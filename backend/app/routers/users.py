import logging
import secrets
from datetime import timedelta, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete as sql_delete
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.core.config import settings
from app.core.dependencies import get_current_user, get_current_superadmin
from app.core.security import hash_password
from app.models.user import User, UserTenant, UserRole
from app.schemas.user import (
    UserCreate, UserUpdate, UserOut, UserWithTenantsOut,
    AssignUserTenant, UpdateUserTenantRole, UserTenantOut, MyTenantRoleOut,
    SetManagerMultiBody, UserAdminListItem, UserAdminTenantItem,
    AdminResetPasswordBody,
)
from app.models.tenant import Cliente
from app.services import email_service

logger = logging.getLogger(__name__)

_INVITE_TOKEN_TTL_HOURS = 2

router = APIRouter(prefix="/users", tags=["users"])

@router.get("", response_model=List[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superadmin),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()


@router.get("/admin-list", response_model=List[UserAdminListItem])
async def admin_list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superadmin),
):
    """
    Listagem enriquecida pra tela de admin: cada usuário vem com a lista
    compacta de empresas (UserTenant.is_active=true) que ele tem acesso.

    Superadmin vem com tenants=[] mas total_empresas=N (contagem total
    de empresas ativas no sistema) — frontend mostra "Vê todas as N".
    """
    # 1. Lista usuários ordenados por nome
    users_q = await db.execute(select(User).order_by(User.nome.asc()))
    users = list(users_q.scalars().all())

    # 2. Total de empresas ativas (pra mostrar no superadmin)
    total_clientes_ativos = (await db.execute(
        select(func.count()).select_from(Cliente).where(Cliente.ativo == True)
    )).scalar() or 0

    # 3. Carrega user_tenants ativos com nome+nicho do cliente em 1 query
    if users:
        user_ids = [u.id for u in users]
        ut_join = await db.execute(
            select(UserTenant, Cliente)
            .join(Cliente, Cliente.id == UserTenant.cliente_id)
            .where(
                UserTenant.user_id.in_(user_ids),
                UserTenant.is_active == True,
            )
            .order_by(Cliente.nome.asc())
        )
        rows = list(ut_join.all())
    else:
        rows = []

    # 4. Indexa por user_id
    by_user: dict[UUID, list[UserAdminTenantItem]] = {}
    for ut, cliente in rows:
        by_user.setdefault(ut.user_id, []).append(
            UserAdminTenantItem(
                user_tenant_id=ut.id,
                cliente_id=cliente.id,
                cliente_nome=cliente.nome,
                cliente_nicho=cliente.nicho,
                role=ut.role,
                is_active=ut.is_active,
            )
        )

    # 5. Monta resposta — superadmin tem tenants=[] e total = todas
    out: list[UserAdminListItem] = []
    for u in users:
        if u.is_superadmin:
            tenants_list: list[UserAdminTenantItem] = []
            total = total_clientes_ativos
        else:
            tenants_list = by_user.get(u.id, [])
            total = len(tenants_list)
        out.append(UserAdminListItem(
            id=u.id,
            email=u.email,
            nome=u.nome,
            is_active=u.is_active,
            is_superadmin=u.is_superadmin,
            is_manager_multi=u.is_manager_multi,
            must_change_password=u.must_change_password,
            avatar_url=u.avatar_url,
            created_at=u.created_at,
            tenants=tenants_list,
            total_empresas=total,
        ))
    return out

@router.post("", response_model=UserOut, status_code=201)
async def create_user(
    body: UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superadmin),
):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email já cadastrado")

    token = secrets.token_urlsafe(64)
    user = User(
        email=body.email,
        password_hash="",  # sem senha até o usuário definir via link
        nome=body.nome,
        is_superadmin=body.is_superadmin,
        is_manager_multi=body.is_manager_multi,
        must_change_password=False,
        reset_token=token,
        reset_token_expires_at=datetime.now(timezone.utc) + timedelta(hours=_INVITE_TOKEN_TTL_HOURS),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    background_tasks.add_task(email_service.send_invite, user.nome, user.email, token)
    return user

# --- Current user tenant roles ---
# IMPORTANTE: /me/tenants precisa vir ANTES de /{user_id}, senão FastAPI
# tenta casar "me" como UUID e retorna 422. Bug C1 corrigido aqui.
@router.get("/me/tenants", response_model=List[MyTenantRoleOut])
async def my_tenants(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista os tenants que o usuário atual tem acesso, com seu role."""
    query = select(UserTenant).where(
        UserTenant.user_id == current_user.id,
        UserTenant.is_active == True,
    )
    # Sem escopo injetado pelo gate, o modo OIDC retorna conjunto vazio.
    if settings.OIDC_ENABLED:
        query = query.where(UserTenant.cliente_id.in_(getattr(request.state, "oidc_allowed_cliente_ids", set())))
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{user_id}", response_model=UserWithTenantsOut)
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_superadmin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Sem permissão")
    result = await db.execute(
        select(User).options(selectinload(User.tenants)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user

@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_superadmin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Sem permissão")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Não encontrado")
    payload = body.model_dump(exclude_unset=True)
    # Auto-promoção bloqueada: só superadmin pode mudar is_manager_multi
    # (use PATCH /users/{id}/manager-multi pra isso).
    if "is_manager_multi" in payload and not current_user.is_superadmin:
        raise HTTPException(
            status_code=403,
            detail="Apenas superadmin pode alterar is_manager_multi",
        )
    for field, val in payload.items():
        if field == "password":
            if val:  # don't set empty password
                user.password_hash = hash_password(val)
        else:
            setattr(user, field, val)
    await db.flush()
    await db.refresh(user)
    return user

@router.patch("/{user_id}/manager-multi", response_model=UserOut)
async def set_manager_multi(
    user_id: UUID,
    body: SetManagerMultiBody,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superadmin),
):
    """
    Liga/desliga a flag is_manager_multi (perfil "Gestor Multi-Empresa").
    Superadmin only — não permitido auto-promoção.

    NOTA: a flag é ortogonal aos UserTenants. Mesmo virando manager_multi,
    o usuário só vê empresas onde tem entrada ativa em user_tenants.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Não encontrado")
    user.is_manager_multi = body.is_manager_multi
    await db.flush()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superadmin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Não encontrado")
    if user.is_superadmin:
        count = await db.execute(
            select(func.count()).select_from(User).where(
                User.is_superadmin == True, User.is_active == True
            )
        )
        if (count.scalar() or 0) <= 1:
            raise HTTPException(
                status_code=400,
                detail="Não é possível remover o último superadmin do sistema",
            )
    # Remove user-tenant assignments first (no FK cascade at DB level)
    await db.execute(sql_delete(UserTenant).where(UserTenant.user_id == user_id))
    await db.delete(user)

# --- Tenant assignments ---
@router.post("/assign-tenant", response_model=UserTenantOut, status_code=201)
async def assign_tenant(
    body: AssignUserTenant,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superadmin),
):
    existing = await db.execute(
        select(UserTenant).where(
            UserTenant.user_id == body.user_id,
            UserTenant.cliente_id == body.cliente_id,
        )
    )
    ut = existing.scalar_one_or_none()
    if ut:
        ut.role = body.role
        ut.is_active = True
    else:
        ut = UserTenant(user_id=body.user_id, cliente_id=body.cliente_id, role=body.role)
        db.add(ut)
    await db.flush()
    await db.refresh(ut)
    return ut

@router.patch("/tenant-access/{ut_id}", response_model=UserTenantOut)
async def update_tenant_access(
    ut_id: UUID,
    body: UpdateUserTenantRole,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superadmin),
):
    result = await db.execute(select(UserTenant).where(UserTenant.id == ut_id))
    ut = result.scalar_one_or_none()
    if not ut:
        raise HTTPException(status_code=404, detail="Não encontrado")
    ut.role = body.role
    await db.flush()
    await db.refresh(ut)
    return ut


@router.delete("/tenant-access/{ut_id}", status_code=204)
async def revoke_tenant_access(
    ut_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superadmin),
):
    """Revoga acesso de um usuário a uma empresa (soft: is_active=false)."""
    result = await db.execute(select(UserTenant).where(UserTenant.id == ut_id))
    ut = result.scalar_one_or_none()
    if not ut:
        raise HTTPException(status_code=404, detail="Não encontrado")
    ut.is_active = False
    await db.flush()


# ── Admin reset password ────────────────────────────────────────────────────

@router.post("/{user_id}/admin-reset-password", response_model=UserOut)
async def admin_reset_password(
    user_id: UUID,
    body: AdminResetPasswordBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin define manualmente a senha de outro usuário.

    Usado quando SMTP não está funcionando ou quando o admin precisa
    passar a senha pelo WhatsApp/presencialmente. **Não substitui o fluxo
    de email** — é fallback.

    Permissões (regra B do plano):
    - Superadmin pode redefinir senha de qualquer um, exceto outro superadmin
      (apenas outro superadmin pode mexer em superadmin).
    - Admin de tenant pode redefinir senha de usuários que tem acesso a
      QUALQUER tenant onde ele também é admin (consultor/cliente do mesmo
      grupo). Não pode mexer em superadmin nem em outro admin de tenants
      onde ele NÃO é admin.

    Auditoria: log estruturado com user_id alvo + admin id.
    """
    # 1. Target user existe?
    target_res = await db.execute(select(User).where(User.id == user_id))
    target = target_res.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # 2. Permissões — bloqueia self (use /auth/change-password)
    if current_user.id == user_id:
        raise HTTPException(
            status_code=400,
            detail="Use /auth/change-password pra trocar sua própria senha",
        )

    # 3. Bloqueia mexer em superadmin (a não ser que o admin tambem seja)
    if target.is_superadmin and not current_user.is_superadmin:
        raise HTTPException(
            status_code=403,
            detail="Apenas superadmin pode redefinir senha de outro superadmin",
        )

    # 4. Se NÃO for superadmin, precisa ser admin de algum tenant que o
    #    target compartilha. Senão, recusa.
    if not current_user.is_superadmin:
        # Tenants onde current_user é admin ativo
        admin_tenants_res = await db.execute(
            select(UserTenant.cliente_id).where(
                UserTenant.user_id == current_user.id,
                UserTenant.role == UserRole.admin,
                UserTenant.is_active == True,
            )
        )
        admin_tenants = {row[0] for row in admin_tenants_res.all()}
        if not admin_tenants:
            raise HTTPException(
                status_code=403,
                detail="Apenas admins de tenant ou superadmin podem redefinir senha",
            )

        # Tenants do target
        target_tenants_res = await db.execute(
            select(UserTenant.cliente_id).where(
                UserTenant.user_id == user_id,
                UserTenant.is_active == True,
            )
        )
        target_tenants = {row[0] for row in target_tenants_res.all()}

        # Precisa ter ao menos 1 tenant em comum onde o current_user é admin
        if not (admin_tenants & target_tenants):
            raise HTTPException(
                status_code=403,
                detail="Você só pode redefinir senha de usuários das empresas onde é admin",
            )

    # 5. Aplica a nova senha
    target.password_hash = hash_password(body.senha_nova)
    target.must_change_password = body.forcar_troca
    # Limpa token de reset pendente (se houver) — senha foi definida manualmente
    target.reset_token = None
    target.reset_token_expires_at = None
    await db.flush()
    await db.refresh(target)

    # 6. Auditoria — log estruturado (futuro: tabela audit_log)
    logger.info(
        "[admin-reset-password] target_user=%s by_user=%s forcar_troca=%s",
        target.id, current_user.id, body.forcar_troca,
    )

    return target
