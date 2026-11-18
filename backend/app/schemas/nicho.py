from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime


# ── Campo definition (used inside campos_kpi / campos_analise) ──────────────
class CampoDefinicao(BaseModel):
    nome: str
    tipo: str  # string | number | boolean | date | select
    label: str
    obrigatorio: bool = False
    opcoes: Optional[List[str]] = None  # para tipo=select


# ── NichoConfig ──────────────────────────────────────────────────────────────
class NichoConfigCreate(BaseModel):
    nicho: str
    label: str
    descricao: Optional[str] = None
    campos_kpi: List[Dict[str, Any]] = []
    campos_analise: List[Dict[str, Any]] = []
    etapas_kanban: List[str] = []
    prompt_base: Optional[str] = None


class NichoConfigUpdate(BaseModel):
    label: Optional[str] = None
    descricao: Optional[str] = None
    campos_kpi: Optional[List[Dict[str, Any]]] = None
    campos_analise: Optional[List[Dict[str, Any]]] = None
    etapas_kanban: Optional[List[str]] = None
    prompt_base: Optional[str] = None
    ativo: Optional[bool] = None


class NichoConfigOut(BaseModel):
    id: UUID
    nicho: str
    label: str
    descricao: Optional[str] = None
    campos_kpi: List[Dict[str, Any]]
    campos_analise: List[Dict[str, Any]]
    etapas_kanban: List[str]
    prompt_base: Optional[str] = None
    ativo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── KpiGenerico ──────────────────────────────────────────────────────────────
class KpiGenericoOut(BaseModel):
    id: UUID
    cliente_id: UUID
    analise_id: UUID
    nicho: str
    dados: Dict[str, Any]
    score_fechamento: Optional[float] = None
    proximo_contato: Optional[str] = None
    urgencia: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
