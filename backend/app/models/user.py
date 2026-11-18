import uuid
import enum
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Boolean, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from app.core.database import Base

def _utcnow(): return datetime.now(timezone.utc)

class UserRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    viewer = "viewer"

class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "public"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superadmin: Mapped[bool] = mapped_column(Boolean, default=False)
    # Gestor multi-empresa: vê portfolio agregado das N empresas que tem
    # acesso, mas NÃO pode criar tenant novo (continua sendo só superadmin).
    # Independente de role por tenant em UserTenant.
    is_manager_multi: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Forçar troca de senha no próximo login (consultor recém-criado pelo cliente).
    # Frontend redireciona pra /change-password antes de qualquer rota protegida.
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Token de redefinição de senha (convite ou forgot-password)
    reset_token: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, unique=True, index=True)
    reset_token_expires_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, onupdate=_utcnow)

    tenants: Mapped[list["UserTenant"]] = relationship(
        "UserTenant",
        back_populates="user",
        primaryjoin="User.id == foreign(UserTenant.user_id)",
    )


class UserTenant(Base):
    __tablename__ = "user_tenants"
    __table_args__ = {"schema": "public"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    cliente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, schema="public"), default=UserRole.viewer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow)

    user: Mapped["User"] = relationship(
        "User",
        back_populates="tenants",
        primaryjoin="UserTenant.user_id == User.id",
        foreign_keys="[UserTenant.user_id]",
    )
    cliente: Mapped["Cliente"] = relationship(
        "Cliente",
        primaryjoin="UserTenant.cliente_id == Cliente.id",
        foreign_keys="[UserTenant.cliente_id]",
    )
