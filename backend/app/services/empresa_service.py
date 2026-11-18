"""
Empresa service — gestão de consultores dentro de uma empresa.

"Consultor" é a denominação de produto pra um usuário que tem acesso operacional
(role=manager) a uma ou mais empresas, mas NÃO é cliente (não tem is_manager_multi),
NÃO é superadmin, e NÃO pode configurar a empresa (números, KPIs, criar usuários).

Quem pode usar este serviço: superadmin OU usuário com is_manager_multi=true E
UserTenant.role=admin ATIVO na empresa-alvo. A camada de dependency
(require_admin_in_tenant) cuida da autorização ANTES de chamar este service.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import timedelta, datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserTenant, UserRole

_INVITE_TOKEN_TTL_HOURS = 2


class EmailConflictError(Exception):
    """Erro levantado quando email já existe e o caller deve usar atribuir-existente."""
    def __init__(self, existing_user: User):
        self.existing_user = existing_user


class AlreadyAssignedError(Exception):
    """Usuário já está vinculado à empresa (UserTenant ativo)."""
    pass


# ─────────────────────────────────────────────────────────────────────────────
# Listar consultores de uma empresa
# ─────────────────────────────────────────────────────────────────────────────

async def listar_consultores(db: AsyncSession, cliente_id: uuid.UUID) -> list[dict]:
    """
    Retorna a lista de consultores ativos vinculados à empresa.

    "Consultor" = qualquer User com UserTenant.is_active=true nessa empresa,
    EXCETO superadmins (que não são gerenciados por aqui) e EXCETO o próprio
    cliente que é admin (esse aparece na lista, mas frontend pode filtrar).
    """
    result = await db.execute(
        select(UserTenant, User)
        .join(User, User.id == UserTenant.user_id)
        .where(
            UserTenant.cliente_id == cliente_id,
            UserTenant.is_active == True,
            User.is_superadmin == False,  # superadmin não é "consultor"
        )
        .order_by(User.nome)
    )
    return [
        {
            "user_id": user.id,
            "email": user.email,
            "nome": user.nome,
            "role": ut.role,
            "is_active": user.is_active,
            "must_change_password": user.must_change_password,
            "user_tenant_id": ut.id,
            "created_at": ut.created_at,
        }
        for ut, user in result.all()
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Criar consultor (User novo + UserTenant)
# ─────────────────────────────────────────────────────────────────────────────

async def criar_consultor(
    db: AsyncSession,
    cliente_id: uuid.UUID,
    email: str,
    nome: str,
    role: UserRole = UserRole.manager,
) -> tuple[User, UserTenant]:
    """
    Cria um User novo + atribui à empresa como consultor.
    Usuário é criado sem senha — recebe email de convite para definir a senha.

    Levanta EmailConflictError se já existir User com esse email — caller
    deve oferecer fluxo "atribuir existente" ou trocar de email.
    """
    existing = await db.execute(select(User).where(User.email == email))
    existing_user = existing.scalar_one_or_none()
    if existing_user:
        raise EmailConflictError(existing_user)

    token = secrets.token_urlsafe(64)
    user = User(
        email=email,
        nome=nome,
        password_hash="",  # sem senha até o usuário definir via link de convite
        is_active=True,
        is_superadmin=False,
        is_manager_multi=False,
        must_change_password=False,
        reset_token=token,
        reset_token_expires_at=datetime.now(timezone.utc) + timedelta(hours=_INVITE_TOKEN_TTL_HOURS),
    )
    db.add(user)
    await db.flush()

    ut = UserTenant(
        user_id=user.id,
        cliente_id=cliente_id,
        role=role,
        is_active=True,
    )
    db.add(ut)
    await db.flush()
    await db.refresh(user)
    await db.refresh(ut)
    return user, ut


# ─────────────────────────────────────────────────────────────────────────────
# Atribuir consultor existente à empresa
# ─────────────────────────────────────────────────────────────────────────────

async def atribuir_existente(
    db: AsyncSession,
    cliente_id: uuid.UUID,
    user_id: uuid.UUID,
    role: UserRole = UserRole.manager,
) -> UserTenant:
    """
    Atribui um User existente como consultor da empresa. Se já existe
    UserTenant inativo, reativa. Se já existe ativo, levanta AlreadyAssignedError.
    """
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise ValueError("Usuário não encontrado")
    if user.is_superadmin:
        raise ValueError("Não é possível atribuir superadmin como consultor")

    existing = await db.execute(
        select(UserTenant).where(
            UserTenant.user_id == user_id,
            UserTenant.cliente_id == cliente_id,
        )
    )
    ut = existing.scalar_one_or_none()
    if ut and ut.is_active:
        raise AlreadyAssignedError("Usuário já está vinculado a esta empresa")
    if ut:
        # Reativa
        ut.role = role
        ut.is_active = True
    else:
        ut = UserTenant(
            user_id=user_id,
            cliente_id=cliente_id,
            role=role,
            is_active=True,
        )
        db.add(ut)
    await db.flush()
    await db.refresh(ut)
    return ut


# ─────────────────────────────────────────────────────────────────────────────
# Atualizar role do consultor
# ─────────────────────────────────────────────────────────────────────────────

async def atualizar_role(
    db: AsyncSession,
    cliente_id: uuid.UUID,
    user_tenant_id: uuid.UUID,
    role: UserRole,
) -> UserTenant:
    """Muda o role do consultor numa empresa específica."""
    result = await db.execute(
        select(UserTenant).where(
            UserTenant.id == user_tenant_id,
            UserTenant.cliente_id == cliente_id,
        )
    )
    ut = result.scalar_one_or_none()
    if not ut:
        raise ValueError("Consultor não encontrado nesta empresa")
    ut.role = role
    await db.flush()
    await db.refresh(ut)
    return ut


# ─────────────────────────────────────────────────────────────────────────────
# Remover acesso (soft delete)
# ─────────────────────────────────────────────────────────────────────────────

async def remover_consultor(
    db: AsyncSession,
    cliente_id: uuid.UUID,
    user_tenant_id: uuid.UUID,
) -> None:
    """
    Soft-delete: seta is_active=False no UserTenant. Mantém histórico
    (mensagens, leads atribuídos, etc) e permite reverter facilmente.
    """
    result = await db.execute(
        select(UserTenant).where(
            UserTenant.id == user_tenant_id,
            UserTenant.cliente_id == cliente_id,
        )
    )
    ut = result.scalar_one_or_none()
    if not ut:
        raise ValueError("Consultor não encontrado nesta empresa")
    ut.is_active = False
    await db.flush()
