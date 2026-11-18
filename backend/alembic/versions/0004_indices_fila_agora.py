"""indices fila agora

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-16

Cria índices de performance para as queries da Fila "Agora" e das
Notificações, que compartilham o padrão "última mensagem por lead" e
filtros sobre leads por temperatura/followup/etapa.

Target de latência: <200ms em dataset de produção.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Índice composto (lead_id, enviada_em DESC) em integracao.mensagens.
    # Acelera a subquery "última mensagem por lead" via row_number().
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_mensagens_lead_id_enviada_em_desc
        ON integracao.mensagens (lead_id, enviada_em DESC)
    """)

    # Filtros comuns em leads: por cliente + temperatura + ativo.
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_leads_cliente_temperatura_ativo
        ON integracao.leads (cliente_id, temperatura, ativo)
    """)

    # Índice parcial para followup_vencido — cobre apenas leads ativos com
    # followup definido, que são a minoria. Tabela enxuta = scan rápido.
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_leads_cliente_followup
        ON integracao.leads (cliente_id, followup_em)
        WHERE followup_em IS NOT NULL AND ativo = true
    """)

    # GIN em extra_json para permitir filtro por chaves JSONB
    # (oportunidade_aberta, etc).
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_analises_extra_json_gin
        ON analise.analises USING gin (extra_json)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS integracao.ix_mensagens_lead_id_enviada_em_desc")
    op.execute("DROP INDEX IF EXISTS integracao.ix_leads_cliente_temperatura_ativo")
    op.execute("DROP INDEX IF EXISTS integracao.ix_leads_cliente_followup")
    op.execute("DROP INDEX IF EXISTS analise.ix_analises_extra_json_gin")
