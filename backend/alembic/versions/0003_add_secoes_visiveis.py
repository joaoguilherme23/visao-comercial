"""add secoes_visiveis to dashboard_config

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-14
"""
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'dashboard_config',
        op.Column('secoes_visiveis', postgresql.JSONB, nullable=True),
        schema='analise',
    )


def downgrade() -> None:
    op.drop_column('dashboard_config', 'secoes_visiveis', schema='analise')
