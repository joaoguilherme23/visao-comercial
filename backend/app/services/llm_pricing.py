"""
Catálogo de pricing das LLMs + função de cálculo de custo.

Preços em USD por 1.000.000 tokens. Câmbio USD→BRL via env (USD_TO_BRL,
default 5.50). Atualize quando o provedor mudar — fonte oficial:
  - OpenAI:    https://openai.com/api/pricing/
  - Anthropic: https://www.anthropic.com/pricing

Match do modelo é por PREFIX:
  "gpt-4.1-mini-2025-04-14" → casa com "gpt-4.1-mini"
Modelo desconhecido → retorna None (frontend mostra "—" + flag pricing_missing).

Última atualização da tabela: 2026-04 (revisar trimestralmente).
"""
from __future__ import annotations

import os
from typing import Optional, TypedDict


class _ModelPricing(TypedDict):
    input: float       # USD / 1M prompt tokens (não-cacheados)
    cached: float      # USD / 1M cached prompt tokens (mais barato)
    output: float      # USD / 1M completion tokens


# ── OpenAI ──────────────────────────────────────────────────────────────────
# Ordenação importa: prefixos mais ESPECÍFICOS antes (gpt-4.1-mini antes de gpt-4.1).
PRICING_USD_PER_1M: dict[str, _ModelPricing] = {
    # GPT-4.1 family
    "gpt-4.1-nano":  {"input": 0.10, "cached": 0.025, "output": 0.40},
    "gpt-4.1-mini":  {"input": 0.40, "cached": 0.10,  "output": 1.60},
    "gpt-4.1":       {"input": 2.00, "cached": 0.50,  "output": 8.00},
    # GPT-4o family
    "gpt-4o-mini":   {"input": 0.15, "cached": 0.075, "output": 0.60},
    "gpt-4o":        {"input": 2.50, "cached": 1.25,  "output": 10.00},
    # o-series (reasoning)
    "o1-mini":       {"input": 1.10, "cached": 0.55,  "output": 4.40},
    "o1-preview":    {"input": 15.0, "cached": 7.50,  "output": 60.00},
    "o1":            {"input": 15.0, "cached": 7.50,  "output": 60.00},
    "o3-mini":       {"input": 1.10, "cached": 0.55,  "output": 4.40},
    "o3":            {"input": 2.00, "cached": 0.50,  "output": 8.00},
    # GPT-4 turbo (legado mas pode aparecer)
    "gpt-4-turbo":   {"input": 10.0, "cached": 0.0,   "output": 30.00},
    "gpt-3.5-turbo": {"input": 0.50, "cached": 0.0,   "output": 1.50},
    # Claude (caso entre na stack)
    "claude-3-5-sonnet": {"input": 3.00, "cached": 0.30, "output": 15.00},
    "claude-3-5-haiku":  {"input": 1.00, "cached": 0.10, "output": 5.00},
    "claude-3-opus":     {"input": 15.0, "cached": 1.50, "output": 75.00},
}


def _usd_to_brl_rate() -> float:
    """Pega o câmbio do env. Default 5.50."""
    try:
        return float(os.environ.get("USD_TO_BRL", "5.50"))
    except (ValueError, TypeError):
        return 5.50


def _resolve_pricing(model: str | None) -> Optional[_ModelPricing]:
    """
    Match por prefix — mais específico ganha. Ex:
      "gpt-4.1-mini-2025-04-14" → "gpt-4.1-mini" (não "gpt-4.1")
    """
    if not model:
        return None
    m = model.strip().lower()
    # Itera ordenado por LEN do prefix (descendente) pra match específico ganhar
    for prefix in sorted(PRICING_USD_PER_1M.keys(), key=len, reverse=True):
        if m.startswith(prefix):
            return PRICING_USD_PER_1M[prefix]
    return None


class CostBreakdown(TypedDict):
    cost_usd: Optional[float]
    cost_brl: Optional[float]
    pricing_missing: bool
    matched_pricing_key: Optional[str]


def calc_cost(
    *,
    model: str | None,
    prompt_tokens: int | None = 0,
    completion_tokens: int | None = 0,
    cached_tokens: int | None = 0,
) -> CostBreakdown:
    """
    Calcula custo em USD e BRL pra uma chamada LLM.

    Fórmula:
        non_cached_prompt = max(prompt - cached, 0)
        cost_usd = non_cached_prompt/1M * input
                 + cached/1M           * cached
                 + completion/1M       * output

    Modelo desconhecido → todos None + pricing_missing=True.
    """
    pt = prompt_tokens or 0
    ct = completion_tokens or 0
    cached = cached_tokens or 0

    pricing = _resolve_pricing(model)
    if pricing is None:
        return {
            "cost_usd": None,
            "cost_brl": None,
            "pricing_missing": True,
            "matched_pricing_key": None,
        }

    non_cached_prompt = max(pt - cached, 0)
    cost_usd = (
        (non_cached_prompt / 1_000_000) * pricing["input"]
        + (cached / 1_000_000) * pricing["cached"]
        + (ct / 1_000_000) * pricing["output"]
    )
    rate = _usd_to_brl_rate()
    cost_brl = cost_usd * rate

    matched_key = next(
        (k for k in sorted(PRICING_USD_PER_1M.keys(), key=len, reverse=True)
         if (model or "").lower().startswith(k)),
        None,
    )
    return {
        "cost_usd": round(cost_usd, 6),
        "cost_brl": round(cost_brl, 4),
        "pricing_missing": False,
        "matched_pricing_key": matched_key,
    }


def usd_to_brl_current_rate() -> float:
    """Helper — retorna o câmbio em uso. Frontend pode mostrar no header."""
    return _usd_to_brl_rate()
