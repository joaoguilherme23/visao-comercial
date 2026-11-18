"""Guardas para o bootstrap exclusivo do ambiente local."""

from sqlalchemy.engine import make_url

from app.core.config import settings


def assert_local_database_target() -> None:
    """Impede que o bootstrap de demonstração aponte para um host remoto."""
    url = make_url(settings.DATABASE_URL)
    if url.host not in {"db", "localhost", "127.0.0.1"}:
        raise RuntimeError("Bootstrap recusado fora do banco local")
