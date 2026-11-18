"""analysis outbox durável e isolamento por número

Revision ID: 0017
Revises: 0016
Create Date: 2026-10-29
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "analises",
        sa.Column("numero_bot_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema="analise",
    )
    op.create_index(
        "ix_analises_numero_bot_id",
        "analises",
        ["numero_bot_id"],
        unique=False,
        schema="analise",
    )

    op.create_table(
        "analysis_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("cliente_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("numero_bot_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("connection_generation", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_message_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("available_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("lease_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("lease_expires_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("workflow_token_hash", sa.String(length=64), nullable=True),
        sa.Column("workflow_token_expires_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("dispatched_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("analysis_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("last_error_code", sa.String(length=80), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("attempts >= 0", name="ck_analysis_jobs_attempts_nonnegative"),
        sa.UniqueConstraint("message_id", name="uq_analysis_jobs_message_id"),
        sa.UniqueConstraint("analysis_id", name="uq_analysis_jobs_analysis_id"),
        schema="analise",
    )
    op.create_index("ix_analysis_jobs_cliente_id", "analysis_jobs", ["cliente_id"], schema="analise")
    op.create_index("ix_analysis_jobs_numero_bot_id", "analysis_jobs", ["numero_bot_id"], schema="analise")
    op.create_index("ix_analysis_jobs_lead_id", "analysis_jobs", ["lead_id"], schema="analise")
    op.create_index(
        "ix_analysis_jobs_claim",
        "analysis_jobs",
        ["status", "available_at", "created_at"],
        schema="analise",
    )
    op.create_index(
        "ix_analysis_jobs_conversation",
        "analysis_jobs",
        ["cliente_id", "numero_bot_id", "lead_id", "created_at"],
        schema="analise",
    )


def downgrade() -> None:
    op.drop_table("analysis_jobs", schema="analise")
    op.drop_index("ix_analises_numero_bot_id", table_name="analises", schema="analise")
    op.drop_column("analises", "numero_bot_id", schema="analise")
