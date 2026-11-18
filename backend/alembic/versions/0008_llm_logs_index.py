"""indice em logs.log_llm_usage(usuario, created_at desc)

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-01

A tabela logs.log_llm_usage é populada pelo n8n e tem só PK no id.
Adiciona índice composto pra acelerar as queries do /llm-logs:
  - listagem ordenada por created_at desc
  - filtro por usuario (cliente_id) + período
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_log_llm_usage_usuario_created_at
        ON logs.log_llm_usage (usuario, created_at DESC)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_log_llm_usage_created_at
        ON logs.log_llm_usage (created_at DESC)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS logs.ix_log_llm_usage_created_at")
    op.execute("DROP INDEX IF EXISTS logs.ix_log_llm_usage_usuario_created_at")
