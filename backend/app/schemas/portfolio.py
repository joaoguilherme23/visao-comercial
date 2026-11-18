"""Schemas para a aba Portfolio (visão multi-empresa do gestor)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel


class EmpresaPortfolioOut(BaseModel):
    id: UUID
    nome: str
    slug: str
    nicho: Optional[str] = None
    ativo: bool
    role: str  # 'admin' | 'manager' | 'viewer' (string pra simplificar)
    total_leads_ativos: int
    leads_urgencia_alta: int


class KpiPorEmpresa(BaseModel):
    cliente_id: UUID
    cliente_nome: str
    valor: Any  # pode ser int, float, str (categórico) ou None


class KpiAgregadoOut(BaseModel):
    slug: str
    label: str
    descricao: str = ""
    tipo: Optional[str] = None
    tipo_agregacao: str  # 'sum' | 'avg' | 'n/a'
    agregado: Any
    por_empresa: list[KpiPorEmpresa]


class PeriodoOut(BaseModel):
    inicio: Optional[date] = None
    fim: Optional[date] = None


class KpisAgregadosOut(BaseModel):
    periodo: PeriodoOut
    total_empresas: int
    kpis: list[KpiAgregadoOut]


class LeadQuenteOut(BaseModel):
    id: UUID
    nome: Optional[str] = None
    whatsapp: str
    score: Optional[float] = None
    temperatura: Optional[str] = None
    etapa_funil: Optional[str] = None
    updated_at: datetime
    cliente_id: UUID
    cliente_nome: str
    cliente_slug: str
