"""Schemas da página /feed — lista vertical de leads ativos com urgência."""
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

from app.schemas.kanban import AnaliseCardOut, KpiCardOut


class FeedCardOut(BaseModel):
    """Card único da página /feed.

    Estende KanbanCardOut com:
    - `acao_requerida` — bool, true quando próximo_passo está preenchido
    - `urgencia_score` — int derivado pela ordenação do feed_service
    - `comentarios_count` — quantos comentários internos esse lead tem
    - `foto_url` — caminho relativo do avatar (se sincronizado)
    """
    id: UUID
    whatsapp: str
    nome: Optional[str] = None
    temperatura: Optional[str] = None
    score: Optional[float] = None
    etapa_funil: Optional[str] = None
    bloqueado: bool
    foto_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    nicho: Optional[str] = None
    ultima_analise: Optional[AnaliseCardOut] = None
    kpi: Optional[KpiCardOut] = None
    kpi_generico: Optional[Dict[str, Any]] = None
    acao_requerida: bool = False
    urgencia_score: int = 0
    comentarios_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class FeedListOut(BaseModel):
    items: List[FeedCardOut]
    total: int
    has_more: bool = False
    next_offset: Optional[int] = None


class SnoozeRequest(BaseModel):
    """Body do POST /feed/{cliente_id}/leads/{lead_id}/snooze.

    Aceita preset (`1h`, `3h`, `6h`, `1d`, `3d`) OU `ate` (datetime explícita
    em UTC). Se ambos vierem, preset tem precedência."""
    preset: Optional[str] = Field(None, description="1h | 3h | 6h | 1d | 3d")
    ate: Optional[datetime] = None
