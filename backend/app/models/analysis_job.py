"""Fila durável de análises de conversa.

Os dados do prompt e a resposta do modelo não são persistidos aqui.  A tabela
guarda somente referências, estado de entrega e material de autenticação
derivado (hash de token de uso único por tentativa).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AnalysisJob(Base):
    """schema: analise.analysis_jobs."""

    __tablename__ = "analysis_jobs"
    __table_args__ = (
        UniqueConstraint("message_id", name="uq_analysis_jobs_message_id"),
        CheckConstraint("attempts >= 0", name="ck_analysis_jobs_attempts_nonnegative"),
        Index(
            "ix_analysis_jobs_claim",
            "status",
            "available_at",
            "created_at",
        ),
        Index(
            "ix_analysis_jobs_conversation",
            "cliente_id",
            "numero_bot_id",
            "lead_id",
            "created_at",
        ),
        {"schema": "analise"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    numero_bot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    message_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    connection_generation: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    source_message_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)

    # pending -> leased -> dispatched -> completed.  Estados terminais:
    # superseded (uma mensagem mais nova coalesceu a conversa) e dead.
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    available_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=_utcnow
    )
    lease_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    lease_expires_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    workflow_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    workflow_token_expires_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    dispatched_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    analysis_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, unique=True)
    # Somente um código operacional curto; nunca resposta HTTP, token ou prompt.
    last_error_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )
