"""adiciona coluna foto_url em leads e grupos

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-30

Adiciona foto_url em:
  - integracao.leads
  - integracao.grupos

URL relativa servida pelo nginx via /avatars/<tipo>/<id>/<ts>.<ext>.
Arquivo binário fica no storage local do container — NUNCA
no banco (BLOB em Postgres é anti-pattern: trava replicação, infla
backups, mata cache HTTP).

Política: foto_url é NULL quando o WhatsApp do contato não tem
foto pública OU sync ainda não rodou. Quem renderiza decide fallback
(inicial colorida do nome).
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # leads.foto_url
    op.execute("""
        ALTER TABLE integracao.leads
        ADD COLUMN IF NOT EXISTS foto_url VARCHAR(500) NULL
    """)
    # grupos.foto_url
    op.execute("""
        ALTER TABLE integracao.grupos
        ADD COLUMN IF NOT EXISTS foto_url VARCHAR(500) NULL
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE integracao.grupos DROP COLUMN IF EXISTS foto_url")
    op.execute("ALTER TABLE integracao.leads DROP COLUMN IF EXISTS foto_url")
