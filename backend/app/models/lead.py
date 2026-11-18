import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, Numeric, Index, text
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

def _utcnow(): return datetime.now(timezone.utc)

class Lead(Base):
    """schema: integracao.leads"""
    __tablename__ = "leads"
    __table_args__ = (
        Index(
            "uq_leads_cliente_numero_whatsapp_ativo",
            "cliente_id",
            "numero_bot_id",
            "whatsapp",
            unique=True,
            postgresql_where=text("ativo = true AND numero_bot_id IS NOT NULL"),
        ),
        {"schema": "integracao"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    numero_bot_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    whatsapp: Mapped[str] = mapped_column(String(30), nullable=False)
    nome: Mapped[str | None] = mapped_column(String(255), nullable=True)
    telefone_bot: Mapped[str | None] = mapped_column(String(30), nullable=True)
    origem: Mapped[str | None] = mapped_column(String(100), nullable=True)
    etapa_funil: Mapped[str | None] = mapped_column(String(100), nullable=True)
    temperatura: Mapped[str | None] = mapped_column(String(20), nullable=True)
    score: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    extras: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Avatar do WhatsApp — caminho relativo servido pelo nginx
    # (ex: "/avatars/leads/<uuid>/<ts>.jpg"). NULL quando contato não
    # tem foto pública ou sync ainda não rodou. Veja services/avatar_service.py.
    foto_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    bloqueado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Status do lead na página /feed (não afeta Kanban/Conversas/Agora):
    # - concluido_no_feed: time já tratou esse card — some do feed
    # - feed_snooze_ate: oculta o card até esse timestamp
    concluido_no_feed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    feed_snooze_ate: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    # Perfil geográfico e comportamental (preenchido pela IA)
    cidade_lead: Mapped[str | None] = mapped_column(String(100), nullable=True)
    estado_lead: Mapped[str | None] = mapped_column(String(100), nullable=True)
    perfil_lead: Mapped[str | None] = mapped_column(String(100), nullable=True)
    lead_recorrente: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    followup_em: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    primeiraresposta_em: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, onupdate=_utcnow)
