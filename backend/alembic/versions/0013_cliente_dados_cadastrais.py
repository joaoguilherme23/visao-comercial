"""adiciona dados cadastrais em integracao.clientes

Revision ID: 0013
Revises: 0012
Create Date: 2026-05-06

Campos novos pra cadastro completo da empresa cliente:
- cnpj (opcional, sem mascara, validado no frontend/backend)
- razao_social (nome juridico vs. nome fantasia)
- endereco estruturado (cep, logradouro, numero, complemento, bairro, cidade, uf)
- contatos JSONB (array de {tipo, telefone, email})
- responsavel_* (nome, cargo, email, telefone)
- foto_url (logo da empresa, path relativo /avatars/tenants/<id>/...)

Sem cliente_desde por enquanto — usar created_at conforme decisao.
"""
from alembic import op


revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE integracao.clientes
        ADD COLUMN IF NOT EXISTS cnpj                  VARCHAR(18)  NULL,
        ADD COLUMN IF NOT EXISTS razao_social          VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS endereco_cep          VARCHAR(10)  NULL,
        ADD COLUMN IF NOT EXISTS endereco_logradouro   VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS endereco_numero       VARCHAR(20)  NULL,
        ADD COLUMN IF NOT EXISTS endereco_complemento  VARCHAR(100) NULL,
        ADD COLUMN IF NOT EXISTS endereco_bairro       VARCHAR(100) NULL,
        ADD COLUMN IF NOT EXISTS endereco_cidade       VARCHAR(100) NULL,
        ADD COLUMN IF NOT EXISTS endereco_uf           VARCHAR(2)   NULL,
        ADD COLUMN IF NOT EXISTS contatos              JSONB        NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS responsavel_nome      VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS responsavel_cargo     VARCHAR(100) NULL,
        ADD COLUMN IF NOT EXISTS responsavel_email     VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS responsavel_telefone  VARCHAR(30)  NULL,
        ADD COLUMN IF NOT EXISTS foto_url              VARCHAR(500) NULL
    """)
    # Index parcial pra busca rapida por CNPJ (apenas nao-NULL)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_clientes_cnpj
        ON integracao.clientes (cnpj)
        WHERE cnpj IS NOT NULL
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS integracao.ix_clientes_cnpj")
    op.execute("""
        ALTER TABLE integracao.clientes
        DROP COLUMN IF EXISTS foto_url,
        DROP COLUMN IF EXISTS responsavel_telefone,
        DROP COLUMN IF EXISTS responsavel_email,
        DROP COLUMN IF EXISTS responsavel_cargo,
        DROP COLUMN IF EXISTS responsavel_nome,
        DROP COLUMN IF EXISTS contatos,
        DROP COLUMN IF EXISTS endereco_uf,
        DROP COLUMN IF EXISTS endereco_cidade,
        DROP COLUMN IF EXISTS endereco_bairro,
        DROP COLUMN IF EXISTS endereco_complemento,
        DROP COLUMN IF EXISTS endereco_numero,
        DROP COLUMN IF EXISTS endereco_logradouro,
        DROP COLUMN IF EXISTS endereco_cep,
        DROP COLUMN IF EXISTS razao_social,
        DROP COLUMN IF EXISTS cnpj
    """)
