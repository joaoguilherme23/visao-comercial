"""add password reset token fields to users

Revision ID: 0012
Revises: 0011
Create Date: 2026-05-05
"""
from alembic import op
import sqlalchemy as sa

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("reset_token", sa.String(128), nullable=True),
        schema="public",
    )
    op.add_column(
        "users",
        sa.Column(
            "reset_token_expires_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        schema="public",
    )
    op.create_index(
        "ix_users_reset_token",
        "users",
        ["reset_token"],
        schema="public",
        unique=True,
        postgresql_where=sa.text("reset_token IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_users_reset_token", table_name="users", schema="public")
    op.drop_column("users", "reset_token_expires_at", schema="public")
    op.drop_column("users", "reset_token", schema="public")
