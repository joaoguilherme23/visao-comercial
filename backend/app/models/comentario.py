"""
ComentarioLead — comentários internos do time sobre um lead.
NUNCA é enviado pro WhatsApp do lead. É um log interno usado na página /feed
pra que consultores troquem informações sobre o atendimento.

schema: integracao.comentarios_lead
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


def _utcnow(): return datetime.now(timezone.utc)


class ComentarioLead(Base):
    """schema: integracao.comentarios_lead"""
    __tablename__ = "comentarios_lead"
    __table_args__ = {"schema": "integracao"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    # autor — não usa FK para evitar problema cross-schema, validado em service
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    autor_nome: Mapped[str] = mapped_column(String(255), nullable=False)
    texto: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, nullable=False)
