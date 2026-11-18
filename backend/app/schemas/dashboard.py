from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime


# ── KPI Catalogo ─────────────────────────────────────────────────────────────

class KpiCatalogoCreate(BaseModel):
    slug: str
    nome: str
    descricao: Optional[str] = None
    icone: Optional[str] = None
    cor: Optional[str] = None
    tipo_calculo: str
    config_calculo: Dict[str, Any] = {}
    formato: str = "number"
    nichos_compativeis: Optional[List[str]] = None
    categoria_kpi: Optional[str] = None
    ordem_padrao: Optional[int] = None


class KpiCatalogoOut(BaseModel):
    id: UUID
    slug: str
    nome: str
    descricao: Optional[str] = None
    icone: Optional[str] = None
    cor: Optional[str] = None
    tipo_calculo: str
    config_calculo: Dict[str, Any]
    formato: str
    nichos_compativeis: Optional[List[str]] = None
    categoria_kpi: Optional[str] = None
    is_builtin: bool
    cliente_id: Optional[UUID] = None
    ordem_padrao: Optional[int] = None
    ativo: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Dashboard Config ─────────────────────────────────────────────────────────

class KpiSelecao(BaseModel):
    slug: str
    ordem: int = 0
    visivel: bool = True


class DashboardConfigUpdate(BaseModel):
    kpis: List[KpiSelecao]
    layout: str = "grid"
    secoes_visiveis: Optional[List[str]] = None  # None = todas as secoes visiveis


class DashboardConfigOut(BaseModel):
    id: UUID
    cliente_id: UUID
    updated_by: UUID
    kpis: List[Dict[str, Any]]
    layout: str
    secoes_visiveis: Optional[List[str]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── KPI Result (valor calculado) ─────────────────────────────────────────────

class KpiResultOut(BaseModel):
    slug: str
    nome: str
    descricao: Optional[str] = None
    valor: Any
    formato: str
    icone: Optional[str] = None
    cor: Optional[str] = None
    categoria_kpi: Optional[str] = None
    ordem: int = 0
    variacao_pct: Optional[float] = None
    valor_anterior: Optional[float] = None


class LeadDrilldownOut(BaseModel):
    id: UUID
    nome: Optional[str] = None
    whatsapp: str
    etapa_funil: Optional[str] = None
    temperatura: Optional[str] = None
    score: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Nicho Campos (IA Extraction Fields) ──────────────────────────────────────

class CampoDefinicaoIn(BaseModel):
    nome: str
    tipo: str  # string | number | boolean | date | select
    label: str
    obrigatorio: bool = False
    opcoes: Optional[List[str]] = None
    descricao: Optional[str] = None


class NichoCamposOut(BaseModel):
    nicho: str
    campos_kpi: List[Dict[str, Any]]
    campos_analise: List[Dict[str, Any]]


class NichoCamposUpdate(BaseModel):
    campos_kpi: List[CampoDefinicaoIn]
    campos_analise: List[CampoDefinicaoIn]


# ── Analise Widget ────────────────────────────────────────────────────────────

WIDGET_COMPAT: dict[str, list[str]] = {
    "top_n":   ["bar", "pie", "donut", "table", "treemap", "funnel", "column"],
    "count":   ["bar", "pie", "donut", "line", "area", "metric", "table", "treemap", "funnel", "column"],
    "avg":     ["bar", "line", "area", "metric", "column"],
    "sum":     ["bar", "line", "area", "metric", "column"],
    "min":     ["bar", "line", "area", "metric", "column"],
    "max":     ["bar", "line", "area", "metric", "column"],
    "percent": ["bar", "pie", "donut", "metric", "table", "treemap", "funnel", "column"],
}


class AnaliseWidgetCreate(BaseModel):
    label: str
    descricao: Optional[str] = None
    campo: str
    operacao: str
    limite: int = 10
    filtros: List[Dict[str, Any]] = []
    somente_sem_conversao: bool = False
    tipo_grafico: str
    cor: Optional[str] = None
    ordem: int = 0


class AnaliseWidgetUpdate(BaseModel):
    label: Optional[str] = None
    descricao: Optional[str] = None
    campo: Optional[str] = None
    operacao: Optional[str] = None
    limite: Optional[int] = None
    filtros: Optional[List[Dict[str, Any]]] = None
    somente_sem_conversao: Optional[bool] = None
    tipo_grafico: Optional[str] = None
    cor: Optional[str] = None
    ordem: Optional[int] = None
    ativo: Optional[bool] = None


class AnaliseWidgetOut(BaseModel):
    id: UUID
    cliente_id: Optional[UUID] = None
    nicho: Optional[str] = None
    label: str
    descricao: Optional[str] = None
    campo: str
    operacao: str
    limite: int
    filtros: List[Dict[str, Any]]
    somente_sem_conversao: bool
    tipo_grafico: str
    cor: Optional[str] = None
    ordem: int
    ativo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WidgetDataItem(BaseModel):
    label: str
    value: Any
    pct: Optional[float] = None


class AnaliseWidgetDataOut(BaseModel):
    id: UUID
    label: str
    tipo_grafico: str
    operacao: str
    campo: str
    cor: Optional[str] = None
    data: List[WidgetDataItem]
    total_base: int
