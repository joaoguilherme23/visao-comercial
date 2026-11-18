import uuid
from datetime import datetime
from sqlalchemy import String, Text, Index, text
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class Mensagem(Base):
    """schema: integracao.mensagens"""
    __tablename__ = "mensagens"
    __table_args__ = (
        Index(
            "uq_mensagens_numero_provider_msg",
            "numero_bot_id",
            "provider_msg_id",
            unique=True,
            postgresql_where=text("numero_bot_id IS NOT NULL AND provider_msg_id IS NOT NULL"),
        ),
        {"schema": "integracao"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    numero_bot_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    direcao: Mapped[str] = mapped_column(String(10), nullable=False)
    tipo: Mapped[str] = mapped_column(String(30), nullable=False)
    conteudo: Mapped[str | None] = mapped_column(Text, nullable=True)
    midia_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    provider_msg_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status_entrega: Mapped[str | None] = mapped_column(String(30), nullable=True)
    enviada_em: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    enviado_por: Mapped[str | None] = mapped_column(String(20), nullable=True)
