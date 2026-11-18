"""PostgreSQL coverage for migration 0019's scoped lead identity change."""
from __future__ import annotations

import importlib.util
import os
import sys
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool


os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("DATABASE_URL_SYNC", "postgresql://test:test@localhost/test")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.models
from app.core.database import Base
from app.models.lead import Lead
from app.models.numero import NumeroBot
from app.models.tenant import Cliente


MIGRATION_PATH = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "0019_number_scoped_lead_constraint.py"
GLOBAL_CONSTRAINT = "leads_cliente_id_whatsapp_key"
LEGACY_INDEX = "uq_leads_cliente_whatsapp_ativo_legacy"
SCOPED_INDEX = "uq_leads_cliente_numero_whatsapp_ativo"


def _migration_module():
    spec = importlib.util.spec_from_file_location("migration_0019_test", MIGRATION_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load migration 0019")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@unittest.skipUnless(os.getenv("X9_TEST_DATABASE_URL"), "Disposable PostgreSQL required")
class NumberScopedLeadConstraintMigrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        url = os.environ["X9_TEST_DATABASE_URL"]
        if not url.rsplit("/", 1)[-1].startswith("x9_sync_test"):
            raise RuntimeError("Refusing non-test database")
        self.engine = create_async_engine(url, poolclass=NullPool, hide_parameters=True)
        async with self.engine.begin() as connection:
            for schema in ("integracao", "analise", "logs"):
                await connection.execute(text("CREATE SCHEMA IF NOT EXISTS " + schema))
            await connection.run_sync(Base.metadata.create_all)
            await connection.execute(text("ALTER TABLE integracao.leads DROP CONSTRAINT IF EXISTS " + GLOBAL_CONSTRAINT))
            await connection.execute(text("DROP INDEX IF EXISTS integracao." + LEGACY_INDEX))
            await connection.execute(text("ALTER TABLE integracao.leads ADD CONSTRAINT " + GLOBAL_CONSTRAINT + " UNIQUE (cliente_id, whatsapp)"))
            await connection.execute(text("CREATE UNIQUE INDEX " + LEGACY_INDEX + " ON integracao.leads (cliente_id, whatsapp) WHERE ativo = true AND numero_bot_id IS NULL"))
        self.db = async_sessionmaker(self.engine, expire_on_commit=False)()
        await self.db.begin()

    async def asyncTearDown(self) -> None:
        await self.db.rollback()
        await self.db.close()
        async with self.engine.begin() as connection:
            await connection.execute(text("ALTER TABLE integracao.leads DROP CONSTRAINT IF EXISTS " + GLOBAL_CONSTRAINT))
            await connection.execute(text("DROP INDEX IF EXISTS integracao." + LEGACY_INDEX))
        await self.engine.dispose()

    async def _upgrade(self) -> None:
        module = _migration_module()

        def run_upgrade(connection) -> None:
            with Operations.context(MigrationContext.configure(connection)):
                module.upgrade()

        connection = await self.db.connection()
        await connection.run_sync(run_upgrade)

    async def _has_constraint(self) -> bool:
        return bool(await self.db.scalar(text("SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'integracao.leads'::regclass AND conname = :name)"), {"name": GLOBAL_CONSTRAINT}))

    async def test_guard_scoped_identity_and_replay(self) -> None:
        suffix = uuid.uuid4().hex
        tenant = Cliente(nome="Synthetic", slug="constraint_" + suffix, nicho="automotivo", plano="basico")
        self.db.add(tenant)
        await self.db.flush()
        first = NumeroBot(cliente_id=tenant.id, numero="5511000000001")
        second = NumeroBot(cliente_id=tenant.id, numero="5511000000002")
        self.db.add_all((first, second))
        await self.db.flush()
        contact = "5511999999999"
        legacy = Lead(cliente_id=tenant.id, whatsapp=contact, ativo=True)
        self.db.add(legacy)
        await self.db.flush()
        legacy_id = legacy.id

        with self.assertRaises(IntegrityError):
            async with self.db.begin_nested():
                self.db.add(Lead(cliente_id=tenant.id, numero_bot_id=first.id, whatsapp=contact, ativo=True))
                await self.db.flush()

        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(RuntimeError):
                await self._upgrade()
        self.assertTrue(await self._has_constraint())

        with patch.dict(os.environ, {"X9_LEGACY_INGESTION_RETIRED": "true"}, clear=False):
            await self._upgrade()
            await self._upgrade()
        self.assertFalse(await self._has_constraint())
        for index_name in (LEGACY_INDEX, SCOPED_INDEX):
            with self.subTest(index=index_name):
                self.assertTrue(await self.db.scalar(text("SELECT to_regclass(:name) IS NOT NULL"), {"name": "integracao." + index_name}))

        persisted_legacy = await self.db.get(Lead, legacy_id, populate_existing=True)
        self.assertIsNotNone(persisted_legacy)
        self.assertIsNone(persisted_legacy.numero_bot_id)
        first_lead = Lead(cliente_id=tenant.id, numero_bot_id=first.id, whatsapp=contact, ativo=True)
        second_lead = Lead(cliente_id=tenant.id, numero_bot_id=second.id, whatsapp=contact, ativo=True)
        self.db.add_all((first_lead, second_lead))
        await self.db.flush()

        replay = pg_insert(Lead).values(id=uuid.uuid4(), cliente_id=tenant.id, numero_bot_id=first.id, whatsapp=contact, ativo=True).on_conflict_do_update(index_elements=[Lead.cliente_id, Lead.numero_bot_id, Lead.whatsapp], index_where=text("ativo = true AND numero_bot_id IS NOT NULL"), set_={"nome": "Replay"}).returning(Lead.id)
        self.assertEqual((await self.db.execute(replay)).scalar_one(), first_lead.id)
        self.assertEqual(await self.db.scalar(select(func.count()).select_from(Lead).where(Lead.numero_bot_id == first.id, Lead.whatsapp == contact)), 1)
