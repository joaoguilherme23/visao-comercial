import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, update, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import engine, AsyncSessionLocal, Base
from app.core.security import hash_password
from app.middleware.oidc_gate import OidcGovernanceMiddleware
from app.core.bootstrap import assert_local_database_target
from app.kpi_catalog import BUILTIN_KPIS, DEPRECATED_SLUGS
from app.models.dashboard import KpiCatalogo
from app.models.user import User as UserModel
from app.routers import (
    auth, users, tenants, kanban, numeros, nicho, dashboard,
    notificacoes, agora, grupos, portfolio, empresas, avatares, llm_logs,
    feed, webhooks,
)
from app.routers import oidc_auth

# Registra todos os models no Base.metadata
import app.models  # noqa: F401


async def _seed_kpi_catalogo(db: AsyncSession):

    try:
        # Deactivate deprecated KPIs (temperature KPIs moved to fixed panel)
        await db.execute(
            update(KpiCatalogo)
            .where(KpiCatalogo.slug.in_(DEPRECATED_SLUGS))
            .values(ativo=False)
        )

        existing = await db.execute(
            select(KpiCatalogo.slug).where(KpiCatalogo.is_builtin == True)
        )
        existing_slugs = {row[0] for row in existing.all()}

        inserted = 0
        updated = 0
        for data in BUILTIN_KPIS:
            if data["slug"] in existing_slugs:
                # FIX K6: upsert — atualiza KPIs existentes para que correções
                # no catálogo sejam propagadas ao reiniciar, sem precisar de
                # migrations manuais ou reset do banco.
                update_vals = {k: v for k, v in data.items() if k != "slug"}
                await db.execute(
                    update(KpiCatalogo)
                    .where(KpiCatalogo.slug == data["slug"], KpiCatalogo.is_builtin == True)
                    .values(**update_vals)
                )
                updated += 1
            else:
                db.add(KpiCatalogo(**data, is_builtin=True))
                inserted += 1

        await db.commit()
        parts = []
        if inserted:
            parts.append(f"{inserted} inseridos")
        if updated:
            parts.append(f"{updated} atualizados")
        if parts:
            print(f"[x9] KPI catalog: {', '.join(parts)}")
    except Exception as e:
        await db.rollback()
        print(f"[x9] Erro ao semear KPI catalog: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # DDL de bootstrap é excepcional. Ambientes normais usam apenas Alembic.
    if settings.DATABASE_BOOTSTRAP_SCHEMA:
        assert_local_database_target()
        async with engine.begin() as conn:
            await conn.execute(text("CREATE SCHEMA IF NOT EXISTS public"))
            await conn.execute(text("CREATE SCHEMA IF NOT EXISTS analise"))
            await conn.execute(text("CREATE SCHEMA IF NOT EXISTS integracao"))
            await conn.execute(text("CREATE SCHEMA IF NOT EXISTS logs"))
            await conn.run_sync(Base.metadata.create_all)

    if settings.BOOTSTRAP_LEGACY_ADMIN and not settings.OIDC_ENABLED:
        async with AsyncSessionLocal() as db:
            # `.first()` em vez de `.scalar_one_or_none()` — ambiente real pode
            # ter múltiplos superadmins (manualmente promovidos), e o objetivo
            # aqui é só "garantir que existe pelo menos um" pra bootstrap.
            result = await db.execute(
                select(UserModel).where(UserModel.is_superadmin == True).limit(1)
            )
            if not result.scalar_one_or_none():
                admin = UserModel(
                    email=settings.SUPERADMIN_EMAIL,
                    password_hash=hash_password(settings.SUPERADMIN_PASSWORD),
                    nome=settings.SUPERADMIN_NOME,
                    is_superadmin=True,
                )
                db.add(admin)
                await db.commit()
                print(f"[x9] Superadmin criado: {settings.SUPERADMIN_EMAIL}")

    if settings.DATABASE_BOOTSTRAP_SCHEMA:
        async with AsyncSessionLocal() as db:
            await _seed_kpi_catalogo(db)

    yield
    await engine.dispose()


app = FastAPI(
    title="Visão Comercial API",
    version="1.0.0",
    description="Plataforma de análise de conversas comerciais com Kanban multi-tenant",
    lifespan=lifespan,
)

app.add_middleware(OidcGovernanceMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(oidc_auth.router)
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(tenants.router, prefix="/api/v1")
app.include_router(kanban.router, prefix="/api/v1")
app.include_router(numeros.router, prefix="/api/v1")
app.include_router(nicho.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(notificacoes.router, prefix="/api/v1")
app.include_router(agora.router, prefix="/api/v1")
app.include_router(grupos.router, prefix="/api/v1")
app.include_router(portfolio.router, prefix="/api/v1")
app.include_router(empresas.router, prefix="/api/v1")
app.include_router(avatares.router, prefix="/api/v1")
app.include_router(llm_logs.router, prefix="/api/v1")
app.include_router(feed.router, prefix="/api/v1")
app.include_router(webhooks.router, prefix="/api/v1")

# ── Storage estático (avatars do WhatsApp) ──────────────────────────────────
# Servido em /avatars/<tipo>/<id>/<file.ext> a partir do container local.
# Sobrescrever via env AVATAR_STORAGE_ROOT se precisar.
_storage_root = Path(os.environ.get("AVATAR_STORAGE_ROOT", "/app/storage")) / "avatars"
_storage_root.mkdir(parents=True, exist_ok=True)
app.mount(
    "/avatars",
    StaticFiles(directory=str(_storage_root), check_dir=False),
    name="avatars",
)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0", "release": os.environ.get("X9_RELEASE_SHA", "development")}
