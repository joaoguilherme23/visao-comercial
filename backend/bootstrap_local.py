"""Cria somente a estrutura inicial do PostgreSQL local para a demonstração."""

import asyncio

from sqlalchemy import text

from app.core.bootstrap import assert_local_database_target
from app.core.database import Base, engine
import app.models  # noqa: F401  # registra as tabelas no metadata


async def main() -> None:
    assert_local_database_target()
    async with engine.begin() as connection:
        for schema in ("public", "analise", "integracao", "logs"):
            await connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema}"))
        await connection.run_sync(Base.metadata.create_all)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
