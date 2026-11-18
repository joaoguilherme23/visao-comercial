"""add opaque OIDC BFF session tables

Revision ID: 0020
Revises: 0019
"""
from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Estrutura apenas; bootstrap e migração de dados são operações separadas.
    op.execute("CREATE SCHEMA IF NOT EXISTS public")
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.oidc_login_transactions (
            id UUID PRIMARY KEY, state_hash VARCHAR(64) NOT NULL UNIQUE,
            browser_binding_hash VARCHAR(64) NOT NULL, nonce VARCHAR(128) NOT NULL,
            code_verifier VARCHAR(128) NOT NULL, return_to VARCHAR(512) NOT NULL DEFAULT '/',
            expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.oidc_identity_links (
            id UUID PRIMARY KEY, issuer VARCHAR(512) NOT NULL, subject VARCHAR(512) NOT NULL,
            central_local_user_id VARCHAR(128) NOT NULL UNIQUE,
            user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
            is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_oidc_identity_issuer_subject UNIQUE (issuer, subject)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.oidc_application_sessions (
            id UUID PRIMARY KEY, token_hash VARCHAR(64) NOT NULL UNIQUE,
            csrf_secret VARCHAR(128) NOT NULL,
            user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
            central_local_user_id VARCHAR(128) NOT NULL, session_ref VARCHAR(256) NOT NULL UNIQUE,
            expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_oidc_login_transactions_state_hash ON public.oidc_login_transactions(state_hash)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_oidc_application_sessions_token_hash ON public.oidc_application_sessions(token_hash)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_oidc_identity_links_user_id ON public.oidc_identity_links(user_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.oidc_application_sessions")
    op.execute("DROP TABLE IF EXISTS public.oidc_identity_links")
    op.execute("DROP TABLE IF EXISTS public.oidc_login_transactions")
