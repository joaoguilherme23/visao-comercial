"""secure Uazapi connection credentials and number-scoped ingestion

Revision ID: 0016
Revises: 0013
"""
from alembic import op

revision = "0016"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No legacy JSON token is copied automatically: an explicit, audited
    # migration procedure must supply the encryption key and bind ownership.
    op.execute("""
        ALTER TABLE integracao.numeros_bot
            ADD COLUMN IF NOT EXISTS provider_instance_id VARCHAR(120),
            ADD COLUMN IF NOT EXISTS token_encrypted VARCHAR(500),
            ADD COLUMN IF NOT EXISTS token_digest VARCHAR(64),
            ADD COLUMN IF NOT EXISTS connection_generation UUID,
            ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS analysis_enabled BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS sync_state VARCHAR(40),
            ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS last_analysis_at TIMESTAMPTZ
    """)
    # Avoid requiring pgcrypto/uuid-ossp on installations that do not have it.
    op.execute("""
        UPDATE integracao.numeros_bot
           SET connection_generation = (md5(random()::text || clock_timestamp()::text))::uuid
         WHERE connection_generation IS NULL
    """)
    op.execute("ALTER TABLE integracao.numeros_bot ALTER COLUMN connection_generation SET NOT NULL")
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_numeros_bot_token_digest
        ON integracao.numeros_bot (token_digest)
        WHERE token_digest IS NOT NULL
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_numeros_bot_provider_instance
        ON integracao.numeros_bot (provider_instance_id)
        WHERE provider_instance_id IS NOT NULL
    """)

    op.execute("ALTER TABLE integracao.leads ADD COLUMN IF NOT EXISTS numero_bot_id UUID")
    # Old rows intentionally remain NULL and stay in their own legacy identity
    # domain.  We do not infer their source number from historical content.
    op.execute("DROP INDEX IF EXISTS integracao.uq_leads_cliente_whatsapp_ativo")
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_cliente_whatsapp_ativo_legacy
        ON integracao.leads (cliente_id, whatsapp)
        WHERE ativo = true AND numero_bot_id IS NULL
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_cliente_numero_whatsapp_ativo
        ON integracao.leads (cliente_id, numero_bot_id, whatsapp)
        WHERE ativo = true AND numero_bot_id IS NOT NULL
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_leads_numero_bot_id ON integracao.leads (numero_bot_id)")
    op.execute("""
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_leads_numero_bot') THEN
            ALTER TABLE integracao.leads ADD CONSTRAINT fk_leads_numero_bot
              FOREIGN KEY (numero_bot_id) REFERENCES integracao.numeros_bot(id) NOT VALID;
          END IF;
        END $$
    """)

    op.execute("ALTER TABLE integracao.mensagens ADD COLUMN IF NOT EXISTS numero_bot_id UUID")
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_mensagens_numero_provider_msg
        ON integracao.mensagens (numero_bot_id, provider_msg_id)
        WHERE numero_bot_id IS NOT NULL AND provider_msg_id IS NOT NULL
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_mensagens_numero_bot_id ON integracao.mensagens (numero_bot_id)")
    op.execute("""
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mensagens_numero_bot') THEN
            ALTER TABLE integracao.mensagens ADD CONSTRAINT fk_mensagens_numero_bot
              FOREIGN KEY (numero_bot_id) REFERENCES integracao.numeros_bot(id) NOT VALID;
          END IF;
        END $$
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE integracao.mensagens DROP CONSTRAINT IF EXISTS fk_mensagens_numero_bot")
    op.execute("DROP INDEX IF EXISTS integracao.uq_mensagens_numero_provider_msg")
    op.execute("DROP INDEX IF EXISTS integracao.ix_mensagens_numero_bot_id")
    op.execute("ALTER TABLE integracao.mensagens DROP COLUMN IF EXISTS numero_bot_id")
    op.execute("ALTER TABLE integracao.leads DROP CONSTRAINT IF EXISTS fk_leads_numero_bot")
    op.execute("DROP INDEX IF EXISTS integracao.uq_leads_cliente_numero_whatsapp_ativo")
    op.execute("DROP INDEX IF EXISTS integracao.ix_leads_numero_bot_id")
    op.execute("DROP INDEX IF EXISTS integracao.uq_leads_cliente_whatsapp_ativo_legacy")
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_cliente_whatsapp_ativo
        ON integracao.leads (cliente_id, whatsapp) WHERE ativo = true
    """)
    op.execute("ALTER TABLE integracao.leads DROP COLUMN IF EXISTS numero_bot_id")
    op.execute("DROP INDEX IF EXISTS integracao.uq_numeros_bot_token_digest")
    op.execute("DROP INDEX IF EXISTS integracao.uq_numeros_bot_provider_instance")
    op.execute("""
        ALTER TABLE integracao.numeros_bot
            DROP COLUMN IF EXISTS last_analysis_at,
            DROP COLUMN IF EXISTS last_message_at,
            DROP COLUMN IF EXISTS sync_state,
            DROP COLUMN IF EXISTS analysis_enabled,
            DROP COLUMN IF EXISTS sync_enabled,
            DROP COLUMN IF EXISTS connection_generation,
            DROP COLUMN IF EXISTS token_digest,
            DROP COLUMN IF EXISTS token_encrypted,
            DROP COLUMN IF EXISTS provider_instance_id
    """)
