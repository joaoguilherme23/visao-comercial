"""Contratos do caminho interno backend <-> workflow de análise.

Não há identificadores de tenant/lead no corpo de callback: o escopo vem
exclusivamente do job autenticado pelo token efêmero.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ContextMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    direction: Literal["entrada", "saida", "outro"]
    kind: str = Field(max_length=30)
    content: str | None = Field(default=None, max_length=4000)
    sent_at: datetime


class AnalysisContextOut(BaseModel):
    """Contexto limitado entregue ao workflow após autenticação do job."""

    model_config = ConfigDict(extra="forbid")

    job_id: UUID
    tenant: dict[str, Any]
    numero: dict[str, Any]
    lead: dict[str, Any]
    niche: dict[str, Any] | None = None
    messages: list[ContextMessage] = Field(max_length=100)


class AnalysisExtraInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    genero: Literal["masculino", "feminino", "nao_identificado"] | None = None
    oportunidade_aberta: bool | None = None
    motivo_nao_fechamento: str | None = Field(default=None, max_length=1000)
    motivo_desistencia: str | None = Field(default=None, max_length=1000)
    melhoria_atendimento: str | None = Field(default=None, max_length=1000)
    melhoria_negociacao: str | None = Field(default=None, max_length=1000)
    frases_ditas_lead: list[str] = Field(default_factory=list, max_length=30)
    frases_chave_negativas: list[str] = Field(default_factory=list, max_length=30)

    @field_validator("frases_ditas_lead", "frases_chave_negativas")
    @classmethod
    def _limit_list_items(cls, value: list[str]) -> list[str]:
        if any(len(item) > 500 for item in value):
            raise ValueError("itens textuais devem ter no máximo 500 caracteres")
        return value


class AnalysisKpiInput(BaseModel):
    """Campos estáveis de KPI; ``dados`` suporta o schema específico do nicho."""

    model_config = ConfigDict(extra="forbid")

    # The retired workflow normalized this value as a probability and the
    # pipeline thresholds below use the same 0..1 scale.
    score_fechamento: float = Field(default=0, ge=0, le=1)
    urgencia: Literal["alta", "media", "baixa"] | None = None
    proximo_contato: str | None = Field(default=None, max_length=200)
    dados: dict[str, Any] = Field(default_factory=dict, max_length=50)

    @field_validator("dados")
    @classmethod
    def _bound_dynamic_kpis(cls, value: dict[str, Any]) -> dict[str, Any]:
        # JSON simples, limitado, para não transformar callback em canal de
        # armazenamento arbitrário.
        encoded = str(value)
        if len(encoded) > 12_000:
            raise ValueError("dados de KPI excedem o limite")
        if any(not isinstance(key, str) or len(key) > 100 for key in value):
            raise ValueError("chaves de KPI inválidas")
        return value


class AnalysisResultInput(BaseModel):
    """Resultado validado antes de qualquer escrita no banco."""

    model_config = ConfigDict(extra="forbid")

    resumo_curto: str = Field(min_length=1, max_length=280)
    sentimento: Literal["positivo", "neutro", "negativo", "misto"]
    score_interesse: float = Field(ge=0, le=10)
    intencao: str = Field(min_length=1, max_length=100)
    proximo_passo: str = Field(default="", max_length=500)
    resumo_completo: str | None = Field(default=None, max_length=8000)
    observacoes: str | None = Field(default=None, max_length=2000)
    objecoes: list[str] = Field(default_factory=list, max_length=30)
    duvidas: list[str] = Field(default_factory=list, max_length=30)
    memoria: list[str] = Field(default_factory=list, max_length=30)
    extra: AnalysisExtraInput = Field(default_factory=AnalysisExtraInput)
    kpi: AnalysisKpiInput = Field(default_factory=AnalysisKpiInput)
    modelo_ia: str | None = Field(default=None, max_length=100)
    tokens_consumidos: int | None = Field(default=None, ge=0, le=10_000_000)
    tempo_ms: int | None = Field(default=None, ge=0, le=3_600_000)
    @field_validator("score_interesse")
    @classmethod
    def _normalize_interest_ratio(cls, value: float) -> float:
        """Accept the 0..1 representation emitted by the former workflow."""
        return value * 10 if 0 < value <= 1 else value

    @field_validator("objecoes", "duvidas", "memoria")
    @classmethod
    def _bound_text_lists(cls, value: list[str]) -> list[str]:
        if any(len(item) > 500 for item in value):
            raise ValueError("itens textuais devem ter no máximo 500 caracteres")
        return value


class AnalysisCallbackOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    accepted: bool
    idempotent: bool = False
    stale: bool = False
