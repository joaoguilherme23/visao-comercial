"""PostgreSQL coverage for Kanban conversation identity and attendant filters."""
from __future__ import annotations

import os
import sys
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path


os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("DATABASE_URL_SYNC", "postgresql://test:test@localhost/test")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.models
from app.core.database import Base
from app.models.lead import Lead
from app.models.message import Mensagem
from app.models.numero import NumeroBot
from app.models.tenant import Cliente
from app.routers.kanban import get_conversations


@unittest.skipUnless(os.getenv("X9_TEST_DATABASE_URL"), "Disposable PostgreSQL required")
class KanbanConversationsIntegration(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        url = os.environ["X9_TEST_DATABASE_URL"]
        if not url.rsplit("/", 1)[-1].startswith("x9_sync_test"):
            raise RuntimeError("Refusing to run integration tests on a non-test database")
        self.engine = create_async_engine(url, poolclass=NullPool, hide_parameters=True)
        async with self.engine.begin() as conn:
            for schema in ("integracao", "analise", "logs"):
                await conn.execute(text("CREATE SCHEMA IF NOT EXISTS " + schema))
            await conn.run_sync(Base.metadata.create_all)
        self.db = async_sessionmaker(self.engine, expire_on_commit=False)()
        await self.db.begin()

    async def asyncTearDown(self) -> None:
        await self.db.rollback()
        await self.db.close()
        await self.engine.dispose()

    async def test_same_contact_on_two_numbers_remains_visible_and_filterable(self) -> None:
        suffix = uuid.uuid4().hex
        tenant = Cliente(nome="Synthetic", slug="kanban_" + suffix, nicho="automotivo", plano="basico")
        self.db.add(tenant)
        await self.db.flush()

        first_bot = NumeroBot(cliente_id=tenant.id, numero="5511000000001")
        second_bot = NumeroBot(cliente_id=tenant.id, numero="5511000000002")
        self.db.add_all((first_bot, second_bot))
        await self.db.flush()

        contact = "5511999999999"
        first_lead = Lead(
            cliente_id=tenant.id,
            numero_bot_id=first_bot.id,
            telefone_bot=first_bot.numero,
            whatsapp=contact,
            nome="Contato no primeiro número",
        )
        second_lead = Lead(
            cliente_id=tenant.id,
            numero_bot_id=second_bot.id,
            telefone_bot=second_bot.numero,
            whatsapp=contact,
            nome="Contato no segundo número",
        )
        self.db.add_all((first_lead, second_lead))
        await self.db.flush()

        now = datetime.now(timezone.utc)
        self.db.add_all((
            Mensagem(
                cliente_id=tenant.id,
                numero_bot_id=first_bot.id,
                lead_id=first_lead.id,
                direcao="entrada",
                tipo="texto",
                conteudo="primeira conversa",
                provider_msg_id="first-" + suffix,
                enviada_em=now - timedelta(minutes=1),
            ),
            Mensagem(
                cliente_id=tenant.id,
                numero_bot_id=second_bot.id,
                lead_id=second_lead.id,
                direcao="entrada",
                tipo="texto",
                conteudo="segunda conversa",
                provider_msg_id="second-" + suffix,
                enviada_em=now,
            ),
        ))
        await self.db.flush()

        all_conversations = await get_conversations(
            cliente_id=tenant.id,
            data_inicio=None,
            data_fim=None,
            temperatura=None,
            etapa_funil=None,
            sentimento=None,
            telefone_bot=None,
            search=None,
            offset=0,
            limit=100,
            db=self.db,
            current_user=None,
            _=None,
        )
        self.assertEqual(all_conversations.total, 2)
        self.assertEqual({item.lead_id for item in all_conversations.items}, {first_lead.id, second_lead.id})

        first_number_conversations = await get_conversations(
            cliente_id=tenant.id,
            data_inicio=None,
            data_fim=None,
            temperatura=None,
            etapa_funil=None,
            sentimento=None,
            telefone_bot=first_bot.numero,
            search=None,
            offset=0,
            limit=100,
            db=self.db,
            current_user=None,
            _=None,
        )
        self.assertEqual(first_number_conversations.total, 1)
        self.assertEqual(first_number_conversations.items[0].lead_id, first_lead.id)

        second_number_conversations = await get_conversations(
            cliente_id=tenant.id,
            data_inicio=None,
            data_fim=None,
            temperatura=None,
            etapa_funil=None,
            sentimento=None,
            telefone_bot=second_bot.numero,
            search=None,
            offset=0,
            limit=100,
            db=self.db,
            current_user=None,
            _=None,
        )
        self.assertEqual(second_number_conversations.total, 1)
        self.assertEqual(second_number_conversations.items[0].lead_id, second_lead.id)
