import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, Index, text
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

def _utcnow(): return datetime.now(timezone.utc)


class NumeroBot(Base):
    """schema: integracao.numeros_bot"""
    __tablename__ = "numeros_bot"
    __table_args__ = (
        Index(
            "uq_numeros_bot_token_digest",
            "token_digest",
            unique=True,
            postgresql_where=text("token_digest IS NOT NULL"),
        ),
        Index(
            "uq_numeros_bot_provider_instance",
            "provider_instance_id",
            unique=True,
            postgresql_where=text("provider_instance_id IS NOT NULL"),
        ),
        {"schema": "integracao"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    numero: Mapped[str] = mapped_column(String(30), nullable=False)
    nome: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Provider credentials never live in ``config``.  The digest supports a
    # deterministic webhook lookup without decrypting every stored credential.
    provider_instance_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    token_encrypted: Mapped[str | None] = mapped_column(String(500), nullable=True)
    token_digest: Mapped[str | None] = mapped_column(String(64), nullable=True)
    connection_generation: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, default=uuid.uuid4
    )
    # Existing connections remain opt-in after the migration.  New objects are
    # created with both flags enabled by the route, after the number is verified.
    sync_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    analysis_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sync_state: Mapped[str | None] = mapped_column(String(40), nullable=True)
    last_message_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    last_analysis_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    webhook_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, onupdate=_utcnow)
