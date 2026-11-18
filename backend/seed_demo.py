"""Dados idempotentes e exclusivamente sintéticos para a demonstração local."""

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.bootstrap import assert_local_database_target
from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.core.security import hash_password
from app.kpi_catalog import BUILTIN_KPIS
from app.models.dashboard import DashboardConfig, KpiCatalogo
from app.models.lead import Lead
from app.models.message import Mensagem
from app.models.tenant import Cliente
from app.models.user import User, UserRole, UserTenant


DEMO_LEADS = (
    ("Pessoa Alfa", "5511990000001", "novo", "quente", 9.0),
    ("Pessoa Beta", "5511990000002", "contato", "morno", 6.0),
    ("Pessoa Gama", "5511990000003", "proposta", "quente", 8.0),
    ("Pessoa Delta", "5511990000004", "negociacao", "morno", 7.0),
)


DEMO_KPI_SLUGS = (
    "total_leads", "leads_ativos", "score_medio", "pct_leads_identificados",
    "total_mensagens", "msgs_recebidas", "msgs_enviadas", "pct_msgs_recebidas",
)


async def main() -> None:
    assert_local_database_target()
    async with AsyncSessionLocal() as db:
        user = await db.scalar(select(User).where(User.email == settings.SUPERADMIN_EMAIL))
        if user is None:
            user = User(
                email=settings.SUPERADMIN_EMAIL,
                password_hash=hash_password(settings.SUPERADMIN_PASSWORD),
                nome=settings.SUPERADMIN_NOME,
                is_superadmin=True,
            )
            db.add(user)
            await db.flush()

        tenant = await db.scalar(select(Cliente).where(Cliente.slug == "demo-local"))
        if tenant is None:
            tenant = Cliente(
                nome="Operação Demonstração",
                slug="demo-local",
                nicho="demonstração",
                nome_agente="Assistente X9",
                config={},
            )
            db.add(tenant)
            await db.flush()

        access = await db.scalar(
            select(UserTenant).where(
                UserTenant.user_id == user.id,
                UserTenant.cliente_id == tenant.id,
            )
        )
        if access is None:
            db.add(UserTenant(user_id=user.id, cliente_id=tenant.id, role=UserRole.admin))

        existing_lead = await db.scalar(select(Lead.id).where(Lead.cliente_id == tenant.id).limit(1))
        if existing_lead is None:
            now = datetime.now(timezone.utc)
            for index, (name, phone, stage, temperature, score) in enumerate(DEMO_LEADS):
                lead = Lead(
                    cliente_id=tenant.id,
                    whatsapp=phone,
                    nome=name,
                    origem="demonstração",
                    etapa_funil=stage,
                    temperatura=temperature,
                    score=score,
                    extras={"synthetic": True},
                )
                db.add(lead)
                await db.flush()
                db.add_all([
                    Mensagem(
                        cliente_id=tenant.id, lead_id=lead.id, direcao="entrada", tipo="texto",
                        conteudo="Olá, gostaria de conhecer a demonstração.",
                        enviada_em=now - timedelta(minutes=20 - index),
                    ),
                    Mensagem(
                        cliente_id=tenant.id, lead_id=lead.id, direcao="saida", tipo="texto",
                        conteudo="Esta é uma conversa fictícia para a prévia local.",
                        enviada_em=now - timedelta(minutes=19 - index),
                    ),
                ])
        # Indicadores reais calculados sobre os registros sintéticos da prévia.
        # Inserir somente o que falta preserva customizações feitas pelo usuário.
        existing_kpis = set((await db.scalars(select(KpiCatalogo.slug))).all())
        for definition in BUILTIN_KPIS:
            if definition["slug"] in DEMO_KPI_SLUGS and definition["slug"] not in existing_kpis:
                db.add(KpiCatalogo(**definition, is_builtin=True))
        dashboard = await db.scalar(
            select(DashboardConfig).where(DashboardConfig.cliente_id == tenant.id)
        )
        if dashboard is None:
            db.add(DashboardConfig(
                cliente_id=tenant.id,
                updated_by=user.id,
                kpis=[{"slug": slug, "ordem": index, "visivel": True}
                      for index, slug in enumerate(DEMO_KPI_SLUGS)],
                layout="grid",
            ))
        await db.commit()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
