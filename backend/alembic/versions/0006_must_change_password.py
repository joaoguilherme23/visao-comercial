"""adiciona coluna users.must_change_password

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-30

Adiciona flag must_change_password em public.users. Usada quando o
"Cliente" (gestor multi-empresa) cria um usuário Consultor pra dar
acesso a uma das empresas — o consultor recebe a senha provisória do
cliente e é forçado a trocar no próximo login.

Frontend tem guard RequireMustChange que redireciona pra /change-password
antes de qualquer outra rota protegida; backend tem POST /auth/change-password
que limpa a flag depois de trocar.
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE public.users
        ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE public.users DROP COLUMN IF EXISTS must_change_password")
