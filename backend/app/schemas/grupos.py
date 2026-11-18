"""
Schemas do recurso "Grupos" (integracao.grupos / integracao.grupos_mensagens).

Expõe 3 payloads:
- GrupoListItemOut:      item da listagem de grupos do tenant
- GrupoMensagemOut:      mensagem paginada de um grupo específico
- GrupoParticipanteOut:  agregação de participantes derivada das mensagens

Filtros de bot (X9/AIA) são aplicados apenas em mensagens/participantes — ver
grupos_service.py para justificativa.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class GrupoListItemOut(BaseModel):
    """Card da listagem — sumariza um grupo do tenant."""

    id: UUID
    cliente_id: UUID
    whatsapp: str
    nome: Optional[str] = None
    temperatura: Optional[str] = None
    foto_url: Optional[str] = None
    ultima_interacao: Optional[datetime] = None
    created_at: Optional[datetime] = None
    update_at: Optional[datetime] = None
    # Métricas agregadas — não dependem do filtro de bot (aparecem mesmo se
    # a última msg for do X9/AIA).
    total_mensagens: int = 0
    total_participantes: int = 0

    model_config = {"from_attributes": True}


class GrupoMensagemOut(BaseModel):
    """Mensagem de um grupo — já filtra bots (X9/AIA)."""

    id: UUID
    grupo_id: UUID
    cliente_id: UUID
    conteudo: Optional[str] = None
    participant_number: Optional[str] = None
    participant_name: Optional[str] = None
    direcao: str
    tipo: str
    provider_msg_id: Optional[str] = None
    enviada_em: datetime

    model_config = {"from_attributes": True}


class GrupoParticipanteOut(BaseModel):
    """
    Participante agregado — identificado por participant_number dentro do grupo.
    Totais e timestamps derivam das mensagens (já com bot filtrado).
    """

    participant_number: str
    participant_name: Optional[str] = None
    total_mensagens: int
    primeira_msg_em: Optional[datetime] = None
    ultima_msg_em: Optional[datetime] = None


class GrupoMensagensPageOut(BaseModel):
    """Página de mensagens com metadados simples."""

    total: int
    limit: int
    offset: int
    items: List[GrupoMensagemOut]


class GrupoParticipantesOut(BaseModel):
    """Lista completa de participantes de um grupo."""

    grupo_id: UUID
    total: int
    items: List[GrupoParticipanteOut]
