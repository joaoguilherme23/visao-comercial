import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

def _utcnow(): return datetime.now(timezone.utc)

class Cliente(Base):
    """schema: integracao.clientes"""
    __tablename__ = "clientes"
    __table_args__ = {"schema": "integracao"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    nicho: Mapped[str | None] = mapped_column(String(100), nullable=True)
    plano: Mapped[str | None] = mapped_column(String(50), nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), default="America/Sao_Paulo", nullable=False)
    nome_agente: Mapped[str | None] = mapped_column(String(100), nullable=True)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Limite diário de gasto LLM em R$. NULL = sem limite. Reset à meia-noite
    # no timezone do tenant (cliente.timezone). Apenas alerta visual no painel
    # — não bloqueia chamadas.
    budget_brl_diario: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    # ── Dados cadastrais (migration 0013) ───────────────────────────────────
    # CNPJ sem máscara (apenas dígitos). Opcional — clientes MEI/PF/estrangeiros
    # podem ficar sem. Quando preenchido, frontend valida formato (14 dígitos +
    # algoritmo dos 2 dígitos verificadores).
    cnpj: Mapped[str | None] = mapped_column(String(18), nullable=True)
    razao_social: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Endereço estruturado — frontend integra ViaCEP pra preencher automático
    endereco_cep: Mapped[str | None] = mapped_column(String(10), nullable=True)
    endereco_logradouro: Mapped[str | None] = mapped_column(String(255), nullable=True)
    endereco_numero: Mapped[str | None] = mapped_column(String(20), nullable=True)
    endereco_complemento: Mapped[str | None] = mapped_column(String(100), nullable=True)
    endereco_bairro: Mapped[str | None] = mapped_column(String(100), nullable=True)
    endereco_cidade: Mapped[str | None] = mapped_column(String(100), nullable=True)
    endereco_uf: Mapped[str | None] = mapped_column(String(2), nullable=True)
    # Array de contatos: [{tipo: "comercial", telefone, email}, ...]
    contatos: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    # Responsável pelo contrato (1 pessoa)
    responsavel_nome: Mapped[str | None] = mapped_column(String(255), nullable=True)
    responsavel_cargo: Mapped[str | None] = mapped_column(String(100), nullable=True)
    responsavel_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    responsavel_telefone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # Logo/avatar da empresa — path relativo servido por /avatars no nginx
    # (ex: "/avatars/tenants/<uuid>/<ts>.jpg"). Reusa infra de avatar_service.py.
    foto_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, onupdate=_utcnow)
    # Cross-schema relationships removed — use explicit select() queries instead


class TenantConnection(Base):
    """schema: public.tenant_connections"""
    __tablename__ = "tenant_connections"
    __table_args__ = {"schema": "public"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(30), default="pendente")
    ultimo_ping: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, onupdate=_utcnow)
