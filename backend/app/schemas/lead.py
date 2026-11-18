from pydantic import BaseModel
from typing import Optional, Any, Dict
from uuid import UUID
from datetime import datetime

class LeadUpdate(BaseModel):
    nome: Optional[str] = None
    etapa_funil: Optional[str] = None
    temperatura: Optional[str] = None
    score: Optional[float] = None
    bloqueado: Optional[bool] = None
    ativo: Optional[bool] = None
    extras: Optional[Dict[str, Any]] = None
    cidade_lead: Optional[str] = None
    estado_lead: Optional[str] = None
    perfil_lead: Optional[str] = None
    lead_recorrente: Optional[bool] = None
    followup_em: Optional[datetime] = None
    primeiraresposta_em: Optional[datetime] = None

class LeadOut(BaseModel):
    id: UUID
    cliente_id: UUID
    whatsapp: str
    nome: Optional[str] = None
    telefone_bot: Optional[str] = None
    origem: Optional[str] = None
    etapa_funil: Optional[str] = None
    temperatura: Optional[str] = None
    score: Optional[float] = None
    bloqueado: bool
    ativo: bool
    cidade_lead: Optional[str] = None
    estado_lead: Optional[str] = None
    perfil_lead: Optional[str] = None
    lead_recorrente: bool = False
    followup_em: Optional[datetime] = None
    primeiraresposta_em: Optional[datetime] = None
    foto_url: Optional[str] = None
    concluido_no_feed: bool = False
    feed_snooze_ate: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
