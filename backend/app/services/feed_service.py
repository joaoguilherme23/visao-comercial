"""
feed_service — listagem de leads para a página /feed.

Diferente do kanban (que separa por etapa), o feed traz TUDO em ordem de
urgência. Cards com ação_requerida (próximo_passo preenchido) e/ou
urgência alta na análise vão pro topo. Faz polling de 30s pelo frontend.

Comentários internos: count por lead via subquery.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy import select, func, desc, or_, case, cast, Integer, and_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.models.lead import Lead
from app.models.analysis import Analise
from app.models.comentario import ComentarioLead
from app.models.tenant import Cliente
from app.schemas.feed import FeedCardOut, FeedListOut
from app.schemas.kanban import AnaliseCardOut, KpiCardOut


# ── Pesos de urgência ────────────────────────────────────────────────────────
# Calibrado pra que ação_requerida sempre ganhe de qualquer outro fator.
# Ex.: lead frio com ação > lead quente sem ação.
W_ACAO_REQUERIDA = 1000
URG_WEIGHTS = {"alta": 300, "alto": 300, "media": 150, "média": 150, "baixa": 50, "baixo": 50}
TEMP_WEIGHTS = {"quente": 200, "morno": 100, "frio": 0}


def _calc_urgencia_score(
    *,
    acao_requerida: bool,
    urgencia_str: Optional[str],
    temperatura: Optional[str],
    score_lead: Optional[float],
) -> int:
    s = 0
    if acao_requerida:
        s += W_ACAO_REQUERIDA
    if urgencia_str:
        s += URG_WEIGHTS.get(urgencia_str.strip().lower(), 0)
    if temperatura:
        s += TEMP_WEIGHTS.get(temperatura.strip().lower(), 0)
    if score_lead is not None:
        try:
            s += int(round(float(score_lead)))
        except (ValueError, TypeError):
            pass
    return s


def _build_kpi_objects(analise: Analise | None):
    if not analise:
        return None, None
    dados = analise.kpi_dados or {}
    payload = {
        "urgencia": analise.kpi_urgencia or dados.get("urgencia"),
        "score_fechamento": analise.kpi_score_fechamento if analise.kpi_score_fechamento is not None else dados.get("score_fechamento"),
        "proximo_contato": analise.kpi_proximo_contato or dados.get("proximo_contato"),
        "dados": dados or None,
    }
    has_value = any(v is not None for k, v in payload.items() if k != "dados") or bool(dados)
    kpi = KpiCardOut.model_validate(payload) if has_value else None
    return kpi, (dados or None)


async def listar_feed(
    db: AsyncSession,
    cliente_id: UUID,
    *,
    search: Optional[str] = None,
    temperatura: Optional[str] = None,
    etapa_funil: Optional[str] = None,
    so_acao_requerida: bool = False,
    telefone_bot: Optional[str] = None,
    offset: int = 0,
    limit: int = 50,
) -> FeedListOut:
    """
    Lista paginada do feed com ordenação por urgência calculada no SQL.

    Ordenação: `urgencia_score DESC, updated_at DESC`. A fórmula é a mesma
    do `_calc_urgencia_score` (mantida em paridade pra fallback ou debug):

      score = (proximo_passo? 1000 : 0)
            + urgencia_pesos (alta=300, média=150, baixa=50)
            + temp_pesos (quente=200, morno=100, frio=0)
            + ROUND(lead.score)

    Paginação: offset/limit. `has_more` = (offset + len(items) < total).
    """
    if limit < 1:
        limit = 1
    if limit > 200:
        limit = 200
    if offset < 0:
        offset = 0

    # Cliente (pra pegar nicho)
    cli_res = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = cli_res.scalar_one_or_none()
    nicho = cliente.nicho if cliente else None

    now = datetime.now(timezone.utc)

    # Subquery: última análise por lead via row_number — mais barata que MAX+JOIN
    # quando há muitos leads (Postgres pode usar o index analise(lead_id, created_at)).
    latest_analise_sq = (
        select(
            Analise.lead_id.label("lead_id"),
            Analise.id.label("a_id"),
            Analise.resumo_curto,
            Analise.sentimento,
            Analise.score_interesse,
            Analise.intencao,
            Analise.proximo_passo,
            Analise.kpi_urgencia,
            Analise.kpi_dados,
            Analise.kpi_score_fechamento,
            Analise.kpi_proximo_contato,
            Analise.created_at.label("a_created_at"),
            func.row_number()
            .over(partition_by=Analise.lead_id, order_by=desc(Analise.created_at))
            .label("rn"),
        )
        .where(Analise.cliente_id == cliente_id)
        .subquery()
    )

    # Filtro: só análise com rn=1 (a mais recente)
    latest_analise = (
        select(latest_analise_sq)
        .where(latest_analise_sq.c.rn == 1)
        .subquery()
    )

    # Cálculo do urgencia_score em SQL ────────────────────────────────────────
    # 1. ação_requerida = proximo_passo é não-nulo e não-vazio (após trim)
    proximo_passo_norm = func.coalesce(func.trim(latest_analise.c.proximo_passo), "")
    has_acao = (proximo_passo_norm != "").label("acao_requerida")

    # 2. urgência da análise — tenta kpi_urgencia, senão dados->>'urgencia'
    urgencia_str = func.coalesce(
        func.lower(latest_analise.c.kpi_urgencia),
        func.lower(latest_analise.c.kpi_dados.op("->>")("urgencia")),
    )

    urgencia_score_sql = (
        case((has_acao, 1000), else_=0)
        # urgência da análise
        + case(
            (or_(urgencia_str == "alta", urgencia_str == "alto"), 300),
            (or_(urgencia_str == "media", urgencia_str == "média"), 150),
            (or_(urgencia_str == "baixa", urgencia_str == "baixo"), 50),
            else_=0,
        )
        # temperatura
        + case(
            (func.lower(Lead.temperatura) == "quente", 200),
            (func.lower(Lead.temperatura) == "morno", 100),
            else_=0,
        )
        # score do lead (round)
        + case(
            (Lead.score.is_(None), 0),
            else_=cast(func.round(Lead.score), Integer),
        )
    ).label("urgencia_score")

    # Filtros base do lead
    base_where = and_(
        Lead.cliente_id == cliente_id,
        Lead.ativo == True,
        Lead.concluido_no_feed == False,
        or_(Lead.feed_snooze_ate.is_(None), Lead.feed_snooze_ate < now),
    )
    extra_filters = []
    if temperatura:
        extra_filters.append(func.lower(Lead.temperatura) == temperatura.strip().lower())
    if etapa_funil:
        extra_filters.append(func.lower(Lead.etapa_funil) == etapa_funil.strip().lower())
    if telefone_bot:
        extra_filters.append(Lead.telefone_bot == telefone_bot.strip())
    if search:
        pattern = search.replace("%", r"\%").replace("_", r"\_")
        extra_filters.append(
            Lead.nome.ilike(f"%{pattern}%") | Lead.whatsapp.ilike(f"%{pattern}%")
        )
    if so_acao_requerida:
        extra_filters.append(proximo_passo_norm != "")

    where_clause = and_(base_where, *extra_filters) if extra_filters else base_where

    # Query total (count) — barata com o index ix_leads_feed_visible
    total_q = (
        select(func.count(Lead.id))
        .select_from(Lead)
        .outerjoin(latest_analise, latest_analise.c.lead_id == Lead.id)
        .where(where_clause)
    )
    total_res = await db.execute(total_q)
    total = int(total_res.scalar() or 0)

    if total == 0:
        return FeedListOut(items=[], total=0, has_more=False, next_offset=None)

    # Query principal — leads paginados, ordenados por urgência
    main_q = (
        select(
            Lead,
            urgencia_score_sql,
            has_acao,
            latest_analise.c.a_id,
            latest_analise.c.resumo_curto,
            latest_analise.c.sentimento,
            latest_analise.c.score_interesse,
            latest_analise.c.intencao,
            latest_analise.c.proximo_passo,
            latest_analise.c.kpi_urgencia,
            latest_analise.c.kpi_dados,
            latest_analise.c.kpi_score_fechamento,
            latest_analise.c.kpi_proximo_contato,
            latest_analise.c.a_created_at,
        )
        .select_from(Lead)
        .outerjoin(latest_analise, latest_analise.c.lead_id == Lead.id)
        .where(where_clause)
        .order_by(desc("urgencia_score"), desc(Lead.updated_at))
        .offset(offset)
        .limit(limit)
    )

    res = await db.execute(main_q)
    rows = res.all()

    if not rows:
        return FeedListOut(
            items=[],
            total=total,
            has_more=False,
            next_offset=None,
        )

    lead_ids = [row[0].id for row in rows]

    # Comentários count — só dos leads desta página
    com_res = await db.execute(
        select(ComentarioLead.lead_id, func.count(ComentarioLead.id))
        .where(ComentarioLead.lead_id.in_(lead_ids))
        .group_by(ComentarioLead.lead_id)
    )
    comentarios_count_map: dict[UUID, int] = {row[0]: int(row[1]) for row in com_res.all()}

    items: list[FeedCardOut] = []
    for row in rows:
        lead = row[0]
        urgencia_score_int = int(row[1] or 0)
        acao_requerida_bool = bool(row[2])

        # Reconstrói kpi/kpi_generico a partir das colunas da subquery
        kpi_dados = row.kpi_dados or {}
        kpi_payload = {
            "urgencia": row.kpi_urgencia or kpi_dados.get("urgencia"),
            "score_fechamento": (
                float(row.kpi_score_fechamento)
                if row.kpi_score_fechamento is not None
                else kpi_dados.get("score_fechamento")
            ),
            "proximo_contato": row.kpi_proximo_contato or kpi_dados.get("proximo_contato"),
            "dados": kpi_dados or None,
        }
        has_kpi = any(v is not None for k, v in kpi_payload.items() if k != "dados") or bool(kpi_dados)
        kpi_out = KpiCardOut.model_validate(kpi_payload) if has_kpi else None

        # AnaliseCardOut só se houver análise de fato (a_id não-nulo)
        ultima_analise = None
        if row.a_id is not None:
            ultima_analise = AnaliseCardOut.model_validate({
                "id": row.a_id,
                "resumo_curto": row.resumo_curto,
                "sentimento": row.sentimento,
                "score_interesse": (
                    float(row.score_interesse) if row.score_interesse is not None else None
                ),
                "intencao": row.intencao,
                "proximo_passo": row.proximo_passo,
                "created_at": row.a_created_at,
            })

        items.append(FeedCardOut(
            id=lead.id,
            whatsapp=lead.whatsapp,
            nome=lead.nome,
            temperatura=lead.temperatura,
            score=float(lead.score) if lead.score is not None else None,
            etapa_funil=lead.etapa_funil,
            bloqueado=lead.bloqueado,
            foto_url=lead.foto_url,
            created_at=lead.created_at,
            updated_at=lead.updated_at,
            nicho=nicho,
            ultima_analise=ultima_analise,
            kpi=kpi_out,
            kpi_generico=(kpi_dados or None),
            acao_requerida=acao_requerida_bool,
            urgencia_score=urgencia_score_int,
            comentarios_count=comentarios_count_map.get(lead.id, 0),
        ))

    has_more = (offset + len(items)) < total
    next_offset = offset + len(items) if has_more else None

    return FeedListOut(
        items=items,
        total=total,
        has_more=has_more,
        next_offset=next_offset,
    )


async def listar_comentarios(
    db: AsyncSession,
    cliente_id: UUID,
    lead_id: UUID,
) -> list[ComentarioLead]:
    res = await db.execute(
        select(ComentarioLead)
        .where(ComentarioLead.cliente_id == cliente_id, ComentarioLead.lead_id == lead_id)
        .order_by(desc(ComentarioLead.created_at))
    )
    return list(res.scalars().all())


async def criar_comentario(
    db: AsyncSession,
    *,
    cliente_id: UUID,
    lead_id: UUID,
    user_id: UUID,
    autor_nome: str,
    texto: str,
) -> ComentarioLead:
    # Valida que o lead existe nesse cliente — evita comentário "fantasma"
    lead_res = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.cliente_id == cliente_id, Lead.ativo == True)
    )
    if not lead_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Lead não encontrado")

    com = ComentarioLead(
        cliente_id=cliente_id,
        lead_id=lead_id,
        user_id=user_id,
        autor_nome=autor_nome,
        texto=texto.strip(),
        created_at=datetime.now(timezone.utc),
    )
    db.add(com)
    await db.flush()
    await db.refresh(com)
    return com


# ── Concluir / desfazer / snooze ─────────────────────────────────────────────

async def _get_lead(db: AsyncSession, cliente_id: UUID, lead_id: UUID) -> Lead:
    res = await db.execute(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.cliente_id == cliente_id,
            Lead.ativo == True,
        )
    )
    lead = res.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    return lead


async def marcar_concluido(db: AsyncSession, cliente_id: UUID, lead_id: UUID) -> Lead:
    """Marca lead como concluído no feed — some da listagem."""
    lead = await _get_lead(db, cliente_id, lead_id)
    lead.concluido_no_feed = True
    # Se estava em snooze, limpa — concluído tem precedência
    lead.feed_snooze_ate = None
    await db.flush()
    await db.refresh(lead)
    return lead


async def desfazer_conclusao(db: AsyncSession, cliente_id: UUID, lead_id: UUID) -> Lead:
    """Reverte o concluído_no_feed pra que o card volte ao feed."""
    lead = await _get_lead(db, cliente_id, lead_id)
    lead.concluido_no_feed = False
    await db.flush()
    await db.refresh(lead)
    return lead


# Presets de snooze (em horas) — frontend envia esse mesmo enum
SNOOZE_PRESETS_HOURS = {
    "1h": 1,
    "3h": 3,
    "6h": 6,
    "1d": 24,
    "3d": 72,
}


async def snooze_lead(
    db: AsyncSession,
    cliente_id: UUID,
    lead_id: UUID,
    *,
    preset: Optional[str] = None,
    ate: Optional[datetime] = None,
) -> Lead:
    """Soneca o card até `ate` (timestamp) ou `preset` ("1h", "3h", "6h", "1d", "3d")."""
    if not preset and not ate:
        raise HTTPException(status_code=400, detail="Informe 'preset' ou 'ate'")

    lead = await _get_lead(db, cliente_id, lead_id)

    if preset:
        if preset not in SNOOZE_PRESETS_HOURS:
            raise HTTPException(
                status_code=400,
                detail=f"Preset inválido. Aceita: {list(SNOOZE_PRESETS_HOURS)}",
            )
        target = datetime.now(timezone.utc) + timedelta(hours=SNOOZE_PRESETS_HOURS[preset])
    else:
        # ate vindo do frontend já como timestamp UTC
        target = ate
        if target.tzinfo is None:
            target = target.replace(tzinfo=timezone.utc)

    lead.feed_snooze_ate = target
    await db.flush()
    await db.refresh(lead)
    return lead


async def unsnooze_lead(db: AsyncSession, cliente_id: UUID, lead_id: UUID) -> Lead:
    """Limpa o snooze — card volta imediatamente ao feed."""
    lead = await _get_lead(db, cliente_id, lead_id)
    lead.feed_snooze_ate = None
    await db.flush()
    await db.refresh(lead)
    return lead
