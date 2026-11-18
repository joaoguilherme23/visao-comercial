from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime

NotificacaoTipo = Literal[
    "lead_quente_sem_resposta",
    "potencial_fechamento",
    "lead_novo",
    "followup_vencido",
    "sem_resposta_24h",
]


class NotificacaoOut(BaseModel):
    id: str                       # 24-char sha1 slug — estável entre polls
    tipo: NotificacaoTipo
    titulo: str
    descricao: str
    lead_id: str                  # UUID como string para navegação no frontend
    lead_nome: Optional[str]
    lead_whatsapp: str
    prioridade: int               # 1=crítico, 2=alto, 3=médio
    icone: str                    # emoji
    cor_hex: str                  # e.g. "#ef4444"
    criado_em: datetime           # momento do evento que originou a notificação
    gerado_em: datetime           # quando esta computação rodou

    model_config = {"from_attributes": True}
