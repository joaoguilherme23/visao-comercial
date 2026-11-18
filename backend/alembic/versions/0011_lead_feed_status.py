"""adiciona colunas integracao.leads.concluido_no_feed e feed_snooze_ate

Revision ID: 0011
Revises: 0010
Create Date: 2026-05-02

Status do lead na página /feed:
- concluido_no_feed: marcado pelo time como "tratado" — some do feed permanentemente
- feed_snooze_ate: timestamp até quando o card fica oculto (soneca temporária)

Não afeta Kanban, Conversas ou Agora — é uma "vista" filtrada apenas no feed.
"""
from alembic import op


revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE integracao.leads
        ADD COLUMN IF NOT EXISTS concluido_no_feed BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS feed_snooze_ate   TIMESTAMPTZ NULL
    """)
    # Index parcial — acelera o filtro do feed (maioria dos leads têm os 2 NULL/false)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_leads_feed_visible
        ON integracao.leads (cliente_id, updated_at DESC)
        WHERE ativo = TRUE AND concluido_no_feed = FALSE
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS integracao.ix_leads_feed_visible")
    op.execute("ALTER TABLE integracao.leads DROP COLUMN IF EXISTS feed_snooze_ate")
    op.execute("ALTER TABLE integracao.leads DROP COLUMN IF EXISTS concluido_no_feed")
