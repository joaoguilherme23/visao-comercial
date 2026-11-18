"""
Serviço de Notificações X9 Kanban
==================================
Computa 5 tipos de notificações a partir do estado atual do banco.
Resultados são cacheados no Redis por 25s para absorver polls consecutivos
sem sobrecarregar o banco.

Degradação graciosa: se Redis estiver indisponível, cai para consulta direta
ao banco a cada requisição.

Refactor nota: subqueries de "última mensagem por lead" agora vivem em
`_queries_fila.py` e são compartilhadas com o AgoraService. O contrato
público (`get_notificacoes`) permanece idêntico — zero impacto no router.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

import redis.asyncio as aioredis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.analysis import Analise
from app.models.lead import Lead
from app.schemas.notificacao import NotificacaoOut
from app.services._queries_fila import (
    DIRECOES_ENTRADA,
    ETAPAS_FINALIZADAS,
    latest_msg_per_lead_subquery,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Redis — cliente lazy singleton
# ---------------------------------------------------------------------------

_redis: Optional[aioredis.Redis] = None
CACHE_TTL = 25  # segundos — just under the 30s poll interval


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


async def _cache_get(key: str) -> Optional[list]:
    try:
        raw = await _get_redis().get(key)
        if raw:
            return json.loads(raw)
    except Exception as exc:
        logger.debug("Redis cache miss (get): %s", exc)
    return None


async def _cache_set(key: str, data: list) -> None:
    try:
        await _get_redis().set(key, json.dumps(data, default=str), ex=CACHE_TTL)
    except Exception as exc:
        logger.debug("Redis cache miss (set): %s", exc)


# ---------------------------------------------------------------------------
# ID estável — sha1(tipo:lead_id:bucket)
# ---------------------------------------------------------------------------

def _make_id(tipo: str, lead_id: str, reference_dt: datetime) -> str:
    """Gera ID determinístico para evitar duplicatas entre polls."""
    BUCKET_FN = {
        "lead_quente_sem_resposta": lambda dt: dt.strftime("%Y-%m-%dT") + str((dt.hour // 4) * 4).zfill(2),
        "sem_resposta_24h":         lambda dt: dt.strftime("%Y-%m-%dT") + str((dt.hour // 4) * 4).zfill(2),
        "potencial_fechamento":     lambda dt: dt.strftime("%Y-%m-%d"),
        "followup_vencido":         lambda dt: dt.strftime("%Y-%m-%d"),
        "lead_novo":                lambda dt: dt.strftime("%Y-%m-%dT%H"),
    }
    bucket = BUCKET_FN[tipo](reference_dt)
    raw = f"{tipo}:{lead_id}:{bucket}"
    return hashlib.sha1(raw.encode()).hexdigest()[:24]


def _fmt_nome(nome: Optional[str], whatsapp: str) -> str:
    return nome or whatsapp


# ---------------------------------------------------------------------------
# Lógica de cada tipo de notificação
# ---------------------------------------------------------------------------

# Mantido por retrocompatibilidade — list (não set) preserva comportamento
# anterior com `notin_`. Conteúdo espelha ETAPAS_FINALIZADAS.
_ETAPAS_FECHADAS = list(ETAPAS_FINALIZADAS)


async def _query_followup_vencido(
    cliente_id: UUID,
    db: AsyncSession,
    now: datetime,
) -> list[NotificacaoOut]:
    """Follow-up agendado no passado para lead ainda ativo."""
    rows = (
        await db.execute(
            select(Lead)
            .where(
                Lead.cliente_id == cliente_id,
                Lead.ativo == True,
                Lead.bloqueado == False,
                Lead.followup_em.is_not(None),
                Lead.followup_em < now,
                func.lower(Lead.etapa_funil).notin_(_ETAPAS_FECHADAS),
            )
            .order_by(Lead.followup_em.asc())
            .limit(30)
        )
    ).scalars().all()

    notifs = []
    for lead in rows:
        fup = lead.followup_em
        if fup.tzinfo is None:
            fup = fup.replace(tzinfo=timezone.utc)
        data_fmt = fup.strftime("%d/%m às %H:%M")
        notifs.append(
            NotificacaoOut(
                id=_make_id("followup_vencido", str(lead.id), fup),
                tipo="followup_vencido",
                titulo="Follow-up vencido",
                descricao=f"{_fmt_nome(lead.nome, lead.whatsapp)} — previsto para {data_fmt}",
                lead_id=str(lead.id),
                lead_nome=lead.nome,
                lead_whatsapp=lead.whatsapp,
                prioridade=1,
                icone="⏰",
                cor_hex="#f97316",
                criado_em=fup,
                gerado_em=now,
            )
        )
    return notifs


async def _query_potencial_fechamento(
    cliente_id: UUID,
    db: AsyncSession,
    now: datetime,
) -> list[NotificacaoOut]:
    """Leads com kpi_score_fechamento ≥ 7, não fechados, análise recente (≤ 7 dias)."""
    recent_cutoff = now - timedelta(days=7)

    # Subquery: análise mais recente por lead
    latest_analise_sq = (
        select(
            Analise.lead_id.label("lead_id"),
            func.max(Analise.created_at).label("max_at"),
        )
        .where(Analise.cliente_id == cliente_id)
        .group_by(Analise.lead_id)
        .subquery()
    )

    rows = (
        await db.execute(
            select(Lead, Analise)
            .join(latest_analise_sq, Lead.id == latest_analise_sq.c.lead_id)
            .join(
                Analise,
                (Analise.lead_id == latest_analise_sq.c.lead_id)
                & (Analise.created_at == latest_analise_sq.c.max_at)
                & (Analise.cliente_id == cliente_id),
            )
            .where(
                Lead.cliente_id == cliente_id,
                Lead.ativo == True,
                Lead.bloqueado == False,
                func.lower(Lead.etapa_funil).notin_(_ETAPAS_FECHADAS),
                Analise.kpi_score_fechamento >= 7,
                Analise.created_at >= recent_cutoff,
            )
            .limit(20)
        )
    ).all()

    notifs = []
    for lead, analise in rows:
        score = float(analise.kpi_score_fechamento or 0)
        notifs.append(
            NotificacaoOut(
                id=_make_id("potencial_fechamento", str(lead.id), analise.created_at),
                tipo="potencial_fechamento",
                titulo="Potencial de fechamento",
                descricao=f"{_fmt_nome(lead.nome, lead.whatsapp)} com score {score:.0f}/10 — pronto para fechar",
                lead_id=str(lead.id),
                lead_nome=lead.nome,
                lead_whatsapp=lead.whatsapp,
                prioridade=2,
                icone="📈",
                cor_hex="#22c55e",
                criado_em=analise.created_at,
                gerado_em=now,
            )
        )
    return notifs


async def _query_sem_resposta(
    cliente_id: UUID,
    db: AsyncSession,
    now: datetime,
    threshold_hours: int,
    tipo: str,
    titulo: str,
    icone: str,
    cor_hex: str,
    prioridade: int,
    limite: int = 20,
) -> list[NotificacaoOut]:
    """
    Query compartilhada: última msg de entrada, sem saída,
    há mais de threshold_hours horas.
    Usada por `lead_quente_sem_resposta` e `sem_resposta_24h`.
    """
    threshold = now - timedelta(hours=threshold_hours)

    latest_msg_sq = latest_msg_per_lead_subquery(cliente_id)

    rows = (
        await db.execute(
            select(Lead, latest_msg_sq.c.enviada_em)
            .join(
                latest_msg_sq,
                (Lead.id == latest_msg_sq.c.lead_id) & (latest_msg_sq.c.rn == 1),
            )
            .where(
                Lead.cliente_id == cliente_id,
                Lead.ativo == True,
                Lead.bloqueado == False,
                latest_msg_sq.c.direcao.in_(list(DIRECOES_ENTRADA)),
                latest_msg_sq.c.enviada_em <= threshold,
                func.lower(Lead.etapa_funil).notin_(_ETAPAS_FECHADAS),
            )
            .limit(limite)
        )
    ).all()

    notifs = []
    for lead, enviada_em in rows:
        tz_enviada = enviada_em.replace(tzinfo=timezone.utc) if enviada_em.tzinfo is None else enviada_em
        horas = int((now - tz_enviada).total_seconds() // 3600)
        notifs.append(
            NotificacaoOut(
                id=_make_id(tipo, str(lead.id), tz_enviada),
                tipo=tipo,  # type: ignore[arg-type]
                titulo=titulo,
                descricao=f"{_fmt_nome(lead.nome, lead.whatsapp)} aguarda retorno há {horas}h",
                lead_id=str(lead.id),
                lead_nome=lead.nome,
                lead_whatsapp=lead.whatsapp,
                prioridade=prioridade,
                icone=icone,
                cor_hex=cor_hex,
                criado_em=tz_enviada,
                gerado_em=now,
            )
        )
    return notifs


async def _query_lead_novo(
    cliente_id: UUID,
    db: AsyncSession,
    now: datetime,
) -> list[NotificacaoOut]:
    """Leads criados nas últimas 2 horas."""
    cutoff = now - timedelta(hours=2)

    rows = (
        await db.execute(
            select(Lead)
            .where(
                Lead.cliente_id == cliente_id,
                Lead.ativo == True,
                Lead.created_at >= cutoff,
            )
            .order_by(Lead.created_at.desc())
            .limit(20)
        )
    ).scalars().all()

    notifs = []
    for lead in rows:
        created = lead.created_at.replace(tzinfo=timezone.utc) if lead.created_at.tzinfo is None else lead.created_at
        notifs.append(
            NotificacaoOut(
                id=_make_id("lead_novo", str(lead.id), created),
                tipo="lead_novo",
                titulo="Novo lead",
                descricao=f"{_fmt_nome(lead.nome, lead.whatsapp)} ({lead.whatsapp}) acabou de entrar",
                lead_id=str(lead.id),
                lead_nome=lead.nome,
                lead_whatsapp=lead.whatsapp,
                prioridade=3,
                icone="🆕",
                cor_hex="#6366f1",
                criado_em=created,
                gerado_em=now,
            )
        )
    return notifs


# ---------------------------------------------------------------------------
# Função principal
# ---------------------------------------------------------------------------

async def get_notificacoes(
    cliente_id: UUID,
    db: AsyncSession,
) -> list[NotificacaoOut]:
    """
    Retorna notificações computadas para o tenant.
    Cache Redis de 25s para absorver polls de 30s sem sobrecarregar o banco.
    """
    cache_key = f"notif:{cliente_id}"

    cached = await _cache_get(cache_key)
    if cached is not None:
        return [NotificacaoOut(**item) for item in cached]

    now = datetime.now(timezone.utc)
    all_notifs: list[NotificacaoOut] = []

    # Cada query roda sequencialmente — AsyncSession não é thread-safe para gather
    queries = [
        _query_sem_resposta(
            cliente_id, db, now,
            threshold_hours=4,
            tipo="lead_quente_sem_resposta",
            titulo="Lead quente sem resposta",
            icone="🔥",
            cor_hex="#ef4444",
            prioridade=1,
        ),
        _query_followup_vencido(cliente_id, db, now),
        _query_potencial_fechamento(cliente_id, db, now),
        _query_sem_resposta(
            cliente_id, db, now,
            threshold_hours=24,
            tipo="sem_resposta_24h",
            titulo="Sem resposta há 24h",
            icone="💬",
            cor_hex="#f59e0b",
            prioridade=2,
        ),
        _query_lead_novo(cliente_id, db, now),
    ]

    seen_ids: set[str] = set()
    for coro in queries:
        try:
            results = await coro
            for n in results:
                # Deduplica (lead_quente é subconjunto de sem_resposta_24h)
                if n.id not in seen_ids:
                    seen_ids.add(n.id)
                    all_notifs.append(n)
        except Exception as exc:
            logger.warning("Erro ao computar notificações: %s", exc)

    # Ordena: prioridade asc, depois mais recente primeiro
    all_notifs.sort(key=lambda n: (n.prioridade, -n.criado_em.timestamp()))

    await _cache_set(cache_key, [n.model_dump() for n in all_notifs])
    return all_notifs
