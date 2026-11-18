"""dedup leads and add partial unique constraint

Revision ID: 0002
Revises: 0001
Create Date: 2025-01-02
"""
from alembic import op

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Deactivate duplicate leads — keep the most recent (by updated_at)
    # for each (cliente_id, whatsapp) pair. Others become ativo=false.
    op.execute("""
        UPDATE integracao.leads l
        SET ativo = false
        WHERE l.ativo = true
          AND l.id NOT IN (
            SELECT DISTINCT ON (cliente_id, whatsapp) id
            FROM integracao.leads
            WHERE ativo = true
            ORDER BY cliente_id, whatsapp, updated_at DESC
          )
    """)

    # Step 2: Partial unique index — enforces one active lead per (cliente_id, whatsapp).
    # Inactive leads are not affected (they remain for audit purposes).
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_cliente_whatsapp_ativo
        ON integracao.leads (cliente_id, whatsapp)
        WHERE ativo = true
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS integracao.uq_leads_cliente_whatsapp_ativo")
