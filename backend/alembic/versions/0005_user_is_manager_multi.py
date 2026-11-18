"""adiciona coluna users.is_manager_multi

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-28

Adiciona flag is_manager_multi em public.users para suportar o perfil
"Gestor Multi-Empresa": usuário que enxerga portfolio agregado das N
empresas que tem acesso (via user_tenants), mas que NÃO pode criar
tenant novo (continua sendo prerrogativa só do superadmin).

A flag é independente de is_superadmin e independente do role por tenant
(que continua admin/manager/viewer em user_tenants).
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Adiciona coluna NOT NULL com DEFAULT FALSE — backfill automático
    # em registros existentes sem precisar de UPDATE em separado.
    op.execute("""
        ALTER TABLE public.users
        ADD COLUMN IF NOT EXISTS is_manager_multi BOOLEAN NOT NULL DEFAULT FALSE
    """)

    # Índice parcial só nos usuários que SÃO manager_multi.
    # Acelera o filtro "listar gestores" no admin sem inflar o índice
    # com 99% de FALSEs.
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_users_is_manager_multi
        ON public.users (is_manager_multi)
        WHERE is_manager_multi = TRUE
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS public.ix_users_is_manager_multi")
    op.execute("ALTER TABLE public.users DROP COLUMN IF EXISTS is_manager_multi")
