"""
Queries e helpers compartilhados entre NotificacaoService e AgoraService.

Centraliza subqueries de "última mensagem por lead" e "última análise por
lead" para evitar duplicação e garantir comportamento consistente entre
os dois endpoints que consomem o mesmo tipo de informação.
"""
from __future__ import annotations

from typing import Final

from sqlalchemy import desc, func, select
from sqlalchemy.sql import Subquery

from app.models.analysis import Analise
from app.models.message import Mensagem

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

# Etapas de funil consideradas finalizadas — leads nessas etapas não aparecem
# em notificações nem na fila "Agora".
ETAPAS_FINALIZADAS: Final[set[str]] = {
    "fechado",
    "perdido",
    "encerrado",
    "cancelado",
}

# Direções de mensagem consideradas "entrada" (lead -> empresa).
# Aceita legacy "in" e o padrão novo "entrada".
DIRECOES_ENTRADA: Final[tuple[str, ...]] = ("entrada", "in")

# Direções de mensagem consideradas "saída" (empresa -> lead).
DIRECOES_SAIDA: Final[tuple[str, ...]] = ("saida", "out")


# ---------------------------------------------------------------------------
# Subqueries
# ---------------------------------------------------------------------------

def latest_msg_per_lead_subquery(cliente_id) -> Subquery:
    """
    Retorna subquery com a última mensagem de cada lead do tenant.

    Columns expostas:
        - lead_id
        - direcao
        - enviada_em
        - conteudo
        - tipo
        - rn: número da linha — rn == 1 é a última mensagem

    Uso típico:
        sq = latest_msg_per_lead_subquery(cliente_id)
        query = select(Lead).join(sq, (Lead.id == sq.c.lead_id) & (sq.c.rn == 1))
    """
    return (
        select(
            Mensagem.lead_id.label("lead_id"),
            Mensagem.direcao.label("direcao"),
            Mensagem.enviada_em.label("enviada_em"),
            Mensagem.conteudo.label("conteudo"),
            Mensagem.tipo.label("tipo"),
            func.row_number()
            .over(
                partition_by=Mensagem.lead_id,
                order_by=desc(Mensagem.enviada_em),
            )
            .label("rn"),
        )
        .where(Mensagem.cliente_id == cliente_id)
        .subquery()
    )


def latest_analise_per_lead_subquery(cliente_id) -> Subquery:
    """
    Retorna subquery com a última análise de cada lead do tenant.

    Columns expostas:
        - lead_id
        - created_at
        - intencao
        - kpi_score_fechamento
        - extra_json
        - rn: número da linha — rn == 1 é a análise mais recente
    """
    return (
        select(
            Analise.lead_id.label("lead_id"),
            Analise.created_at.label("created_at"),
            Analise.intencao.label("intencao"),
            Analise.kpi_score_fechamento.label("kpi_score_fechamento"),
            Analise.extra_json.label("extra_json"),
            func.row_number()
            .over(
                partition_by=Analise.lead_id,
                order_by=desc(Analise.created_at),
            )
            .label("rn"),
        )
        .where(Analise.cliente_id == cliente_id)
        .subquery()
    )


# ---------------------------------------------------------------------------
# Formatadores
# ---------------------------------------------------------------------------

def fmt_duracao(minutos: int) -> str:
    """
    Formata duração em minutos para string curta e humana.

    Exemplos:
        0  -> "agora"
        5  -> "5min"
        65 -> "1h 5min"
        130-> "2h 10min"
        1440 -> "1d"
        2880 -> "2d"
        4440 -> "3d 2h"
    """
    if minutos < 1:
        return "agora"
    if minutos < 60:
        return f"{minutos}min"
    horas, m = divmod(minutos, 60)
    if horas < 24:
        if m == 0:
            return f"{horas}h"
        return f"{horas}h {m}min"
    dias, h = divmod(horas, 24)
    if h == 0:
        return f"{dias}d"
    return f"{dias}d {h}h"


def fmt_contexto_curto(conteudo: str | None, tipo: str | None) -> str | None:
    """
    Resume o conteúdo de uma mensagem para exibição na fila.

    Trata texto normal e mídia (áudio, imagem, vídeo, documento) com fallbacks
    amigáveis. Trunca textos longos em ~140 caracteres.
    """
    tipo_norm = (tipo or "").strip().lower()

    # Mídia — fallback por tipo, ignora conteudo (geralmente URL ou vazio)
    if tipo_norm in ("audio", "voice", "ptt"):
        return "🎤 áudio"
    if tipo_norm in ("image", "imagem", "photo"):
        return "📷 imagem"
    if tipo_norm in ("video",):
        return "🎬 vídeo"
    if tipo_norm in ("document", "documento", "file"):
        return "📎 documento"
    if tipo_norm in ("sticker",):
        return "🌟 sticker"
    if tipo_norm in ("location", "localizacao"):
        return "📍 localização"

    # Texto (ou tipo desconhecido com conteúdo) — trunca em 140
    if not conteudo:
        return None
    texto = conteudo.strip().replace("\n", " ")
    if len(texto) > 140:
        return texto[:137] + "..."
    return texto


def normalize_intencao_para_sinal(intencao: str | None) -> str:
    """
    Mapeia o campo `intencao` da análise para um dos 4 tipos de sinal_ia.

    Heurística simples por substring (case-insensitive, sem acento básico):
        - "preco"/"preço"  -> "preco"
        - "prazo"          -> "prazo"
        - "condic"         -> "condicoes"
        - fallback         -> "duvida_aberta"
    """
    if not intencao:
        return "duvida_aberta"
    texto = intencao.lower()
    # remove acentos mais comuns — suficiente pra essa heurística
    texto = (
        texto.replace("ç", "c")
        .replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
        .replace("ê", "e")
        .replace("ã", "a")
        .replace("õ", "o")
    )
    if "preco" in texto:
        return "preco"
    if "prazo" in texto:
        return "prazo"
    if "condic" in texto:
        return "condicoes"
    return "duvida_aberta"
