"""adiciona coluna integracao.clientes.budget_brl_diario

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-01

Adiciona limite diário de gasto LLM por tenant. NULL = sem limite (default).
Apenas monitoramento — frontend mostra alerta visual quando gasto-do-dia
no timezone do tenant ultrapassa o limite. Não bloqueia chamadas.
"""
from alembic import op


revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE integracao.clientes
        ADD COLUMN IF NOT EXISTS budget_brl_diario NUMERIC(10, 2) NULL
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE integracao.clientes DROP COLUMN IF EXISTS budget_brl_diario")
