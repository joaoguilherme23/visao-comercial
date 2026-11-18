"""PostgreSQL integration coverage for number-scoped webhook ingestion."""
import os
import sys
import unittest
import uuid
from datetime import datetime, timezone
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("DATABASE_URL_SYNC", "postgresql://test:test@localhost/test")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.models
from app.core.database import Base
from app.models.analysis_job import AnalysisJob
from app.models.lead import Lead
from app.models.message import Mensagem
from app.models.numero import NumeroBot
from app.models.tenant import Cliente
from app.services.uazapi_webhook import process_uazapi_event


@unittest.skipUnless(os.getenv("X9_TEST_DATABASE_URL"), "Disposable PostgreSQL required")
class IngestionDatabaseTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        url = os.environ["X9_TEST_DATABASE_URL"]
        if not url.rsplit("/", 1)[-1].startswith("x9_sync_test"):
            raise RuntimeError("Refusing non-test database")
        self.engine = create_async_engine(url, poolclass=NullPool, hide_parameters=True)
        async with self.engine.begin() as connection:
            for schema in ("integracao", "analise", "logs"):
                await connection.execute(text("CREATE SCHEMA IF NOT EXISTS " + schema))
            await connection.run_sync(Base.metadata.create_all)
        self.db = async_sessionmaker(self.engine, expire_on_commit=False)()
        await self.db.begin()

    async def asyncTearDown(self) -> None:
        await self.db.rollback()
        await self.db.close()
        await self.engine.dispose()

    async def _bot(self, tenant: Cliente, number: str) -> NumeroBot:
        bot = NumeroBot(cliente_id=tenant.id, numero=number, sync_enabled=True, analysis_enabled=True, sync_state="sync_enabled")
        self.db.add(bot)
        await self.db.flush()
        return bot

    async def test_groups_replay_tenants_numbers_and_lid_are_isolated(self) -> None:
        suffix = uuid.uuid4().hex
        first, second = (
            Cliente(nome="A", slug="ing_a_" + suffix, nicho="automotivo", plano="basico"),
            Cliente(nome="B", slug="ing_b_" + suffix, nicho="automotivo", plano="basico"),
        )
        self.db.add_all([first, second])
        await self.db.flush()
        bot_a, bot_b, bot_other = await self._bot(first, "5511000000001"), await self._bot(first, "5511000000002"), await self._bot(second, "5511000000003")
        now = int(datetime.now(timezone.utc).timestamp() * 1000)
        def payload(message_id: str, chat: str, group: bool = False) -> dict:
            return {"EventType": "history", "event": "messages", "messages": [{"messageid": message_id, "chatid": chat, "messageTimestamp": now, "messageType": "conversation", "text": "oi", "isGroup": group}]}
        # A group in the batch is ignored; the adjacent individual message ingests.
        await process_uazapi_event(self.db, bot_a, {"EventType": "history", "event": "messages", "messages": [payload("ignored", "1@g.us", True)["messages"][0], payload("same", "5511999999999@s.whatsapp.net")["messages"][0]]})
        await process_uazapi_event(self.db, bot_a, payload("same", "5511999999999@s.whatsapp.net"))  # replay
        await process_uazapi_event(self.db, bot_b, payload("same", "5511999999999@s.whatsapp.net"))
        await process_uazapi_event(self.db, bot_other, payload("same", "5511999999999@s.whatsapp.net"))
        await process_uazapi_event(self.db, bot_a, payload("lid", "5511999999999@lid"))
        bot_ids = (bot_a.id, bot_b.id, bot_other.id)
        messages = await self.db.scalar(
            select(func.count()).select_from(Mensagem).where(Mensagem.numero_bot_id.in_(bot_ids))
        )
        jobs = await self.db.scalar(
            select(func.count()).select_from(AnalysisJob).where(AnalysisJob.numero_bot_id.in_(bot_ids))
        )
        leads = list((await self.db.execute(select(Lead).where(Lead.numero_bot_id == bot_a.id))).scalars())
        self.assertEqual(messages, 4)
        self.assertEqual(jobs, 4)
        self.assertEqual({lead.whatsapp for lead in leads}, {"5511999999999", "lid:5511999999999"})
