"""
Portfolio service — visão agregada das N empresas que um gestor multi-empresa
tem acesso (via UserTenant).

Princípios:
  - Lê SEMPRE só os tenants em user_tenants (is_active=True) do current_user,
    a menos que ele seja superadmin (aí pega todos).
  - Usa o kpi_engine existente em loop com asyncio.gather pra paralelizar.
  - Retorna estrutura "narrativa" focada no que o gestor precisa pra DECIDIR
    onde focar atenção hoje (não copia o dashboard inteiro).

Subset de KPIs no portfolio (decisão: foco em "onde agir hoje"):
  - novos_leads      — quanto entrou no período
  - leads_oportunidade_aberta — quanto está em conversão
  - leads_urgencia_alta       — quem PRECISA de atenção agora
  - tempo_primeira_resposta   — saúde do time
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import date, datetime, timezone
from typing import Iterable

from sqlalchemy import select, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User, UserTenant
from app.models.tenant import Cliente
from app.models.lead import Lead
from app.kpi_catalog import BUILTIN_KPIS
from app.services import kpi_engine

# ── Subset de KPIs do portfolio ──────────────────────────────────────────────
# Ordem importa: a UI vai exibir nesta ordem.
PORTFOLIO_SUBSET_SLUGS: tuple[str, ...] = (
    "total_leads",                  # "Novos Leads no período"
    "leads_oportunidade_aberta",
    "leads_urgencia_alta",
    "tempo_primeira_resposta",
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers de descoberta de tenants
# ─────────────────────────────────────────────────────────────────────────────

async def _tenants_do_usuario(db: AsyncSession, user: User, allowed_tenant_ids: set[str] | None = None) -> list[Cliente]:
    """
    Lista os Cliente que o user tem acesso ativo.
    Superadmin: vê TODOS os tenants ativos.
    Manager_multi: vê só os de user_tenants ativos (e cliente.ativo=true).
    """
    if user.is_superadmin and not settings.OIDC_ENABLED:
        result = await db.execute(
            select(Cliente).where(Cliente.ativo == True).order_by(Cliente.nome)
        )
        return list(result.scalars().all())

    # Inner join entre user_tenants e clientes (cross-schema, query explícita)
    query = (
        select(Cliente)
        .join(UserTenant, UserTenant.cliente_id == Cliente.id)
        .where(
            UserTenant.user_id == user.id,
            UserTenant.is_active == True,
            Cliente.ativo == True,
        )
        .order_by(Cliente.nome)
    )
    if settings.OIDC_ENABLED:
        query = query.where(Cliente.id.in_(allowed_tenant_ids or set()))
    result = await db.execute(query)
    return list(result.scalars().unique().all())


async def _role_por_tenant(
    db: AsyncSession, user: User, cliente_ids: Iterable[uuid.UUID]
) -> dict[uuid.UUID, str]:
    """Retorna mapa cliente_id -> role do user. Superadmin retorna 'admin' implícito."""
    if user.is_superadmin:
        return {cid: "admin" for cid in cliente_ids}

    cliente_ids = list(cliente_ids)
    if not cliente_ids:
        return {}
    result = await db.execute(
        select(UserTenant).where(
            UserTenant.user_id == user.id,
            UserTenant.is_active == True,
            UserTenant.cliente_id.in_(cliente_ids),
        )
    )
    return {ut.cliente_id: ut.role.value for ut in result.scalars().all()}


# ─────────────────────────────────────────────────────────────────────────────
# 1. Listagem de empresas (com mini-stats — total de leads ativos e urgência alta)
# ─────────────────────────────────────────────────────────────────────────────

async def listar_empresas(db: AsyncSession, user: User, allowed_tenant_ids: set[str] | None = None) -> list[dict]:
    """
    Lista compacta das empresas do gestor com mini-stats por empresa.

    Cada item:
      { id, nome, slug, nicho, role, total_leads_ativos, leads_urgencia_alta }

    Para apresentar como cards clicáveis na PortfolioPage.
    """
    clientes = await _tenants_do_usuario(db, user, allowed_tenant_ids)
    roles = await _role_por_tenant(db, user, [c.id for c in clientes])

    if not clientes:
        return []

    # Conta leads ativos e urgência alta de cada cliente em paralelo
    async def _stats(cliente_id: uuid.UUID) -> tuple[int, int]:
        ativos_q = select(Lead).where(Lead.cliente_id == cliente_id, Lead.ativo == True)
        urgentes_q = ativos_q.where(Lead.temperatura == "alta")

        ativos = (await db.execute(
            select(Lead.id).where(Lead.cliente_id == cliente_id, Lead.ativo == True)
        )).all()
        urgentes = (await db.execute(
            select(Lead.id).where(
                Lead.cliente_id == cliente_id,
                Lead.ativo == True,
                Lead.temperatura == "alta",
            )
        )).all()
        return len(ativos), len(urgentes)

    stats_list = await asyncio.gather(*[_stats(c.id) for c in clientes])

    return [
        {
            "id": c.id,
            "nome": c.nome,
            "slug": c.slug,
            "nicho": c.nicho,
            "ativo": c.ativo,
            "role": roles.get(c.id, "viewer"),
            "total_leads_ativos": ativos,
            "leads_urgencia_alta": urgentes,
        }
        for c, (ativos, urgentes) in zip(clientes, stats_list)
    ]


# ─────────────────────────────────────────────────────────────────────────────
# 2. KPIs agregados (subset) — uma chamada por tenant em paralelo
# ─────────────────────────────────────────────────────────────────────────────

async def kpis_agregados(
    db: AsyncSession,
    user: User,
    date_from: date | None,
    date_to: date | None,
    allowed_tenant_ids: set[str] | None = None,
) -> dict:
    """
    Calcula os 4 KPIs do PORTFOLIO_SUBSET_SLUGS pra cada empresa do user e
    devolve estrutura agregada:

    {
      "periodo": {"inicio": ..., "fim": ...},
      "total_empresas": N,
      "kpis": [
        {
          "slug": "total_leads",
          "label": "Novos Leads",
          "agregado": 320,           # soma simples ou média conforme tipo
          "tipo_agregacao": "sum"|"avg"|"max",
          "por_empresa": [
            {"cliente_id": ..., "cliente_nome": "Empresa A", "valor": 110},
            ...
          ]
        },
        ...
      ]
    }
    """
    clientes = await _tenants_do_usuario(db, user, allowed_tenant_ids)
    if not clientes:
        return {
            "periodo": {"inicio": date_from, "fim": date_to},
            "total_empresas": 0,
            "kpis": [],
        }

    # KPI catalog map por slug pra usar no kpi_engine
    catalog_by_slug = {k["slug"]: k for k in BUILTIN_KPIS}

    async def _calcular_para_cliente(cliente: Cliente, slug: str):
        kpi = catalog_by_slug.get(slug)
        if not kpi:
            return None
        # Constrói _FakeKpi-like dict aceito pelo kpi_engine
        fake = type("_K", (), kpi)
        try:
            valor = await kpi_engine.calcular_kpi(
                db=db,
                kpi=fake,
                cliente_id=cliente.id,
                date_from=date_from,
                date_to=date_to,
                telefone_bot=None,
            )
        except Exception:
            valor = None
        return {
            "cliente_id": cliente.id,
            "cliente_nome": cliente.nome,
            "valor": valor,
        }

    resultados: list[dict] = []
    for slug in PORTFOLIO_SUBSET_SLUGS:
        kpi_def = catalog_by_slug.get(slug)
        if not kpi_def:
            continue

        por_empresa = await asyncio.gather(
            *[_calcular_para_cliente(c, slug) for c in clientes]
        )
        por_empresa = [x for x in por_empresa if x is not None]

        # Define agregação baseada no tipo de cálculo do KPI:
        # count/count_distinct/sum -> soma; avg/percent -> média;
        # mode/top_n/string -> não agrega (quem mostra é o por_empresa).
        tipo_calc = kpi_def.get("tipo_calculo")
        formato = kpi_def.get("formato")
        valores_num = [x["valor"] for x in por_empresa if isinstance(x["valor"], (int, float))]

        if tipo_calc in ("count", "count_distinct", "sum"):
            tipo_agg = "sum"
            agregado = sum(valores_num) if valores_num else 0
        elif tipo_calc in ("avg", "percent") or formato in ("percent", "duration"):
            tipo_agg = "avg"
            agregado = round(sum(valores_num) / len(valores_num), 2) if valores_num else 0
        else:
            tipo_agg = "n/a"
            agregado = None

        resultados.append({
            "slug": slug,
            "label": kpi_def.get("nome", slug),
            "descricao": kpi_def.get("descricao", ""),
            "tipo": tipo_calc,
            "tipo_agregacao": tipo_agg,
            "agregado": agregado,
            "por_empresa": por_empresa,
        })

    return {
        "periodo": {"inicio": date_from, "fim": date_to},
        "total_empresas": len(clientes),
        "kpis": resultados,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. Top leads quentes (de todas as empresas, ordenados por score desc)
# ─────────────────────────────────────────────────────────────────────────────

async def top_leads_quentes(
    db: AsyncSession,
    user: User,
    limit: int = 10,
    allowed_tenant_ids: set[str] | None = None,
) -> list[dict]:
    """
    Busca os N leads com maior score de TODAS as empresas do user, com
    badge da empresa em cada um. Filtra:
      - lead.ativo = True
      - lead.bloqueado = False
      - lead.score IS NOT NULL
      - cliente_id IN tenants do user
    """
    clientes = await _tenants_do_usuario(db, user, allowed_tenant_ids)
    if not clientes:
        return []

    cliente_ids = [c.id for c in clientes]
    cliente_map = {c.id: c for c in clientes}

    result = await db.execute(
        select(Lead)
        .where(
            Lead.cliente_id.in_(cliente_ids),
            Lead.ativo == True,
            Lead.bloqueado == False,
            Lead.score.isnot(None),
        )
        .order_by(desc(Lead.score), desc(Lead.updated_at))
        .limit(limit)
    )
    leads = result.scalars().all()

    return [
        {
            "id": lead.id,
            "nome": lead.nome,
            "whatsapp": lead.whatsapp,
            "score": float(lead.score) if lead.score is not None else None,
            "temperatura": lead.temperatura,
            "etapa_funil": lead.etapa_funil,
            "updated_at": lead.updated_at,
            "cliente_id": lead.cliente_id,
            "cliente_nome": cliente_map[lead.cliente_id].nome,
            "cliente_slug": cliente_map[lead.cliente_id].slug,
        }
        for lead in leads
    ]
