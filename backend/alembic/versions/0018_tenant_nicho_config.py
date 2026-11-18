"""Create per-tenant niche field overrides and snapshot current behavior.

Revision ID: 0018
Revises: 0017
Create Date: 2026-10-28
"""
from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS analise")
    op.execute("""
        CREATE TABLE IF NOT EXISTS analise.tenant_nicho_config (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            cliente_id UUID NOT NULL
                REFERENCES integracao.clientes(id) ON DELETE CASCADE,
            nicho VARCHAR(100) NOT NULL,
            campos_kpi JSONB NOT NULL DEFAULT '[]'::jsonb,
            campos_analise JSONB NOT NULL DEFAULT '[]'::jsonb,
            updated_by UUID NULL
                REFERENCES public.users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_tenant_nicho_config_cliente_nicho UNIQUE (cliente_id, nicho)
        )
    """)
    # Preserve the current effective values for existing tenants before future edits diverge.
    op.execute("""
        INSERT INTO analise.tenant_nicho_config (
            id, cliente_id, nicho, campos_kpi, campos_analise, updated_by, created_at, updated_at
        )
        SELECT gen_random_uuid(), c.id, n.nicho, n.campos_kpi, n.campos_analise, NULL, now(), now()
        FROM integracao.clientes AS c
        JOIN analise.nicho_config AS n ON n.nicho = c.nicho
        ON CONFLICT (cliente_id, nicho) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS analise.tenant_nicho_config")
