"""
Service de logs LLM — agregações e listagem detalhada.

A tabela logs.log_llm_usage é preenchida pelo worker de análise. Este serviço
expõe as leituras usadas pelo dashboard.
Cálculo de custo é on-the-fly (vide llm_pricing.py) — pricing pode mudar
sem precisar atualizar nada no banco.

Acesso: superadmin only (validado no router).
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional
from uuid import UUID
from zoneinfo import ZoneInfo


def _to_uuid_or_none(v) -> Optional[UUID]:
    """Converte string -> UUID. Se inválido, retorna None."""
    if not v:
        return None
    try:
        return UUID(str(v))
    except (ValueError, TypeError):
        return None


def _midnight_today_in_tz(tz_name: str | None) -> datetime:
    """
    Retorna a meia-noite do dia atual no timezone do tenant, em UTC.

    Ex: tz_name='America/Sao_Paulo' às 21:00 UTC do dia 30/04 → retorna
    01/05 03:00 UTC (= 00:00 do dia 01/05 em São Paulo, que já virou).

    Fallback se tz inválida: meia-noite UTC.
    """
    try:
        tz = ZoneInfo(tz_name or "UTC")
    except Exception:
        tz = ZoneInfo("UTC")
    now_local = datetime.now(tz)
    midnight_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    return midnight_local.astimezone(timezone.utc)

from sqlalchemy import select, and_, func, cast, Date
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.llm_log import LlmUsageLog
from app.models.tenant import Cliente
from app.services import llm_pricing


def _usuario_as_uuid():
    """Cast LlmUsageLog.usuario (TEXT) -> UUID pra JOIN com Cliente.id."""
    return cast(LlmUsageLog.usuario, PG_UUID(as_uuid=True))


# ── Helpers ────────────────────────────────────────────────────────────────


def _build_where(
    *,
    data_inicio: Optional[date],
    data_fim: Optional[date],
    cliente_id: Optional[UUID],
    modelo: Optional[str],
    workflow: Optional[str],
):
    """Constrói as condições WHERE comuns entre summary e items."""
    conds = []
    if data_inicio:
        conds.append(LlmUsageLog.created_at >= datetime.combine(data_inicio, datetime.min.time(), tzinfo=timezone.utc))
    if data_fim:
        # data_fim inclusivo: até o final do dia
        next_day = data_fim + timedelta(days=1)
        conds.append(LlmUsageLog.created_at < datetime.combine(next_day, datetime.min.time(), tzinfo=timezone.utc))
    if cliente_id:
        # usuario é text no banco — compara como string
        conds.append(LlmUsageLog.usuario == str(cliente_id))
    if modelo:
        # match case-insensitive por prefix
        conds.append(func.lower(LlmUsageLog.model).like(f"{modelo.strip().lower()}%"))
    if workflow:
        # match por substring no nome
        conds.append(LlmUsageLog.workflow_name.ilike(f"%{workflow.strip()}%"))
    return conds


# ── Listagem detalhada (paginada) ──────────────────────────────────────────


async def listar_items(
    db: AsyncSession,
    *,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    cliente_id: Optional[UUID] = None,
    modelo: Optional[str] = None,
    workflow: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """
    Retorna page {total, limit, offset, items[]} com custo já calculado.
    Inclui nome do tenant (via JOIN com integracao.clientes).
    """
    where = _build_where(
        data_inicio=data_inicio, data_fim=data_fim,
        cliente_id=cliente_id, modelo=modelo, workflow=workflow,
    )

    # Total (contagem) ANTES de aplicar limit/offset
    total_q = select(func.count()).select_from(LlmUsageLog)
    if where:
        total_q = total_q.where(*where)
    total = (await db.execute(total_q)).scalar() or 0

    # Page com JOIN pra trazer cliente_nome
    page_q = (
        select(LlmUsageLog, Cliente.nome.label("cliente_nome"))
        .outerjoin(Cliente, Cliente.id == _usuario_as_uuid())
        .order_by(LlmUsageLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if where:
        page_q = page_q.where(*where)

    rows = (await db.execute(page_q)).all()

    items: list[dict] = []
    for log, cliente_nome in rows:
        cost = llm_pricing.calc_cost(
            model=log.model,
            prompt_tokens=log.prompt_tokens,
            completion_tokens=log.completion_tokens,
            cached_tokens=log.cached_tokens,
        )
        items.append({
            "id": log.id,
            "created_at": log.created_at,
            "model": log.model,
            "prompt_tokens": log.prompt_tokens or 0,
            "completion_tokens": log.completion_tokens or 0,
            "total_tokens": log.total_tokens or 0,
            "cached_tokens": log.cached_tokens or 0,
            "reasoning_tokens": log.reasoning_tokens or 0,
            "qtd_msg": log.qtd_msg,
            "workflow_name": log.workflow_name,
            "nicho": log.nicho,
            "cliente_id": _to_uuid_or_none(log.usuario),
            "cliente_nome": cliente_nome,
            "cost_usd": cost["cost_usd"],
            "cost_brl": cost["cost_brl"],
            "pricing_missing": cost["pricing_missing"],
        })

    return {"total": int(total), "limit": limit, "offset": offset, "items": items}


# ── Summary (cards + breakdowns + série diária) ────────────────────────────


def _accumulate_cost(items_iter, *, model_field: str = "model"):
    """
    Aplica pricing em cada linha e acumula totais.
    items_iter é um iterável de dicts com keys: model, prompt_tokens,
    completion_tokens, cached_tokens.
    """
    total_usd = 0.0
    total_brl = 0.0
    has_gap = False
    for it in items_iter:
        cost = llm_pricing.calc_cost(
            model=it.get(model_field),
            prompt_tokens=it.get("prompt_tokens"),
            completion_tokens=it.get("completion_tokens"),
            cached_tokens=it.get("cached_tokens"),
        )
        if cost["pricing_missing"]:
            has_gap = True
        else:
            total_usd += cost["cost_usd"] or 0
            total_brl += cost["cost_brl"] or 0
    return total_usd, total_brl, has_gap


async def gerar_summary(
    db: AsyncSession,
    *,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    cliente_id: Optional[UUID] = None,
    modelo: Optional[str] = None,
    workflow: Optional[str] = None,
) -> dict:
    """
    Carrega linhas filtradas e gera todas as agregações em memória.

    Como a tabela é small (poucos milhares de registros), fazemos as
    agregações de custo em Python (porque pricing é dinâmico). Se um
    dia explodir, migra pra materialized view.
    """
    where = _build_where(
        data_inicio=data_inicio, data_fim=data_fim,
        cliente_id=cliente_id, modelo=modelo, workflow=workflow,
    )

    # Carrega linhas + nome do cliente em 1 query
    base_q = (
        select(
            LlmUsageLog.id,
            LlmUsageLog.created_at,
            LlmUsageLog.model,
            LlmUsageLog.prompt_tokens,
            LlmUsageLog.completion_tokens,
            LlmUsageLog.total_tokens,
            LlmUsageLog.cached_tokens,
            LlmUsageLog.workflow_name,
            LlmUsageLog.usuario.label("cliente_id"),
            Cliente.nome.label("cliente_nome"),
            Cliente.timezone.label("cliente_tz"),
            Cliente.budget_brl_diario.label("cliente_budget"),
        )
        .outerjoin(Cliente, Cliente.id == _usuario_as_uuid())
    )
    if where:
        base_q = base_q.where(*where)
    rows = (await db.execute(base_q)).all()

    if not rows:
        return _empty_summary(data_inicio, data_fim)

    # ── Totais + breakdowns ─────────────────────────────────────────────────
    total_calls = len(rows)
    total_prompt = sum((r.prompt_tokens or 0) for r in rows)
    total_completion = sum((r.completion_tokens or 0) for r in rows)
    total_cached = sum((r.cached_tokens or 0) for r in rows)
    total_tokens = sum((r.total_tokens or 0) for r in rows)

    # Custo total
    total_usd, total_brl, has_gap = _accumulate_cost(
        ({"model": r.model, "prompt_tokens": r.prompt_tokens,
          "completion_tokens": r.completion_tokens,
          "cached_tokens": r.cached_tokens} for r in rows)
    )

    # Agrupa por modelo
    by_model_map: dict[str, dict] = {}
    for r in rows:
        key = r.model or "(desconhecido)"
        bucket = by_model_map.setdefault(key, {
            "model": key, "calls": 0, "prompt_tokens": 0,
            "completion_tokens": 0, "cached_tokens": 0, "total_tokens": 0,
        })
        bucket["calls"] += 1
        bucket["prompt_tokens"] += r.prompt_tokens or 0
        bucket["completion_tokens"] += r.completion_tokens or 0
        bucket["cached_tokens"] += r.cached_tokens or 0
        bucket["total_tokens"] += r.total_tokens or 0
    by_model = []
    for m, b in by_model_map.items():
        cost = llm_pricing.calc_cost(
            model=b["model"],
            prompt_tokens=b["prompt_tokens"],
            completion_tokens=b["completion_tokens"],
            cached_tokens=b["cached_tokens"],
        )
        by_model.append({
            **b,
            "matched_pricing_key": cost["matched_pricing_key"],
            "pricing_missing": cost["pricing_missing"],
            "cost_usd": cost["cost_usd"],
            "cost_brl": cost["cost_brl"],
        })
    by_model.sort(key=lambda x: x["total_tokens"], reverse=True)

    # Agrupa por tenant (cliente_id vem como string da coluna usuario)
    # Pra cada tenant: separamos as linhas em "todas" (do filtro) e "hoje no TZ"
    # — gasto-de-hoje serve só pra alerta visual, e usa o TZ do cliente.
    by_tenant_map: dict[str, dict] = {}
    for r in rows:
        key = str(r.cliente_id) if r.cliente_id else "(sem tenant)"
        bucket = by_tenant_map.setdefault(key, {
            "cliente_id": _to_uuid_or_none(r.cliente_id),
            "cliente_nome": r.cliente_nome,
            "cliente_tz": r.cliente_tz,
            "cliente_budget": float(r.cliente_budget) if r.cliente_budget is not None else None,
            "calls": 0, "total_tokens": 0,
            "_models": [],
            "_models_today": [],  # subset do bucket que caiu hoje (no TZ do tenant)
        })
        bucket["calls"] += 1
        bucket["total_tokens"] += r.total_tokens or 0
        model_entry = {
            "model": r.model,
            "prompt_tokens": r.prompt_tokens,
            "completion_tokens": r.completion_tokens,
            "cached_tokens": r.cached_tokens,
        }
        bucket["_models"].append(model_entry)

    # Cache de "00:00 hoje em UTC" por TZ pra evitar recalcular
    today_midnight_cache: dict[str, datetime] = {}
    # Reload todas as linhas pra separar quais foram "hoje" no TZ do tenant
    for r in rows:
        key = str(r.cliente_id) if r.cliente_id else "(sem tenant)"
        bucket = by_tenant_map.get(key)
        if not bucket:
            continue
        tz_name = bucket.get("cliente_tz") or "UTC"
        if tz_name not in today_midnight_cache:
            today_midnight_cache[tz_name] = _midnight_today_in_tz(tz_name)
        if r.created_at >= today_midnight_cache[tz_name]:
            bucket["_models_today"].append({
                "model": r.model,
                "prompt_tokens": r.prompt_tokens,
                "completion_tokens": r.completion_tokens,
                "cached_tokens": r.cached_tokens,
            })

    by_tenant = []
    tenants_over = 0
    for _, b in by_tenant_map.items():
        cost_usd, cost_brl, _ = _accumulate_cost(b.pop("_models"))
        _, cost_brl_today, _ = _accumulate_cost(b.pop("_models_today"))
        budget = b.pop("cliente_budget")
        b.pop("cliente_tz", None)  # tira do response — interno
        over = bool(budget and cost_brl_today and cost_brl_today >= budget)
        if over:
            tenants_over += 1
        by_tenant.append({
            **b,
            "cost_usd": round(cost_usd, 6),
            "cost_brl": round(cost_brl, 4),
            "budget_brl_diario": budget,
            "cost_brl_today": round(cost_brl_today, 4) if cost_brl_today else 0.0,
            "over_budget": over,
        })
    by_tenant.sort(key=lambda x: x["total_tokens"], reverse=True)

    # Agrupa por workflow
    by_wf_map: dict[str, dict] = {}
    for r in rows:
        key = r.workflow_name or "(sem workflow)"
        bucket = by_wf_map.setdefault(key, {
            "workflow_name": r.workflow_name,
            "calls": 0, "total_tokens": 0,
            "_models": [],
        })
        bucket["calls"] += 1
        bucket["total_tokens"] += r.total_tokens or 0
        bucket["_models"].append({
            "model": r.model,
            "prompt_tokens": r.prompt_tokens,
            "completion_tokens": r.completion_tokens,
            "cached_tokens": r.cached_tokens,
        })
    by_workflow = []
    for _, b in by_wf_map.items():
        cost_usd, cost_brl, _ = _accumulate_cost(b.pop("_models"))
        by_workflow.append({**b, "cost_usd": round(cost_usd, 6), "cost_brl": round(cost_brl, 4)})
    by_workflow.sort(key=lambda x: x["total_tokens"], reverse=True)

    # Série diária
    by_day_map: dict[date, dict] = {}
    for r in rows:
        d = r.created_at.date()
        bucket = by_day_map.setdefault(d, {
            "dia": d, "calls": 0, "total_tokens": 0, "_models": [],
        })
        bucket["calls"] += 1
        bucket["total_tokens"] += r.total_tokens or 0
        bucket["_models"].append({
            "model": r.model,
            "prompt_tokens": r.prompt_tokens,
            "completion_tokens": r.completion_tokens,
            "cached_tokens": r.cached_tokens,
        })
    daily = []
    for _, b in sorted(by_day_map.items()):
        cost_usd, cost_brl, _ = _accumulate_cost(b.pop("_models"))
        daily.append({**b, "cost_usd": round(cost_usd, 6), "cost_brl": round(cost_brl, 4)})

    avg_brl = round(total_brl / total_calls, 4) if total_calls else None

    return {
        "periodo": {
            "inicio": data_inicio.isoformat() if data_inicio else None,
            "fim": data_fim.isoformat() if data_fim else None,
        },
        "total_calls": total_calls,
        "total_tokens": total_tokens,
        "total_prompt_tokens": total_prompt,
        "total_completion_tokens": total_completion,
        "total_cached_tokens": total_cached,
        "cost_usd": round(total_usd, 6),
        "cost_brl": round(total_brl, 4),
        "avg_cost_brl_per_call": avg_brl,
        "usd_to_brl_rate": llm_pricing.usd_to_brl_current_rate(),
        "has_pricing_gaps": has_gap,
        "tenants_over_budget_today": tenants_over,
        "by_model": by_model,
        "by_tenant": by_tenant,
        "by_workflow": by_workflow,
        "daily": daily,
    }


def _empty_summary(data_inicio: Optional[date], data_fim: Optional[date]) -> dict:
    return {
        "periodo": {
            "inicio": data_inicio.isoformat() if data_inicio else None,
            "fim": data_fim.isoformat() if data_fim else None,
        },
        "total_calls": 0,
        "total_tokens": 0,
        "total_prompt_tokens": 0,
        "total_completion_tokens": 0,
        "total_cached_tokens": 0,
        "cost_usd": 0.0,
        "cost_brl": 0.0,
        "avg_cost_brl_per_call": None,
        "usd_to_brl_rate": llm_pricing.usd_to_brl_current_rate(),
        "has_pricing_gaps": False,
        "by_model": [],
        "by_tenant": [],
        "by_workflow": [],
        "daily": [],
    }
