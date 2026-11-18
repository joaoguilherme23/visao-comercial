"""cria tabela integracao.comentarios_lead

Revision ID: 0010
Revises: 0009
Create Date: 2026-05-02

Tabela de comentários internos do time sobre um lead. Usado na página /feed.
NÃO envia mensagem pro WhatsApp do lead — só log interno.
"""
from alembic import op


revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS integracao.comentarios_lead (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            cliente_id    UUID NOT NULL,
            lead_id       UUID NOT NULL,
            user_id       UUID NOT NULL,
            autor_nome    VARCHAR(255) NOT NULL,
            texto         TEXT NOT NULL,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_comentarios_lead_cliente ON integracao.comentarios_lead (cliente_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_comentarios_lead_lead    ON integracao.comentarios_lead (lead_id, created_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_comentarios_lead_user    ON integracao.comentarios_lead (user_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS integracao.comentarios_lead")
