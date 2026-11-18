"""Fila PostgreSQL segura para despachar análises ao worker Python.

As transições de estado ocorrem no banco.  O worker pode morrer entre o
dispatch e o callback: o lease expira, a tentativa é retomada e recebe um novo
token.  Nenhuma credencial, conversa ou resposta de LLM é registrada em log.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, case, desc, exists, func, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.config import settings
from app.models.analysis import Analise
from app.models.analysis_job import AnalysisJob
from app.models.lead import Lead
from app.models.message import Mensagem
from app.models.numero import NumeroBot
from app.models.tenant import Cliente
from app.schemas.internal_analysis import (
    AnalysisCallbackOut,
    AnalysisContextOut,
    AnalysisResultInput,
    ContextMessage,
)


PENDING = "pending"
LEASED = "leased"
DISPATCHED = "dispatched"
COMPLETED = "completed"
SUPERSEDED = "superseded"
DEAD = "dead"
ACTIVE_STATUSES = (PENDING, LEASED, DISPATCHED)


class AnalysisJobAuthError(Exception):
    """Token de job ausente, inválido ou expirado."""


class AnalysisJobConflict(Exception):
    """Token válido para um job que já não pode executar esta operação."""


@dataclass(frozen=True)
class ClaimedAnalysisJob:
    job_id: uuid.UUID
    lease_id: uuid.UUID


@dataclass(frozen=True)
class AnalysisDispatch:
    job_id: uuid.UUID
    lease_id: uuid.UUID
    token: str


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _int_setting(name: str, default: int) -> int:
    value = getattr(settings, name, default)
    return value if isinstance(value, int) and value > 0 else default


def _newer_job_predicate(job: AnalysisJob, newer: Any) -> Any:
    return and_(
        newer.cliente_id == job.cliente_id,
        newer.numero_bot_id == job.numero_bot_id,
        newer.lead_id == job.lead_id,
        newer.status.in_(ACTIVE_STATUSES + (COMPLETED,)),
        or_(
            newer.source_message_at > job.source_message_at,
            and_(
                newer.source_message_at == job.source_message_at,
                newer.created_at > job.created_at,
            ),
        ),
    )


async def _lock_conversation(
    db: AsyncSession, numero_bot_id: uuid.UUID, lead_id: uuid.UUID
) -> None:
    """Serializa coalescência por conversa sem bloquear outras conversas."""
    key = f"analysis:{numero_bot_id}:{lead_id}"
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"), {"key": key}
    )


async def enqueue_analysis(
    db: AsyncSession,
    *,
    cliente_id: uuid.UUID,
    numero_bot_id: uuid.UUID,
    lead_id: uuid.UUID,
    message_id: uuid.UUID,
    connection_generation: uuid.UUID,
) -> AnalysisJob | None:
    """Inclui uma análise na transação da ingestão.

    A unicidade de ``message_id`` torna reentregas do provedor inofensivas. Ao
    chegar mensagem mais recente, trabalhos ainda pendentes daquela conversa
    são coalescidos, sem cancelar trabalho já entregue ao provedor de IA.
    """
    numero = await db.scalar(
        select(NumeroBot).where(
            NumeroBot.id == numero_bot_id,
            NumeroBot.cliente_id == cliente_id,
            NumeroBot.connection_generation == connection_generation,
            NumeroBot.ativo.is_(True),
            NumeroBot.analysis_enabled.is_(True),
        ).with_for_update()
    )
    if numero is None:
        return None

    await _lock_conversation(db, numero_bot_id, lead_id)
    existing = await db.scalar(
        select(AnalysisJob).where(AnalysisJob.message_id == message_id).with_for_update()
    )
    if existing is not None:
        return existing

    sent_at = await db.scalar(
        select(Mensagem.enviada_em).where(
            Mensagem.id == message_id,
            Mensagem.cliente_id == cliente_id,
            Mensagem.numero_bot_id == numero_bot_id,
            Mensagem.lead_id == lead_id,
        )
    )
    if sent_at is None:
        raise ValueError("mensagem não pertence à conversa informada")

    now = _utcnow()
    latest = await db.scalar(
        select(AnalysisJob)
        .where(
            AnalysisJob.cliente_id == cliente_id,
            AnalysisJob.numero_bot_id == numero_bot_id,
            AnalysisJob.lead_id == lead_id,
            AnalysisJob.status.in_(ACTIVE_STATUSES + (COMPLETED,)),
        )
        .order_by(AnalysisJob.source_message_at.desc(), AnalysisJob.created_at.desc())
        .limit(1)
    )
    incoming_is_older = latest is not None and sent_at < latest.source_message_at
    if not incoming_is_older:
        await db.execute(
            update(AnalysisJob)
            .where(
                AnalysisJob.cliente_id == cliente_id,
                AnalysisJob.numero_bot_id == numero_bot_id,
                AnalysisJob.lead_id == lead_id,
                AnalysisJob.status == PENDING,
            )
            .values(status=SUPERSEDED, completed_at=now, updated_at=now)
        )
    job = AnalysisJob(
        cliente_id=cliente_id,
        numero_bot_id=numero_bot_id,
        lead_id=lead_id,
        message_id=message_id,
        connection_generation=connection_generation,
        source_message_at=sent_at,
        status=SUPERSEDED if incoming_is_older else PENDING,
        available_at=now,
        completed_at=now if incoming_is_older else None,
        last_error_code="out_of_order_message" if incoming_is_older else None,
    )
    db.add(job)
    await db.flush()
    return job


async def enqueue_analysis_backlog(
    db: AsyncSession,
    *,
    cliente_id: uuid.UUID,
    numero_bot_id: uuid.UUID,
    limit: int = 10,
    minimum_messages: int = 5,
) -> list[AnalysisJob]:
    """Queue one bounded historical batch for one active connection only.

    This is the Python equivalent of the retired expansion flow. It is opt-in:
    callers must provide a tenant and number, rows without ``numero_bot_id``
    are excluded, and a batch can never become an unbounded LLM charge.
    """
    if not 1 <= limit <= 100:
        raise ValueError("limit deve estar entre 1 e 100")
    if not 1 <= minimum_messages <= 1_000:
        raise ValueError("minimum_messages deve estar entre 1 e 1000")

    numero = await db.scalar(
        select(NumeroBot).where(
            NumeroBot.id == numero_bot_id,
            NumeroBot.cliente_id == cliente_id,
            NumeroBot.ativo.is_(True),
            NumeroBot.sync_enabled.is_(True),
            NumeroBot.analysis_enabled.is_(True),
        )
    )
    if numero is None:
        return []

    message_count = (
        select(func.count(Mensagem.id))
        .where(
            Mensagem.cliente_id == cliente_id,
            Mensagem.numero_bot_id == numero_bot_id,
            Mensagem.lead_id == Lead.id,
        )
        .correlate(Lead)
        .scalar_subquery()
    )
    latest_message_id = (
        select(Mensagem.id)
        .where(
            Mensagem.cliente_id == cliente_id,
            Mensagem.numero_bot_id == numero_bot_id,
            Mensagem.lead_id == Lead.id,
        )
        .order_by(desc(Mensagem.enviada_em), desc(Mensagem.id))
        .limit(1)
        .correlate(Lead)
        .scalar_subquery()
    )
    real_analysis = exists(
        select(Analise.id).where(
            Analise.cliente_id == cliente_id,
            Analise.lead_id == Lead.id,
            Analise.modelo_ia.is_not(None),
            Analise.modelo_ia != "migracao",
        )
    )
    current_message_already_queued = exists(
        select(AnalysisJob.id).where(AnalysisJob.message_id == latest_message_id)
    )
    temperature_order = case(
        (func.lower(func.coalesce(Lead.temperatura, "")) == "quente", 1),
        (func.lower(func.coalesce(Lead.temperatura, "")) == "morno", 2),
        (func.lower(func.coalesce(Lead.temperatura, "")) == "frio", 3),
        else_=4,
    )
    candidates = await db.execute(
        select(Lead.id, latest_message_id.label("message_id"))
        .where(
            Lead.cliente_id == cliente_id,
            Lead.numero_bot_id == numero_bot_id,
            Lead.ativo.is_(True),
            message_count >= minimum_messages,
            ~real_analysis,
            ~current_message_already_queued,
        )
        .order_by(temperature_order, Lead.updated_at.desc(), Lead.id)
        .limit(limit)
    )
    jobs: list[AnalysisJob] = []
    for lead_id, message_id in candidates:
        if message_id is None:
            continue
        job = await enqueue_analysis(
            db,
            cliente_id=cliente_id,
            numero_bot_id=numero_bot_id,
            lead_id=lead_id,
            message_id=message_id,
            connection_generation=numero.connection_generation,
        )
        if job is not None:
            jobs.append(job)
    return jobs


async def claim_due_jobs(
    db: AsyncSession, *, limit: int = 10, max_attempts: int | None = None
) -> list[ClaimedAnalysisJob]:
    """Claim concorrente com ``FOR UPDATE SKIP LOCKED`` e lease finito.

    Deve ser chamado dentro de uma transação curta. O dispatch HTTP ocorre
    depois do commit, para não manter locks do banco durante I/O de rede.
    """
    now = _utcnow()
    max_tries = max_attempts or _int_setting("X9_ANALYSIS_MAX_ATTEMPTS", 5)
    lease_seconds = _int_setting("X9_ANALYSIS_LEASE_SECONDS", 300)

    await db.execute(
        update(AnalysisJob)
        .where(
            AnalysisJob.status.in_(ACTIVE_STATUSES),
            AnalysisJob.attempts >= max_tries,
            or_(
                AnalysisJob.status == PENDING,
                AnalysisJob.lease_expires_at <= now,
            ),
        )
        .values(status=DEAD, completed_at=now, last_error_code="attempts_exhausted", updated_at=now)
    )

    newer = aliased(AnalysisJob)
    candidates = (
        select(AnalysisJob)
        .where(
            AnalysisJob.attempts < max_tries,
            or_(
                and_(AnalysisJob.status == PENDING, AnalysisJob.available_at <= now),
                and_(
                    AnalysisJob.status.in_((LEASED, DISPATCHED)),
                    AnalysisJob.lease_expires_at <= now,
                ),
            ),
            ~exists(select(newer.id).where(_newer_job_predicate(AnalysisJob, newer))),
        )
        .order_by(AnalysisJob.source_message_at, AnalysisJob.created_at)
        .with_for_update(skip_locked=True)
        .limit(limit)
    )
    jobs = list((await db.execute(candidates)).scalars())
    claimed: list[ClaimedAnalysisJob] = []
    for job in jobs:
        lease_id = uuid.uuid4()
        job.status = LEASED
        job.attempts += 1
        job.lease_id = lease_id
        job.lease_expires_at = now + timedelta(seconds=lease_seconds)
        job.workflow_token_hash = None
        job.workflow_token_expires_at = None
        job.last_error_code = None
        claimed.append(ClaimedAnalysisJob(job.id, lease_id))
    await db.flush()
    return claimed


async def prepare_dispatch(
    db: AsyncSession, claimed: ClaimedAnalysisJob) -> AnalysisDispatch | None:
    """Emite token de uso restrito imediatamente antes da chamada ao provedor."""
    seed = (
        await db.execute(
            select(AnalysisJob.numero_bot_id, AnalysisJob.cliente_id, AnalysisJob.lead_id)
            .where(AnalysisJob.id == claimed.job_id)
        )
    ).one_or_none()
    if seed is None:
        return None
    # Ordem global de locks: NumeroBot -> conversa (advisory) -> job/lead.
    numero = await db.scalar(
        select(NumeroBot)
        .where(NumeroBot.id == seed.numero_bot_id, NumeroBot.cliente_id == seed.cliente_id)
        .with_for_update()
    )
    if numero is None:
        return None
    await _lock_conversation(db, seed.numero_bot_id, seed.lead_id)
    job = await db.scalar(
        select(AnalysisJob)
        .where(AnalysisJob.id == claimed.job_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if job is None or job.status != LEASED or job.lease_id != claimed.lease_id:
        return None
    tenant_active = await db.scalar(
        select(Cliente.id).where(Cliente.id == job.cliente_id, Cliente.ativo.is_(True))
    )
    now = _utcnow()
    if job.lease_expires_at is None or job.lease_expires_at <= now:
        return None

    newer = aliased(AnalysisJob)
    has_newer = await db.scalar(
        select(exists(select(newer.id).where(_newer_job_predicate(job, newer))))
    )
    if (
        tenant_active is None
        or not numero.ativo
        or not numero.analysis_enabled
        or numero.connection_generation != job.connection_generation
        or has_newer
    ):
        job.status = SUPERSEDED
        job.completed_at = now
        job.last_error_code = "connection_changed" if has_newer is False else "coalesced"
        await db.flush()
        return None

    token = secrets.token_urlsafe(32)
    token_ttl = _int_setting("X9_ANALYSIS_TOKEN_TTL_SECONDS", 900)
    token_expiry = min(
        now + timedelta(seconds=token_ttl),
        job.lease_expires_at,
    )
    job.status = DISPATCHED
    job.workflow_token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    job.workflow_token_expires_at = token_expiry
    job.dispatched_at = now
    await db.flush()
    return AnalysisDispatch(job.id, claimed.lease_id, token)


async def release_dispatch_failure(
    db: AsyncSession,
    dispatch: AnalysisDispatch,
    *,
    error_code: str,
    max_attempts: int | None = None,
) -> None:
    """Libera a tentativa com backoff exponencial, sem guardar a resposta remota."""
    job = await db.scalar(
        select(AnalysisJob).where(AnalysisJob.id == dispatch.job_id).with_for_update()
    )
    if job is None or job.lease_id != dispatch.lease_id or job.status != DISPATCHED:
        return
    now = _utcnow()
    max_tries = max_attempts or _int_setting("X9_ANALYSIS_MAX_ATTEMPTS", 5)
    if job.attempts >= max_tries:
        job.status = DEAD
        job.completed_at = now
        job.last_error_code = "attempts_exhausted"
    else:
        delay_seconds = min(300, 2 ** min(job.attempts, 8))
        job.status = PENDING
        job.available_at = now + timedelta(seconds=delay_seconds)
        job.lease_id = None
        job.lease_expires_at = None
        job.workflow_token_hash = None
        job.workflow_token_expires_at = None
        job.last_error_code = error_code[:80]
    await db.flush()


async def supersede_dispatch(
    db: AsyncSession, dispatch: AnalysisDispatch, *, reason: str = "connection_revoked"
) -> None:
    """Encerra tentativa cujo escopo foi revogado durante I/O externo."""
    job = await db.scalar(
        select(AnalysisJob).where(AnalysisJob.id == dispatch.job_id).with_for_update()
    )
    if job is None or job.lease_id != dispatch.lease_id or job.status != DISPATCHED:
        return
    now = _utcnow()
    job.status = SUPERSEDED
    job.completed_at = now
    job.last_error_code = reason[:80]
    await db.flush()


async def _authenticated_job(
    db: AsyncSession, job_id: uuid.UUID, token: str, *, allow_completed: bool = False
) -> AnalysisJob:
    now = _utcnow()
    job = await db.scalar(select(AnalysisJob).where(AnalysisJob.id == job_id).with_for_update())
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    if (
        job is None
        or not job.workflow_token_hash
        or not hmac.compare_digest(job.workflow_token_hash, token_hash)
        or job.workflow_token_expires_at is None
        or job.workflow_token_expires_at <= now
        or job.lease_expires_at is None
        or job.lease_expires_at <= now
    ):
        raise AnalysisJobAuthError()
    if job.status != DISPATCHED and not (allow_completed and job.status == COMPLETED):
        raise AnalysisJobConflict()
    tenant = await db.scalar(
        select(Cliente.id).where(Cliente.id == job.cliente_id, Cliente.ativo.is_(True))
    )
    if tenant is None:
        raise AnalysisJobConflict()
    numero = await db.scalar(
        select(NumeroBot.id).where(
            NumeroBot.id == job.numero_bot_id,
            NumeroBot.cliente_id == job.cliente_id,
            NumeroBot.connection_generation == job.connection_generation,
            NumeroBot.ativo.is_(True),
            NumeroBot.analysis_enabled.is_(True),
        )
    )
    if numero is None:
        raise AnalysisJobConflict()
    return job


async def build_analysis_context(
    db: AsyncSession, *, job_id: uuid.UUID, token: str
) -> AnalysisContextOut:
    """Monta contexto exclusivamente a partir das referências do job autenticado."""
    job = await _authenticated_job(db, job_id, token)
    tenant = await db.scalar(select(Cliente).where(Cliente.id == job.cliente_id))
    numero = await db.scalar(
        select(NumeroBot).where(NumeroBot.id == job.numero_bot_id, NumeroBot.cliente_id == job.cliente_id)
    )
    lead = await db.scalar(
        select(Lead).where(
            Lead.id == job.lead_id,
            Lead.cliente_id == job.cliente_id,
            Lead.numero_bot_id == job.numero_bot_id,
        )
    )
    if tenant is None or numero is None or lead is None:
        raise AnalysisJobConflict()

    message_limit = _int_setting("X9_ANALYSIS_CONTEXT_MESSAGE_LIMIT", 40)
    char_limit = _int_setting("X9_ANALYSIS_CONTEXT_CHAR_LIMIT", 12_000)
    rows = list(
        (
            await db.execute(
                select(Mensagem)
                .where(
                    Mensagem.cliente_id == job.cliente_id,
                    Mensagem.numero_bot_id == job.numero_bot_id,
                    Mensagem.lead_id == job.lead_id,
                    Mensagem.enviada_em <= job.source_message_at,
                )
                .order_by(Mensagem.enviada_em.desc(), Mensagem.id.desc())
                .limit(message_limit)
            )
        ).scalars()
    )
    # ``rows`` vem em ordem decrescente. Consome o orçamento nessa ordem para
    # garantir que a mensagem que disparou o job nunca seja excluída por um
    # histórico antigo grande; só então restaura ordem cronológica ao prompt.
    selected: list[tuple[Mensagem, str | None]] = []
    used_chars = 0
    for message in rows:
        content = message.conteudo or None
        if content:
            remaining = char_limit - used_chars
            if remaining <= 0:
                break
            content = content[: min(remaining, 4_000)]
            used_chars += len(content)
        selected.append((message, content))
    messages: list[ContextMessage] = []
    for message, content in reversed(selected):
        direction = message.direcao if message.direcao in {"entrada", "saida"} else "outro"
        messages.append(
            ContextMessage(
                direction=direction,
                kind=message.tipo[:30],
                content=content,
                sent_at=message.enviada_em,
            )
        )

    niche: dict[str, Any] | None = None
    if tenant.nicho:
        # Serviço tenant-aware: overrides globais não podem vazar para outro cliente.
        from app.services.tenant_nicho_config import get_effective_nicho_fields

        effective = await get_effective_nicho_fields(db, job.cliente_id, tenant.nicho)
        if effective:
            niche = dict(effective)

    return AnalysisContextOut(
        job_id=job.id,
        tenant={"id": str(tenant.id), "nome": tenant.nome, "nicho": tenant.nicho, "nome_agente": tenant.nome_agente},
        numero={"id": str(numero.id), "nome": numero.nome, "numero": numero.numero},
        lead={
            "id": str(lead.id), "nome": lead.nome, "whatsapp": lead.whatsapp,
            "etapa_funil": lead.etapa_funil, "temperatura": lead.temperatura,
            "score": float(lead.score) if lead.score is not None else None,
        },
        niche=niche,
        messages=messages,
    )


async def complete_analysis_job(
    db: AsyncSession,
    *,
    job_id: uuid.UUID,
    token: str,
    result: AnalysisResultInput,
) -> AnalysisCallbackOut:
    """Persiste uma análise uma única vez, recusando callbacks defasados."""
    seed = (
        await db.execute(
            select(AnalysisJob.numero_bot_id, AnalysisJob.cliente_id, AnalysisJob.lead_id)
            .where(AnalysisJob.id == job_id)
        )
    ).one_or_none()
    if seed is None:
        raise AnalysisJobAuthError()
    # Mesma ordem do webhook de ingestão: número -> conversa -> job/lead.
    locked_numero = await db.scalar(
        select(NumeroBot)
        .where(NumeroBot.id == seed.numero_bot_id, NumeroBot.cliente_id == seed.cliente_id)
        .with_for_update()
    )
    if locked_numero is None:
        raise AnalysisJobConflict()
    await _lock_conversation(db, seed.numero_bot_id, seed.lead_id)
    job = await _authenticated_job(db, job_id, token, allow_completed=True)
    if job.status == COMPLETED:
        return AnalysisCallbackOut(accepted=True, idempotent=True, stale=job.analysis_id is None)

    await _lock_conversation(db, job.numero_bot_id, job.lead_id)
    newer = aliased(AnalysisJob)
    stale = await db.scalar(
        select(exists(select(newer.id).where(_newer_job_predicate(job, newer))))
    )
    now = _utcnow()
    if stale:
        job.status = COMPLETED
        job.completed_at = now
        job.last_error_code = "stale_callback"
        await db.flush()
        return AnalysisCallbackOut(accepted=True, stale=True)

    lead = await db.scalar(
        select(Lead)
        .where(
            Lead.id == job.lead_id,
            Lead.cliente_id == job.cliente_id,
            Lead.numero_bot_id == job.numero_bot_id,
        )
        .with_for_update()
    )
    numero = await db.scalar(
        select(NumeroBot)
        .where(
            NumeroBot.id == job.numero_bot_id,
            NumeroBot.cliente_id == job.cliente_id,
            NumeroBot.connection_generation == job.connection_generation,
        )
        .with_for_update()
    )
    if lead is None or numero is None:
        raise AnalysisJobConflict()

    version = await db.scalar(
        select(func.coalesce(func.max(Analise.versao), 0) + 1).where(
            Analise.cliente_id == job.cliente_id,
            Analise.lead_id == job.lead_id,
            Analise.numero_bot_id == job.numero_bot_id,
        )
    )
    extra = result.extra.model_dump()
    detalhe = {
        "resumo_completo": result.resumo_completo,
        "observacoes": result.observacoes,
        "objecoes": result.objecoes,
        "duvidas": result.duvidas,
        "memoria": result.memoria,
    }
    analysis = Analise(
        cliente_id=job.cliente_id,
        numero_bot_id=job.numero_bot_id,
        lead_id=job.lead_id,
        data_ref=job.source_message_at.date(),
        versao=version,
        resumo_curto=result.resumo_curto,
        sentimento=result.sentimento,
        score_interesse=result.score_interesse,
        intencao=result.intencao,
        proximo_passo=result.proximo_passo,
        modelo_ia=result.modelo_ia,
        tokens_consumidos=result.tokens_consumidos,
        tempo_ms=result.tempo_ms,
        total_msgs=await db.scalar(
            select(func.count(Mensagem.id)).where(
                Mensagem.cliente_id == job.cliente_id,
                Mensagem.numero_bot_id == job.numero_bot_id,
                Mensagem.lead_id == job.lead_id,
                Mensagem.enviada_em <= job.source_message_at,
            )
        ) or 0,
        kpi_dados=result.kpi.dados,
        kpi_score_fechamento=result.kpi.score_fechamento,
        kpi_proximo_contato=result.kpi.proximo_contato,
        kpi_urgencia=result.kpi.urgencia,
        detalhe_json=detalhe,
        extra_json=extra,
    )
    db.add(analysis)
    # UUID default é materializado no flush; vincular antes disso deixaria
    # ``analysis_id`` nulo e quebraria a idempotência do callback.
    await db.flush()
    _apply_legacy_lead_progression(lead, result)
    lead.score = result.score_interesse
    numero.last_analysis_at = now
    job.status = COMPLETED
    job.completed_at = now
    job.analysis_id = analysis.id
    job.last_error_code = None
    await db.flush()
    return AnalysisCallbackOut(accepted=True)


def _apply_legacy_lead_progression(lead: Lead, result: AnalysisResultInput) -> None:
    """Apply the deterministic lead effects of the retired analysis flow."""
    closing_score = result.kpi.score_fechamento
    lead.temperatura = (
        "quente" if closing_score >= 0.80 else "morno" if closing_score >= 0.45 else "frio"
    )
    stage = lead.etapa_funil
    if closing_score >= 0.90 and stage not in {"Fechado", "Perdido"}:
        lead.etapa_funil = "Fechamento"
    elif closing_score >= 0.70 and stage in {"Novo", "Contato", "Qualificado", "Interesse"}:
        lead.etapa_funil = "Proposta"
    elif closing_score >= 0.50 and stage in {"Novo", "Contato", "Qualificado"}:
        lead.etapa_funil = "Interesse"
    elif result.score_interesse >= 4.0 and stage == "Novo":
        lead.etapa_funil = "Qualificado"
