import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, Text, Integer, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP, JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

def _utcnow(): return datetime.now(timezone.utc)


class KpiCatalogo(Base):
    """
    schema: analise.kpi_catalogo

    Catalogo central de KPIs disponiveis.
    KPIs built-in vem com o sistema (is_builtin=true, cliente_id=null).
    KPIs custom sao criados por admins de um tenant (is_builtin=false, cliente_id=uuid).
    """
    __tablename__ = "kpi_catalogo"
    __table_args__ = {"schema": "analise"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    icone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cor: Mapped[str | None] = mapped_column(String(30), nullable=True)
    tipo_calculo: Mapped[str] = mapped_column(String(30), nullable=False)  # count, sum, avg, percent, mode, custom
    config_calculo: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    formato: Mapped[str] = mapped_column(String(30), nullable=False, default="number")  # number, percent, currency, text
    nichos_compativeis: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)  # null = todos
    categoria_kpi: Mapped[str | None] = mapped_column(String(50), nullable=True)  # leads, conversao, financeiro, produto, operacional
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    cliente_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)  # null = global
    ordem_padrao: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, onupdate=_utcnow)


class DashboardConfig(Base):
    """
    schema: analise.dashboard_config

    Configuracao do dashboard por tenant — quais KPIs e relatorios estao habilitados.
    kpis: [{slug, ordem, visivel, tamanho}]
    """
    __tablename__ = "dashboard_config"
    __table_args__ = {"schema": "analise"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True)
    updated_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    kpis: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)  # [{slug, ordem, visivel}]
    layout: Mapped[str] = mapped_column(String(30), default="grid", nullable=False)
    secoes_visiveis: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # None = todas as secoes visiveis
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, onupdate=_utcnow)


class AnaliseWidget(Base):
    """
    schema: analise.analise_widget
    Widget de análise visual configurável por tenant.
    cliente_id=None + nicho preenchido = widget padrão do nicho (global).
    cliente_id preenchido = widget exclusivo do tenant.
    campo: chave em analises.kpi_dados
    operacao: top_n | count | avg | sum | min | max | percent
    tipo_grafico: bar | pie | donut | line | area | metric | table
    """
    __tablename__ = "analise_widget"
    __table_args__ = {"schema": "analise"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    nicho: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    campo: Mapped[str] = mapped_column(String(200), nullable=False)
    operacao: Mapped[str] = mapped_column(String(30), nullable=False)
    limite: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    filtros: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    somente_sem_conversao: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tipo_grafico: Mapped[str] = mapped_column(String(30), nullable=False)
    cor: Mapped[str | None] = mapped_column(String(30), nullable=True)
    ordem: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, onupdate=_utcnow)
