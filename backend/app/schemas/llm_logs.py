"""Schemas pra /llm-logs (admin)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional, Union
from uuid import UUID

from pydantic import BaseModel


# ── Filtros (query params) ──────────────────────────────────────────────────


class LlmLogsFilters(BaseModel):
    """Filtros aplicáveis em ambos summary e items."""
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    cliente_id: Optional[UUID] = None
    modelo: Optional[str] = None  # match por prefix (case-insensitive)
    workflow: Optional[str] = None  # match por substring no nome


# ── Saída: item individual (linha da tabela) ────────────────────────────────


class LlmLogItem(BaseModel):
    id: int
    created_at: datetime
    model: Optional[str] = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cached_tokens: int = 0
    reasoning_tokens: int = 0
    qtd_msg: Optional[int] = None
    workflow_name: Optional[str] = None
    nicho: Optional[str] = None
    cliente_id: Optional[UUID] = None
    cliente_nome: Optional[str] = None
    # Custo calculado on-the-fly (servidor aplica pricing atual)
    cost_usd: Optional[float] = None
    cost_brl: Optional[float] = None
    pricing_missing: bool = False


class LlmLogsItemsPage(BaseModel):
    """Resposta paginada da listagem detalhada."""
    total: int
    limit: int
    offset: int
    items: list[LlmLogItem]


# ── Saída: summary (cards + breakdowns) ─────────────────────────────────────


class LlmModelBreakdown(BaseModel):
    model: str
    matched_pricing_key: Optional[str]
    pricing_missing: bool
    calls: int
    total_tokens: int
    prompt_tokens: int
    completion_tokens: int
    cached_tokens: int
    cost_usd: Optional[float]
    cost_brl: Optional[float]


class LlmTenantBreakdown(BaseModel):
    cliente_id: Optional[UUID]
    cliente_nome: Optional[str]
    calls: int
    total_tokens: int
    cost_usd: Optional[float]
    cost_brl: Optional[float]
    # Limite + gasto-de-hoje (no timezone do tenant). Só alerta visual.
    budget_brl_diario: Optional[float] = None
    cost_brl_today: Optional[float] = None
    over_budget: bool = False


class LlmWorkflowBreakdown(BaseModel):
    workflow_name: Optional[str]
    calls: int
    total_tokens: int
    cost_usd: Optional[float]
    cost_brl: Optional[float]


class LlmDailySeries(BaseModel):
    """Série temporal pra graficar consumo/custo por dia."""
    dia: date
    calls: int
    total_tokens: int
    cost_usd: Optional[float]
    cost_brl: Optional[float]


class LlmLogsSummary(BaseModel):
    periodo: dict
    total_calls: int
    total_tokens: int
    total_prompt_tokens: int
    total_completion_tokens: int
    total_cached_tokens: int
    cost_usd: Optional[float]
    cost_brl: Optional[float]
    avg_cost_brl_per_call: Optional[float]
    usd_to_brl_rate: float
    has_pricing_gaps: bool  # true se algum modelo não tem pricing
    tenants_over_budget_today: int = 0  # quantas empresas excederam limite hoje
    by_model: list[LlmModelBreakdown]
    by_tenant: list[LlmTenantBreakdown]
    by_workflow: list[LlmWorkflowBreakdown]
    daily: list[LlmDailySeries]
