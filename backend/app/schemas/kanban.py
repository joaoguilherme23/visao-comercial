from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, date

class AnaliseCardOut(BaseModel):
    id: UUID
    resumo_curto: Optional[str] = None
    sentimento: Optional[str] = None
    score_interesse: Optional[float] = None
    intencao: Optional[str] = None
    proximo_passo: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class KpiCardOut(BaseModel):
    veiculo_interesse: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    urgencia: Optional[str] = None
    score_fechamento: Optional[float] = None
    proximo_contato: Optional[str] = None
    dados: Optional[Dict[str, Any]] = None  # payload completo unificado (JSONB)

    class Config:
        from_attributes = True

class KanbanCardOut(BaseModel):
    id: UUID
    whatsapp: str
    nome: Optional[str] = None
    temperatura: Optional[str] = None
    score: Optional[float] = None
    etapa_funil: Optional[str] = None
    bloqueado: bool
    # Foto sincronizada do WhatsApp — path relativo (servido por /avatars no backend).
    # NULL quando contato não tem foto pública ou sync ainda não rodou.
    foto_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    nicho: Optional[str] = None
    ultima_analise: Optional[AnaliseCardOut] = None
    kpi: Optional[KpiCardOut] = None
    kpi_generico: Optional[Dict[str, Any]] = None  # dados brutos do nicho

    class Config:
        from_attributes = True

class KanbanColumnOut(BaseModel):
    etapa: str
    total: int
    cards: List[KanbanCardOut]

class KanbanBoardOut(BaseModel):
    columns: List[KanbanColumnOut]
    total_leads: int

class MoveCardRequest(BaseModel):
    lead_id: UUID
    nova_etapa: str
    nova_temperatura: Optional[str] = None

class AnaliseFullOut(BaseModel):
    id: UUID
    lead_id: UUID
    data_ref: Optional[str] = None
    versao: int
    resumo_curto: Optional[str] = None
    sentimento: Optional[str] = None
    score_interesse: Optional[float] = None
    intencao: Optional[str] = None
    proximo_passo: Optional[str] = None
    modelo_ia: Optional[str] = None
    tokens_consumidos: Optional[int] = None
    total_msgs: Optional[int] = None
    created_at: datetime
    detalhe: Optional[Dict[str, Any]] = None
    kpi: Optional[KpiCardOut] = None
    lead_extra: Optional[Dict[str, Any]] = None  # AnaliseLeadExtra — campos comportamentais IA

    class Config:
        from_attributes = True

class MensagemOut(BaseModel):
    id: UUID
    lead_id: UUID
    direcao: str
    tipo: str
    conteudo: Optional[str] = None
    midia_url: Optional[str] = None
    enviada_em: datetime
    enviado_por: Optional[str] = None

    class Config:
        from_attributes = True

class ConversaPreviewOut(BaseModel):
    lead_id: UUID
    whatsapp: str
    nome: Optional[str] = None
    ultima_mensagem: Optional[str] = None
    tipo_ultima: Optional[str] = None
    direcao_ultima: Optional[str] = None
    enviada_em: Optional[datetime] = None
    # Campos extras pra UI mostrar avatar colorido por temperatura + badge de score
    # (mesma identidade visual que a lista de leads do dashboard)
    temperatura: Optional[str] = None
    score: Optional[float] = None
    # Foto sincronizada do WhatsApp — path relativo (servido por /avatars no backend)
    foto_url: Optional[str] = None


class ConversasListOut(BaseModel):
    """Resposta paginada de /kanban/{id}/conversations.

    Mesmo padrão de envelope do FeedListOut — permite useInfiniteQuery no
    frontend e busca global combinada com filtros (acumulativos).
    """
    items: List[ConversaPreviewOut]
    total: int
    has_more: bool = False
    next_offset: Optional[int] = None


class AnaliseResumoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    data_ref: date
    sentimento: Optional[str] = None
    score_interesse: Optional[float] = None
    intencao: Optional[str] = None
    proximo_passo: Optional[str] = None
    resumo_curto: Optional[str] = None
    total_msgs: int = 0


class AnaliseLeadExtraOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    genero: Optional[str] = None
    oportunidade_aberta: Optional[bool] = None
    motivo_nao_fechamento: Optional[str] = None
    motivo_desistencia: Optional[str] = None
    melhoria_atendimento: Optional[str] = None
    melhoria_negociacao: Optional[str] = None
    frases_ditas_lead: Optional[list[str]] = None
    frases_chave_negativas: Optional[list[str]] = None


class LeadDetalheOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    # Lead fields
    id: UUID
    cliente_id: UUID
    whatsapp: str
    nome: Optional[str] = None
    telefone_bot: Optional[str] = None
    origem: Optional[str] = None
    etapa_funil: Optional[str] = None
    temperatura: Optional[str] = None
    score: Optional[float] = None
    extras: Optional[dict] = None
    bloqueado: bool = False
    ativo: bool = True
    cidade_lead: Optional[str] = None
    estado_lead: Optional[str] = None
    perfil_lead: Optional[str] = None
    lead_recorrente: bool = False
    followup_em: Optional[datetime] = None
    primeiraresposta_em: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    # Analysis (latest)
    analise: Optional[AnaliseResumoOut] = None
    analise_extra: Optional[AnaliseLeadExtraOut] = None
