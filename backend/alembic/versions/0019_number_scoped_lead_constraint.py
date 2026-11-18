"""Remove the obsolete global lead identity constraint.

Revision ID: 0019
Revises: 0018
"""
import os

from alembic import op


revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None

_GUARD = "X9_LEGACY_INGESTION_RETIRED"
_CONSTRAINT = "leads_cliente_id_whatsapp_key"
_DEFINITION = "UNIQUE (cliente_id, whatsapp)"


def upgrade() -> None:
    """Remove global identity only after the external legacy ingestion ends."""
    if os.getenv(_GUARD, "").strip().lower() != "true":
        raise RuntimeError(f"Refusing migration 0019 until {_GUARD}=true")

    # PostgreSQL DDL is transactional. Both partial unique indexes created by
    # 0016 are intentionally left untouched.
    op.execute(f"""
        DO $$
        DECLARE existing_definition TEXT;
        BEGIN
            SELECT pg_get_constraintdef(constraint_row.oid)
              INTO existing_definition
              FROM pg_constraint AS constraint_row
             WHERE constraint_row.conrelid = 'integracao.leads'::regclass
               AND constraint_row.conname = '{_CONSTRAINT}';
            IF existing_definition IS NOT NULL THEN
                IF existing_definition <> '{_DEFINITION}' THEN
                    RAISE EXCEPTION 'Refusing to drop unexpected constraint %: %',
                        '{_CONSTRAINT}', existing_definition;
                END IF;
                ALTER TABLE integracao.leads
                    DROP CONSTRAINT leads_cliente_id_whatsapp_key;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    """Restore global uniqueness only when historical rows permit it."""
    op.execute(f"""
        DO $$
        DECLARE existing_definition TEXT;
        BEGIN
            IF EXISTS (
                SELECT 1 FROM integracao.leads
                GROUP BY cliente_id, whatsapp HAVING count(*) > 1
            ) THEN
                RAISE EXCEPTION
                    'Refusing migration 0019 downgrade: global lead duplicates exist';
            END IF;
            SELECT pg_get_constraintdef(constraint_row.oid)
              INTO existing_definition
              FROM pg_constraint AS constraint_row
             WHERE constraint_row.conrelid = 'integracao.leads'::regclass
               AND constraint_row.conname = '{_CONSTRAINT}';
            IF existing_definition IS NULL THEN
                ALTER TABLE integracao.leads
                    ADD CONSTRAINT leads_cliente_id_whatsapp_key
                    UNIQUE (cliente_id, whatsapp);
            ELSIF existing_definition <> '{_DEFINITION}' THEN
                RAISE EXCEPTION 'Refusing to keep unexpected constraint %: %',
                    '{_CONSTRAINT}', existing_definition;
            END IF;
        END $$;
    """)
