"""
Schemas da Fila "Agora" — feed acionável do X9 CRM.

Representa itens priorizados em 4 buckets (quente sem resposta, follow-up
vencido, esfriando, sinal de IA). O frontend renderiza em ordem fixa e
esconde buckets vazios.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel

AgoraMotivo = Literal[
    "quente_sem_resposta",
    "followup_vencido",
    "esfriando",
    "sinal_ia",
]

SinalIaTipo = Literal[
    "preco",
    "prazo",
    "condicoes",
    "duvida_aberta",
]


class AgoraItemOut(BaseModel):
    """Card individual da fila — um lead priorizado com contexto curto."""

    lead_id: UUID
    nome: Optional[str] = None
    whatsapp: str
    temperatura: Optional[str] = None
    score: Optional[float] = None
    etapa_funil: Optional[str] = None
    motivo: AgoraMotivo
    sinal_ia_tipo: Optional[SinalIaTipo] = None
    urgencia_label: str
    urgencia_minutos: int
    contexto_curto: Optional[str] = None
    ultima_entrada_em: Optional[datetime] = None
    followup_em: Optional[datetime] = None
    bloqueado: bool = False
    ativo: bool = True

    model_config = {"from_attributes": True}


class AgoraBucketOut(BaseModel):
    """Agrupamento de itens por motivo."""

    motivo: AgoraMotivo
    total: int
    items: List[AgoraItemOut]


class AgoraBoardOut(BaseModel):
    """Board completo — 4 buckets fixos, na ordem de prioridade."""

    cliente_id: UUID
    gerado_em: datetime
    horas_quente_aplicado: int
    total_geral: int
    buckets: List[AgoraBucketOut]
