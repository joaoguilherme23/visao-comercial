"""
Serviço da Fila "Agora" — feed priorizado do X9 CRM.

Retorna 4 buckets ordenados por prioridade (quente sem resposta, follow-up
vencido, esfriando, sinal IA). Deduplicação entre buckets: um lead que
aparece num bucket de prioridade maior não aparece nos subsequentes.

Cache Redis de 20s absorve polls curtos do frontend sem bater no banco.
Degradação graciosa: se Redis falhar, cai pra consulta direta.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable, Optional
from uuid import UUID

import redis.asyncio as aioredis
from sqlalchemy import asc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.lead import Lead
from app.schemas.agora import AgoraBoardOut, AgoraBucketOut, AgoraItemOut, AgoraMotivo
from app.services._queries_fila import (
    DIRECOES_ENTRADA,
    ETAPAS_FINALIZADAS,
    fmt_contexto_curto,
    fmt_duracao,
    latest_analise_per_lead_subquery,
    latest_msg_per_lead_subquery,
    normalize_intencao_para_sinal,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Redis — cache de 20s (mesmo padrão do notificacao_service)
# ---------------------------------------------------------------------------

_redis: Optional[aioredis.Redis] = None
CACHE_TTL_AGORA = 20  # segundos


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


async def _cache_get(key: str) -> Optional[dict]:
    try:
        raw = await _get_redis().get(key)
        if raw:
            return json.loads(raw)
    except Exception as exc:
        logger.debug("Redis cache miss agora (get): %s", exc)
    return None


async def _cache_set(key: str, data: dict) -> None:
    try:
        await _get_redis().set(
            key,
            json.dumps(data, default=str),
            ex=CACHE_TTL_AGORA,
        )
    except Exception as exc:
        logger.debug("Redis cache miss agora (set): %s", exc)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Garante que o datetime tenha tzinfo (assume UTC se ausente)."""
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _minutos_entre(now: datetime, ts: Optional[datetime]) -> int:
    """Diferença em minutos, nunca negativa."""
    if ts is None:
        return 0
    ts_utc = _ensure_utc(ts)
    if ts_utc is None:
        return 0
    delta = now - ts_utc
    return max(0, int(delta.total_seconds() // 60))


def _float_or_none(v) -> Optional[float]:
    """Converte Decimal/Numeric/str para float; retorna None se não der."""
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Buckets
# ---------------------------------------------------------------------------

async def _bucket_quente_sem_resposta(
    session: AsyncSession,
    cliente_id: UUID,
    now: datetime,
    horas_quente: int,
    limit: int,
    exclude_ids: set[UUID],
) -> list[AgoraItemOut]:
    """
    Leads quentes cuja última mensagem foi de ENTRADA e passou de `horas_quente`.
    Ordenados pela msg mais antiga (maior dor primeiro).
    """
    threshold = now - timedelta(hours=horas_quente)
    latest_msg_sq = latest_msg_per_lead_subquery(cliente_id)

    stmt = (
        select(
            Lead,
            latest_msg_sq.c.enviada_em,
            latest_msg_sq.c.conteudo,
            latest_msg_sq.c.tipo,
        )
        .join(
            latest_msg_sq,
            (Lead.id == latest_msg_sq.c.lead_id) & (latest_msg_sq.c.rn == 1),
        )
        .where(
            Lead.cliente_id == cliente_id,
            Lead.ativo == True,
            Lead.bloqueado == False,
            func.lower(Lead.temperatura) == "quente",
            func.lower(Lead.etapa_funil).notin_(list(ETAPAS_FINALIZADAS)),
            latest_msg_sq.c.direcao.in_(list(DIRECOES_ENTRADA)),
            latest_msg_sq.c.enviada_em <= threshold,
        )
        .order_by(asc(latest_msg_sq.c.enviada_em))
        .limit(limit)
    )

    rows = (await session.execute(stmt)).all()

    items: list[AgoraItemOut] = []
    for lead, enviada_em, conteudo, tipo_msg in rows:
        if lead.id in exclude_ids:
            continue
        enviada_em_utc = _ensure_utc(enviada_em)
        minutos = _minutos_entre(now, enviada_em_utc)
        items.append(
            AgoraItemOut(
                lead_id=lead.id,
                nome=lead.nome,
                whatsapp=lead.whatsapp,
                temperatura=lead.temperatura,
                score=_float_or_none(lead.score),
                etapa_funil=lead.etapa_funil,
                motivo="quente_sem_resposta",
                sinal_ia_tipo=None,
                urgencia_label=fmt_duracao(minutos),
                urgencia_minutos=minutos,
                contexto_curto=fmt_contexto_curto(conteudo, tipo_msg),
                ultima_entrada_em=enviada_em_utc,
                followup_em=_ensure_utc(lead.followup_em),
                bloqueado=lead.bloqueado,
                ativo=lead.ativo,
            )
        )
    return items


async def _bucket_followup_vencido(
    session: AsyncSession,
    cliente_id: UUID,
    now: datetime,
    limit: int,
    exclude_ids: set[UUID],
) -> list[AgoraItemOut]:
    """
    Leads ativos com followup_em < now, ordenados pelo mais antigo.
    """
    latest_msg_sq = latest_msg_per_lead_subquery(cliente_id)

    stmt = (
        select(
            Lead,
            latest_msg_sq.c.enviada_em,
            latest_msg_sq.c.conteudo,
            latest_msg_sq.c.tipo,
        )
        .outerjoin(
            latest_msg_sq,
            (Lead.id == latest_msg_sq.c.lead_id) & (latest_msg_sq.c.rn == 1),
        )
        .where(
            Lead.cliente_id == cliente_id,
            Lead.ativo == True,
            Lead.bloqueado == False,
            Lead.followup_em.is_not(None),
            Lead.followup_em < now,
            func.lower(Lead.etapa_funil).notin_(list(ETAPAS_FINALIZADAS)),
        )
        .order_by(asc(Lead.followup_em))
        .limit(limit)
    )

    rows = (await session.execute(stmt)).all()

    items: list[AgoraItemOut] = []
    for lead, enviada_em, conteudo, tipo_msg in rows:
        if lead.id in exclude_ids:
            continue
        followup_utc = _ensure_utc(lead.followup_em)
        minutos = _minutos_entre(now, followup_utc)
        items.append(
            AgoraItemOut(
                lead_id=lead.id,
                nome=lead.nome,
                whatsapp=lead.whatsapp,
                temperatura=lead.temperatura,
                score=_float_or_none(lead.score),
                etapa_funil=lead.etapa_funil,
                motivo="followup_vencido",
                sinal_ia_tipo=None,
                urgencia_label=fmt_duracao(minutos),
                urgencia_minutos=minutos,
                contexto_curto=fmt_contexto_curto(conteudo, tipo_msg),
                ultima_entrada_em=_ensure_utc(enviada_em),
                followup_em=followup_utc,
                bloqueado=lead.bloqueado,
                ativo=lead.ativo,
            )
        )
    return items


async def _bucket_esfriando(
    session: AsyncSession,
    cliente_id: UUID,
    now: datetime,
    limit: int,
    exclude_ids: set[UUID],
) -> list[AgoraItemOut]:
    """
    Leads mornos cuja última mensagem (qualquer direção) está entre 24h e 72h atrás.
    Ordenados pelo mais antigo (maior risco de esfriar).
    """
    floor = now - timedelta(hours=72)
    ceiling = now - timedelta(hours=24)
    latest_msg_sq = latest_msg_per_lead_subquery(cliente_id)

    stmt = (
        select(
            Lead,
            latest_msg_sq.c.enviada_em,
            latest_msg_sq.c.conteudo,
            latest_msg_sq.c.tipo,
        )
        .join(
            latest_msg_sq,
            (Lead.id == latest_msg_sq.c.lead_id) & (latest_msg_sq.c.rn == 1),
        )
        .where(
            Lead.cliente_id == cliente_id,
            Lead.ativo == True,
            Lead.bloqueado == False,
            func.lower(Lead.temperatura) == "morno",
            func.lower(Lead.etapa_funil).notin_(list(ETAPAS_FINALIZADAS)),
            latest_msg_sq.c.enviada_em >= floor,
            latest_msg_sq.c.enviada_em <= ceiling,
        )
        .order_by(asc(latest_msg_sq.c.enviada_em))
        .limit(limit)
    )

    rows = (await session.execute(stmt)).all()

    items: list[AgoraItemOut] = []
    for lead, enviada_em, conteudo, tipo_msg in rows:
        if lead.id in exclude_ids:
            continue
        enviada_em_utc = _ensure_utc(enviada_em)
        minutos = _minutos_entre(now, enviada_em_utc)
        items.append(
            AgoraItemOut(
                lead_id=lead.id,
                nome=lead.nome,
                whatsapp=lead.whatsapp,
                temperatura=lead.temperatura,
                score=_float_or_none(lead.score),
                etapa_funil=lead.etapa_funil,
                motivo="esfriando",
                sinal_ia_tipo=None,
                urgencia_label=fmt_duracao(minutos),
                urgencia_minutos=minutos,
                contexto_curto=fmt_contexto_curto(conteudo, tipo_msg),
                ultima_entrada_em=enviada_em_utc,
                followup_em=_ensure_utc(lead.followup_em),
                bloqueado=lead.bloqueado,
                ativo=lead.ativo,
            )
        )
    return items


async def _bucket_sinal_ia(
    session: AsyncSession,
    cliente_id: UUID,
    now: datetime,
    limit: int,
    exclude_ids: set[UUID],
) -> list[AgoraItemOut]:
    """
    Leads cuja última análise (≤ 7 dias) indica oportunidade_aberta=true no
    extra_json, e cuja última mensagem é de entrada (≤ 72h).

    sinal_ia_tipo é inferido de analise.intencao via heurística de substring.
    """
    analise_cutoff = now - timedelta(days=7)
    msg_cutoff = now - timedelta(hours=72)

    latest_msg_sq = latest_msg_per_lead_subquery(cliente_id)
    latest_analise_sq = latest_analise_per_lead_subquery(cliente_id)

    # extra_json->>'oportunidade_aberta' == 'true'
    oportunidade_flag = latest_analise_sq.c.extra_json["oportunidade_aberta"].astext

    stmt = (
        select(
            Lead,
            latest_msg_sq.c.enviada_em,
            latest_msg_sq.c.conteudo,
            latest_msg_sq.c.tipo,
            latest_analise_sq.c.intencao,
        )
        .join(
            latest_msg_sq,
            (Lead.id == latest_msg_sq.c.lead_id) & (latest_msg_sq.c.rn == 1),
        )
        .join(
            latest_analise_sq,
            (Lead.id == latest_analise_sq.c.lead_id) & (latest_analise_sq.c.rn == 1),
        )
        .where(
            Lead.cliente_id == cliente_id,
            Lead.ativo == True,
            Lead.bloqueado == False,
            func.lower(Lead.etapa_funil).notin_(list(ETAPAS_FINALIZADAS)),
            oportunidade_flag == "true",
            latest_analise_sq.c.created_at >= analise_cutoff,
            latest_msg_sq.c.direcao.in_(list(DIRECOES_ENTRADA)),
            latest_msg_sq.c.enviada_em >= msg_cutoff,
        )
        .order_by(asc(latest_msg_sq.c.enviada_em))
        .limit(limit)
    )

    rows = (await session.execute(stmt)).all()

    items: list[AgoraItemOut] = []
    for lead, enviada_em, conteudo, tipo_msg, intencao in rows:
        if lead.id in exclude_ids:
            continue
        enviada_em_utc = _ensure_utc(enviada_em)
        minutos = _minutos_entre(now, enviada_em_utc)
        sinal_tipo = normalize_intencao_para_sinal(intencao)
        items.append(
            AgoraItemOut(
                lead_id=lead.id,
                nome=lead.nome,
                whatsapp=lead.whatsapp,
                temperatura=lead.temperatura,
                score=_float_or_none(lead.score),
                etapa_funil=lead.etapa_funil,
                motivo="sinal_ia",
                sinal_ia_tipo=sinal_tipo,  # type: ignore[arg-type]
                urgencia_label=fmt_duracao(minutos),
                urgencia_minutos=minutos,
                contexto_curto=fmt_contexto_curto(conteudo, tipo_msg),
                ultima_entrada_em=enviada_em_utc,
                followup_em=_ensure_utc(lead.followup_em),
                bloqueado=lead.bloqueado,
                ativo=lead.ativo,
            )
        )
    return items


# ---------------------------------------------------------------------------
# Orquestrador
# ---------------------------------------------------------------------------

# Tipagem explícita das fns de bucket (retornam tasks já awaitáveis)
BucketFn = Callable[
    [AsyncSession, UUID, datetime, int, set[UUID]],
    Awaitable[list[AgoraItemOut]],
]


async def build_agora_board(
    session: AsyncSession,
    cliente_id: UUID,
    horas_quente: int = 2,
    limit_por_bucket: int = 20,
) -> AgoraBoardOut:
    """
    Constrói o board "Agora" com os 4 buckets fixos (mesmo vazios).

    Deduplicação: ordem de prioridade é quente → followup → esfriando → sinal_ia.
    Cache Redis: chave `agora:{cliente_id}:{horas_quente}` TTL 20s.
    """
    cache_key = f"agora:{cliente_id}:{horas_quente}:{limit_por_bucket}"

    cached = await _cache_get(cache_key)
    if cached is not None:
        try:
            return AgoraBoardOut(**cached)
        except Exception as exc:
            logger.debug("Cache agora: payload inválido, ignorando — %s", exc)

    now = datetime.now(timezone.utc)
    seen: set[UUID] = set()

    # Bucket 1 — quente sem resposta
    items_quente = await _bucket_quente_sem_resposta(
        session, cliente_id, now, horas_quente, limit_por_bucket, seen
    )
    seen.update(i.lead_id for i in items_quente)

    # Bucket 2 — followup vencido
    items_followup = await _bucket_followup_vencido(
        session, cliente_id, now, limit_por_bucket, seen
    )
    seen.update(i.lead_id for i in items_followup)

    # Bucket 3 — esfriando
    items_esfriando = await _bucket_esfriando(
        session, cliente_id, now, limit_por_bucket, seen
    )
    seen.update(i.lead_id for i in items_esfriando)

    # Bucket 4 — sinal IA
    items_sinal = await _bucket_sinal_ia(
        session, cliente_id, now, limit_por_bucket, seen
    )
    seen.update(i.lead_id for i in items_sinal)

    buckets = [
        _wrap_bucket("quente_sem_resposta", items_quente),
        _wrap_bucket("followup_vencido", items_followup),
        _wrap_bucket("esfriando", items_esfriando),
        _wrap_bucket("sinal_ia", items_sinal),
    ]

    board = AgoraBoardOut(
        cliente_id=cliente_id,
        gerado_em=now,
        horas_quente_aplicado=horas_quente,
        total_geral=sum(b.total for b in buckets),
        buckets=buckets,
    )

    await _cache_set(cache_key, board.model_dump())
    return board


def _wrap_bucket(motivo: AgoraMotivo, items: list[AgoraItemOut]) -> AgoraBucketOut:
    return AgoraBucketOut(motivo=motivo, total=len(items), items=items)
