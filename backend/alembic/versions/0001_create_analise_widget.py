"""create analise_widget table

Revision ID: 0001
Revises:
Create Date: 2025-01-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS analise")
    op.create_table(
        'analise_widget',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('cliente_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('nicho', sa.String(100), nullable=True),
        sa.Column('label', sa.String(200), nullable=False),
        sa.Column('descricao', sa.Text, nullable=True),
        sa.Column('campo', sa.String(200), nullable=False),
        sa.Column('operacao', sa.String(30), nullable=False),
        sa.Column('limite', sa.Integer, nullable=False, server_default='10'),
        sa.Column('filtros', postgresql.JSONB, nullable=False, server_default='[]'),
        sa.Column('somente_sem_conversao', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('tipo_grafico', sa.String(30), nullable=False),
        sa.Column('cor', sa.String(30), nullable=True),
        sa.Column('ordem', sa.Integer, nullable=False, server_default='0'),
        sa.Column('ativo', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
        schema='analise',
    )
    op.create_index('ix_analise_widget_cliente_id', 'analise_widget', ['cliente_id'], schema='analise')
    op.create_index('ix_analise_widget_nicho', 'analise_widget', ['nicho'], schema='analise')


def downgrade() -> None:
    op.drop_index('ix_analise_widget_nicho', 'analise_widget', schema='analise')
    op.drop_index('ix_analise_widget_cliente_id', 'analise_widget', schema='analise')
    op.drop_table('analise_widget', schema='analise')
