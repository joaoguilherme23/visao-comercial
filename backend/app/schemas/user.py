from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.models.user import UserRole

class UserCreate(BaseModel):
    email: EmailStr
    nome: str
    is_superadmin: bool = False
    is_manager_multi: bool = False

class UserUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_manager_multi: Optional[bool] = None
    avatar_url: Optional[str] = None

class UserOut(BaseModel):
    id: UUID
    email: str
    nome: str
    is_active: bool
    is_superadmin: bool
    is_manager_multi: bool = False
    must_change_password: bool = False
    avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SetManagerMultiBody(BaseModel):
    """Toggle is_manager_multi (superadmin only)."""
    is_manager_multi: bool


# ── Consultor management (cliente/superadmin cria consultor numa empresa) ──

class CreateConsultorBody(BaseModel):
    """Body de POST /empresas/{cliente_id}/consultores. Cria User novo OU
    pede pra atribuir um existente. Se email já existir no sistema, backend
    retorna 409 com existing_user_id e o frontend chama /atribuir-existente."""
    email: EmailStr
    nome: str


class AttachConsultorExistingBody(BaseModel):
    """Atribui user existente (que ficou em conflito por email) à empresa."""
    user_id: UUID


class UpdateConsultorRoleBody(BaseModel):
    """Mudar role do consultor numa empresa específica (admin só nesse contexto)."""
    role: UserRole


class ConsultorOut(BaseModel):
    """Item da listagem de consultores de uma empresa."""
    user_id: UUID
    email: str
    nome: str
    role: UserRole
    is_active: bool
    must_change_password: bool
    user_tenant_id: UUID  # PK do UserTenant (pra DELETE/PATCH)
    created_at: datetime

    class Config:
        from_attributes = True


class ChangePasswordBody(BaseModel):
    """Body de POST /auth/change-password (autenticado)."""
    senha_atual: str
    senha_nova: str

    @field_validator("senha_nova")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Nova senha deve ter no mínimo 8 caracteres")
        return v


class AdminResetPasswordBody(BaseModel):
    """Body de POST /users/{id}/admin-reset-password.

    Usado quando admin do tenant OU superadmin define manualmente a senha
    de outro usuário (sem precisar de email/SMTP funcionando). O admin
    fica responsável por passar a senha pro usuário pelo canal apropriado
    (WhatsApp, presencial, etc).
    """
    senha_nova: str
    forcar_troca: bool = False  # default OFF (admin escolhe)

    @field_validator("senha_nova")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Senha deve ter no mínimo 8 caracteres")
        return v


class EmailConflictOut(BaseModel):
    """Resposta 409 quando email já existe no sistema."""
    detail: str = "email_exists"
    existing_user_id: UUID
    existing_user_nome: str


# ── Admin: lista enriquecida com tenants embutidos ──────────────────────────

class UserAdminTenantItem(BaseModel):
    """Empresa que um usuário tem acesso (item da lista do admin)."""
    user_tenant_id: UUID
    cliente_id: UUID
    cliente_nome: str
    cliente_nicho: Optional[str] = None
    role: UserRole
    is_active: bool


class UserAdminListItem(BaseModel):
    """
    Visão admin do usuário com lista compacta das empresas que ele tem
    acesso (via UserTenant.is_active=True). Pra superadmin a lista vem
    vazia — frontend mostra contador "Vê todas as N empresas".
    """
    id: UUID
    email: str
    nome: str
    is_active: bool
    is_superadmin: bool
    is_manager_multi: bool
    must_change_password: bool
    avatar_url: Optional[str] = None
    created_at: datetime
    tenants: List[UserAdminTenantItem] = []
    # Contador agregado pra UI mostrar "Vê todas as N empresas" no superadmin.
    # Pra usuário normal, equivale a len(tenants).
    total_empresas: int = 0

class UserTenantOut(BaseModel):
    id: UUID
    user_id: UUID
    cliente_id: UUID
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class AssignUserTenant(BaseModel):
    user_id: UUID
    cliente_id: UUID
    role: UserRole = UserRole.viewer

class UpdateUserTenantRole(BaseModel):
    role: UserRole

class UserWithTenantsOut(UserOut):
    tenants: List[UserTenantOut] = []

class MyTenantRoleOut(BaseModel):
    cliente_id: UUID
    role: UserRole

    class Config:
        from_attributes = True


# ── Password reset / convite ─────────────────────────────────────────────────

class ForgotPasswordBody(BaseModel):
    email: EmailStr


class ResetPasswordBody(BaseModel):
    token: str
    senha_nova: str

    @field_validator("senha_nova")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Nova senha deve ter no mínimo 8 caracteres")
        return v
