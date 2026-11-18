import uuid
from datetime import datetime, date, timezone
from sqlalchemy import String, Integer, Numeric, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

def _utcnow(): return datetime.now(timezone.utc)

class Analise(Base):
    """schema: analise.analises"""
    __tablename__ = "analises"
    __table_args__ = {"schema": "analise"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    # A análise pertence à conexão que a gerou.  Isso evita que duas linhas do
    # mesmo tenant sejam misturadas na UI ou em consultas de auditoria.
    numero_bot_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    data_ref: Mapped[date] = mapped_column(Date, nullable=False)
    versao: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    resumo_curto: Mapped[str | None] = mapped_column(String, nullable=True)
    sentimento: Mapped[str | None] = mapped_column(String(30), nullable=True)
    score_interesse: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    intencao: Mapped[str | None] = mapped_column(String(100), nullable=True)
    proximo_passo: Mapped[str | None] = mapped_column(String, nullable=True)
    modelo_ia: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tokens_consumidos: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tempo_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_msgs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow)
    # ── Novos campos unificados (evitam tabelas 1:1) ──────────────────────────
    kpi_dados: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    kpi_score_fechamento: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    kpi_proximo_contato: Mapped[str | None] = mapped_column(String(200), nullable=True)
    kpi_urgencia: Mapped[str | None] = mapped_column(String(30), nullable=True)
    detalhe_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    extra_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

