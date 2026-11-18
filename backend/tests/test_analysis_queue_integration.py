"""PostgreSQL-only coverage for queue isolation, replay and ordering."""

import asyncio
import os
import unittest
import uuid
from datetime import date, datetime, timedelta, timezone

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("DATABASE_URL_SYNC", "postgresql://test:test@localhost/test")

from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.models
from app.core.database import Base
from app.models.analysis import Analise
from app.models.analysis_job import AnalysisJob
from app.models.lead import Lead
from app.models.message import Mensagem
from app.models.numero import NumeroBot
from app.models.tenant import Cliente
from app.schemas.internal_analysis import AnalysisResultInput
from app.services.analysis_queue import (
    AnalysisJobConflict,
    LEASED,
    SUPERSEDED,
    build_analysis_context,
    claim_due_jobs,
    complete_analysis_job,
    enqueue_analysis,
    enqueue_analysis_backlog,
    prepare_dispatch,
)


@unittest.skipUnless(os.getenv("X9_TEST_DATABASE_URL"), "Disposable PostgreSQL required")
class AnalysisQueueIntegration(unittest.IsolatedAsyncioTestCase):
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

    async def _conversation(self, tenant: Cliente, number: str) -> tuple[NumeroBot, Lead]:
        bot = NumeroBot(cliente_id=tenant.id, numero=number, analysis_enabled=True, sync_enabled=True)
        self.db.add(bot)
        await self.db.flush()
        lead = Lead(cliente_id=tenant.id, numero_bot_id=bot.id, whatsapp="5511999999999", ativo=True)
        self.db.add(lead)
        await self.db.flush()
        return bot, lead

    async def _message(self, tenant: Cliente, bot: NumeroBot, lead: Lead, at: datetime, provider_id: str) -> Mensagem:
        message = Mensagem(
            cliente_id=tenant.id, numero_bot_id=bot.id, lead_id=lead.id,
            direcao="entrada", tipo="texto", conteudo="teste", provider_msg_id=provider_id,
            enviada_em=at,
        )
        self.db.add(message)
        await self.db.flush()
        return message

    async def test_mesmo_contato_e_provider_em_numeros_nao_vazam_tenant(self) -> None:
        suffix = uuid.uuid4().hex
        tenant_a = Cliente(nome="A", slug="a_" + suffix, nicho="automotivo", plano="basico")
        tenant_b = Cliente(nome="B", slug="b_" + suffix, nicho="automotivo", plano="basico")
        self.db.add_all([tenant_a, tenant_b])
        await self.db.flush()
        bot_a, lead_a = await self._conversation(tenant_a, "5511000000001")
        bot_a2, lead_a2 = await self._conversation(tenant_a, "5511000000009")
        bot_b, lead_b = await self._conversation(tenant_b, "5511000000002")
        now = datetime.now(timezone.utc)
        msg_a = await self._message(tenant_a, bot_a, lead_a, now, "provider-same")
        msg_a2 = await self._message(tenant_a, bot_a2, lead_a2, now, "provider-same")
        msg_b = await self._message(tenant_b, bot_b, lead_b, now, "provider-same")
        first = await enqueue_analysis(self.db, cliente_id=tenant_a.id, numero_bot_id=bot_a.id, lead_id=lead_a.id, message_id=msg_a.id, connection_generation=bot_a.connection_generation)
        replay = await enqueue_analysis(self.db, cliente_id=tenant_a.id, numero_bot_id=bot_a.id, lead_id=lead_a.id, message_id=msg_a.id, connection_generation=bot_a.connection_generation)
        same_tenant_other_number = await enqueue_analysis(self.db, cliente_id=tenant_a.id, numero_bot_id=bot_a2.id, lead_id=lead_a2.id, message_id=msg_a2.id, connection_generation=bot_a2.connection_generation)
        second = await enqueue_analysis(self.db, cliente_id=tenant_b.id, numero_bot_id=bot_b.id, lead_id=lead_b.id, message_id=msg_b.id, connection_generation=bot_b.connection_generation)
        self.assertIsNotNone(first)
        self.assertEqual(first.id, replay.id)
        self.assertIsNotNone(second)
        self.assertIsNotNone(same_tenant_other_number)
        self.assertNotEqual(first.id, second.id)
        self.assertNotEqual(first.id, same_tenant_other_number.id)
        self.assertEqual(first.cliente_id, tenant_a.id)
        self.assertEqual(second.cliente_id, tenant_b.id)

    async def test_mensagem_atrasada_nao_substitui_watermark_da_conversa(self) -> None:
        suffix = uuid.uuid4().hex
        tenant = Cliente(nome="A", slug="order_" + suffix, nicho="automotivo", plano="basico")
        self.db.add(tenant)
        await self.db.flush()
        bot, lead = await self._conversation(tenant, "5511000000003")
        now = datetime.now(timezone.utc)
        newest = await self._message(tenant, bot, lead, now, "new-" + suffix)
        oldest = await self._message(tenant, bot, lead, now - timedelta(minutes=1), "old-" + suffix)
        current = await enqueue_analysis(self.db, cliente_id=tenant.id, numero_bot_id=bot.id, lead_id=lead.id, message_id=newest.id, connection_generation=bot.connection_generation)
        stale = await enqueue_analysis(self.db, cliente_id=tenant.id, numero_bot_id=bot.id, lead_id=lead.id, message_id=oldest.id, connection_generation=bot.connection_generation)
        self.assertNotEqual(current.id, stale.id)
        self.assertNotEqual(current.status, SUPERSEDED)
        self.assertEqual(stale.status, SUPERSEDED)
        stored = await self.db.get(AnalysisJob, stale.id)
        self.assertEqual(stored.last_error_code, "out_of_order_message")

    async def test_backlog_expansao_e_limitado_ao_numero_e_ignora_analises_reais(self) -> None:
        suffix = uuid.uuid4().hex
        tenant = Cliente(nome="A", slug="backlog_" + suffix, nicho="automotivo", plano="basico")
        self.db.add(tenant)
        await self.db.flush()
        bot, eligible = await self._conversation(tenant, "5511000000008")
        eligible.whatsapp = "55118888" + suffix[:4]
        eligible.temperatura = "quente"
        analyzed = Lead(
            cliente_id=tenant.id, numero_bot_id=bot.id,
            whatsapp="55117777" + suffix[:4], ativo=True,
        )
        legacy = Lead(cliente_id=tenant.id, whatsapp="55116666" + suffix[:4], ativo=True)
        self.db.add_all([analyzed, legacy])
        await self.db.flush()
        now = datetime.now(timezone.utc)
        for index in range(5):
            await self._message(tenant, bot, eligible, now + timedelta(seconds=index), f"eligible-{suffix}-{index}")
            await self._message(tenant, bot, analyzed, now + timedelta(seconds=index), f"analyzed-{suffix}-{index}")
        self.db.add(Analise(
            cliente_id=tenant.id, numero_bot_id=bot.id, lead_id=analyzed.id,
            data_ref=date.today(), modelo_ia="modelo-real",
        ))
        jobs = await enqueue_analysis_backlog(
            self.db, cliente_id=tenant.id, numero_bot_id=bot.id, limit=10,
        )
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0].lead_id, eligible.id)
        self.assertEqual(jobs[0].numero_bot_id, bot.id)
        replay = await enqueue_analysis_backlog(
            self.db, cliente_id=tenant.id, numero_bot_id=bot.id, limit=10,
        )
        self.assertEqual(replay, [])

    async def test_contexto_prioriza_a_ultima_mensagem_no_limite_de_caracteres(self) -> None:
        suffix = uuid.uuid4().hex
        tenant = Cliente(nome="A", slug="context_" + suffix, nicho="automotivo", plano="basico")
        self.db.add(tenant)
        await self.db.flush()
        bot, lead = await self._conversation(tenant, "5511000000004")
        now = datetime.now(timezone.utc)
        await self._message(tenant, bot, lead, now - timedelta(seconds=1), "old-" + suffix)
        # Atualiza conteúdo da primeira mensagem sem aumentar a superfície do helper.
        old = (await self.db.execute(text("SELECT id FROM integracao.mensagens WHERE lead_id = :lead ORDER BY enviada_em LIMIT 1"), {"lead": lead.id})).scalar_one()
        await self.db.execute(text("UPDATE integracao.mensagens SET conteudo = :body WHERE id = :id"), {"body": "a" * 20_000, "id": old})
        newest = await self._message(tenant, bot, lead, now, "new-" + suffix)
        await enqueue_analysis(self.db, cliente_id=tenant.id, numero_bot_id=bot.id, lead_id=lead.id, message_id=newest.id, connection_generation=bot.connection_generation)
        claims = await claim_due_jobs(self.db, limit=1)
        dispatch = await prepare_dispatch(self.db, claims[0])
        context = await build_analysis_context(self.db, job_id=dispatch.job_id, token=dispatch.token)
        self.assertEqual(context.messages[-1].content, "teste")

    @staticmethod
    def _result() -> AnalysisResultInput:
        return AnalysisResultInput.model_validate({
            "resumo_curto": "ok", "sentimento": "neutro", "score_interesse": 5.0,
            "intencao": "duvida", "proximo_passo": "retornar",
        })

    async def test_callback_concorrente_persiste_uma_analise(self) -> None:
        suffix = uuid.uuid4().hex
        tenant = Cliente(nome="A", slug="race_" + suffix, nicho="automotivo", plano="basico")
        self.db.add(tenant)
        await self.db.flush()
        bot, lead = await self._conversation(tenant, "5511000000005")
        message = await self._message(tenant, bot, lead, datetime.now(timezone.utc), "race-" + suffix)
        await enqueue_analysis(self.db, cliente_id=tenant.id, numero_bot_id=bot.id, lead_id=lead.id, message_id=message.id, connection_generation=bot.connection_generation)
        dispatch = await prepare_dispatch(self.db, (await claim_due_jobs(self.db, limit=1))[0])
        await self.db.commit()

        factory = async_sessionmaker(self.engine, expire_on_commit=False)
        async def callback() -> bool:
            async with factory() as session:
                async with session.begin():
                    response = await complete_analysis_job(session, job_id=dispatch.job_id, token=dispatch.token, result=self._result())
                    return response.idempotent
        outcomes = await asyncio.gather(callback(), callback())
        async with factory() as session:
            job = await session.get(AnalysisJob, dispatch.job_id)
            analyses = await session.scalar(
                select(func.count()).select_from(Analise).where(Analise.lead_id == lead.id)
            )
        self.assertEqual(job.analysis_id is not None, True)
        self.assertEqual(analyses, 1)
        self.assertIn(True, outcomes)

    async def test_tenant_revogado_apos_dispatch_rejeita_persistencia(self) -> None:
        suffix = uuid.uuid4().hex
        tenant = Cliente(nome="A", slug="disabled_" + suffix, nicho="automotivo", plano="basico")
        self.db.add(tenant)
        await self.db.flush()
        bot, lead = await self._conversation(tenant, "5511000000006")
        message = await self._message(tenant, bot, lead, datetime.now(timezone.utc), "disabled-" + suffix)
        await enqueue_analysis(self.db, cliente_id=tenant.id, numero_bot_id=bot.id, lead_id=lead.id, message_id=message.id, connection_generation=bot.connection_generation)
        dispatch = await prepare_dispatch(self.db, (await claim_due_jobs(self.db, limit=1))[0])
        tenant.ativo = False
        with self.assertRaises(AnalysisJobConflict):
            await complete_analysis_job(self.db, job_id=dispatch.job_id, token=dispatch.token, result=self._result())

    async def test_lease_expirado_e_retomado_com_nova_tentativa(self) -> None:
        suffix = uuid.uuid4().hex
        tenant = Cliente(nome="A", slug="retry_" + suffix, nicho="automotivo", plano="basico")
        self.db.add(tenant)
        await self.db.flush()
        bot, lead = await self._conversation(tenant, "5511000000007")
        message = await self._message(tenant, bot, lead, datetime.now(timezone.utc), "retry-" + suffix)
        job = await enqueue_analysis(self.db, cliente_id=tenant.id, numero_bot_id=bot.id, lead_id=lead.id, message_id=message.id, connection_generation=bot.connection_generation)
        first = (await claim_due_jobs(self.db, limit=1))[0]
        self.assertEqual(job.status, LEASED)
        await self.db.execute(
            update(AnalysisJob).where(AnalysisJob.id == first.job_id).values(
                lease_expires_at=datetime.now(timezone.utc) - timedelta(seconds=1)
            )
        )
        second = (await claim_due_jobs(self.db, limit=1))[0]
        await self.db.refresh(job)
        self.assertNotEqual(first.lease_id, second.lease_id)
        self.assertEqual(job.attempts, 2)
