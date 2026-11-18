import unicodedata
from datetime import datetime, date, timezone, timedelta
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, desc, func, case, exists
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_user_tenant_access
from app.models.user import User, UserRole
from app.models.lead import Lead
from app.models.analysis import Analise
from app.models.nicho import NichoConfig
from app.models.tenant import Cliente
from app.models.message import Mensagem
from app.models.numero import NumeroBot
from app.schemas.kanban import (
    KanbanBoardOut, KanbanColumnOut, KanbanCardOut,
    AnaliseCardOut, KpiCardOut, MoveCardRequest, AnaliseFullOut,
    MensagemOut, ConversaPreviewOut, ConversasListOut,
    LeadDetalheOut, AnaliseResumoOut, AnaliseLeadExtraOut,
)
from app.schemas.lead import LeadOut

router = APIRouter(prefix="/kanban", tags=["kanban"])


def _norm_direcao(value: str | None) -> str | None:
    """Normaliza direções para 'entrada' | 'saida' (aceita in/out legacy)."""
    if not value:
        return value
    v = value.lower().strip()
    if v in ("in", "entrada"):
        return "entrada"
    if v in ("out", "saida"):
        return "saida"
    return value


def _build_kpi_objects(analise: Analise | None):
    """Consolida KPI a partir de analise.kpi_dados e campos derivados (agnóstico de nicho)."""
    if not analise:
        return None, None
    dados_unificado = analise.kpi_dados or {}
    kpi_payload = {
        "urgencia": analise.kpi_urgencia or dados_unificado.get("urgencia"),
        "score_fechamento": analise.kpi_score_fechamento if analise.kpi_score_fechamento is not None else dados_unificado.get("score_fechamento"),
        "proximo_contato": analise.kpi_proximo_contato or dados_unificado.get("proximo_contato"),
        "dados": dados_unificado or None,
    }
    has_value = any(v is not None for k, v in kpi_payload.items() if k != "dados") or bool(dados_unificado)
    kpi_card = KpiCardOut.model_validate(kpi_payload) if has_value else None
    return kpi_card, (dados_unificado or None)

def _slug(text: str) -> str:
    """Normaliza para comparação: minúsculas + remove acentos."""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()


def _build_etapa_norm(etapas: list[str]) -> dict[str, str]:
    """Mapa slug → etapa canônica (case-insensitive + sem acentos)."""
    return {_slug(e): e for e in etapas}


def _get_first_etapa(etapas: list[str]) -> str:
    return etapas[0] if etapas else "Novo"


def normalizar_etapa(etapa: str | None, norm_map: dict[str, str], first_etapa: str) -> str:
    if not etapa:
        return first_etapa
    key = _slug(etapa)
    if key in norm_map:
        return norm_map[key]
    # Fallback: título original (pode criar coluna extra → tratada depois)
    return etapa.strip()


@router.get("/{cliente_id}/board", response_model=KanbanBoardOut)
async def get_board(
    cliente_id: UUID,
    temperatura: Optional[str] = Query(None),
    sentimento: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    periodo: Optional[str] = Query(None, description="7d | 30d | 90d | all (descontinuado quando datas forem usadas)"),
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    telefone_bot: Optional[str] = Query(None, description="Filtra leads atendidos por um número WhatsApp específico"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    # Range padrão: semana corrente (segunda até hoje) para evitar carregar todos os leads
    if data_fim is None:
        data_fim = datetime.now(timezone.utc).date()
    if data_inicio is None:
        weekday = data_fim.weekday()  # Monday=0
        data_inicio = data_fim - timedelta(days=weekday)

    q = (
        select(Lead)
        .where(Lead.cliente_id == cliente_id, Lead.ativo == True)
        .order_by(desc(Lead.created_at))
    )
    if temperatura:
        q = q.where(Lead.temperatura == temperatura)
    if search:
        pattern = search.replace("%", r"\%").replace("_", r"\_")
        q = q.where(Lead.nome.ilike(f"%{pattern}%") | Lead.whatsapp.ilike(f"%{pattern}%"))
    if telefone_bot:
        q = q.where(Lead.telefone_bot == telefone_bot.strip())

    # Filtra sempre por created_at (data de entrada do lead)
    dt_from = datetime.combine(data_inicio, datetime.min.time(), tzinfo=timezone.utc)
    dt_to = datetime.combine(data_fim + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
    q = q.where(Lead.created_at >= dt_from, Lead.created_at < dt_to)

    result = await db.execute(q)
    leads = result.scalars().all()

    # Get cliente nicho
    cliente_result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = cliente_result.scalar_one_or_none()
    nicho = cliente.nicho if cliente else None

    # Load etapas from nicho_config (required)
    etapas_ativas: list[str] = []
    if nicho:
        nicho_cfg_result = await db.execute(
            select(NichoConfig).where(NichoConfig.nicho == nicho, NichoConfig.ativo == True)
        )
        nicho_cfg = nicho_cfg_result.scalar_one_or_none()
        if nicho_cfg and nicho_cfg.etapas_kanban:
            etapas_ativas = nicho_cfg.etapas_kanban

    if not etapas_ativas:
        raise HTTPException(
            status_code=422,
            detail=f"Nicho '{nicho or '(sem nicho)'}' não possui etapas_kanban configuradas. Configure via /api/v1/nichos.",
        )

    norm_map = _build_etapa_norm(etapas_ativas)
    first_etapa = _get_first_etapa(etapas_ativas)

    # Load latest analysis for each lead
    lead_ids = [l.id for l in leads]
    analise_map: dict[UUID, Analise] = {}

    if lead_ids:
        subq = (
            select(Analise.lead_id, func.max(Analise.created_at).label("max_created"))
            .where(Analise.lead_id.in_(lead_ids))
            .group_by(Analise.lead_id)
            .subquery()
        )
        analise_result = await db.execute(
            select(Analise)
            .join(subq, (Analise.lead_id == subq.c.lead_id) & (Analise.created_at == subq.c.max_created))
        )
        for a in analise_result.scalars().all():
            analise_map[a.lead_id] = a

    # Filter by sentimento
    if sentimento:
        leads = [l for l in leads if analise_map.get(l.id) and analise_map[l.id].sentimento == sentimento]

    # Build columns — preserve etapas_ativas order
    etapa_buckets: dict[str, list] = {e: [] for e in etapas_ativas}

    for lead in leads:
        etapa = normalizar_etapa(lead.etapa_funil, norm_map, first_etapa)
        # Leads with etapa outside config go to first configured stage
        if etapa not in etapa_buckets:
            etapa = first_etapa
        a = analise_map.get(lead.id)
        kpi_out, kpi_dados = _build_kpi_objects(a)

        card = KanbanCardOut(
            id=lead.id,
            whatsapp=lead.whatsapp,
            nome=lead.nome,
            temperatura=lead.temperatura,
            score=lead.score,
            etapa_funil=etapa,
            bloqueado=lead.bloqueado,
            foto_url=lead.foto_url,
            created_at=lead.created_at,
            updated_at=lead.updated_at,
            nicho=nicho,
            ultima_analise=AnaliseCardOut.model_validate(a) if a else None,
            kpi=kpi_out,
            kpi_generico=kpi_dados,
        )
        etapa_buckets[etapa].append(card)

    # Columns: only configured etapas, in order
    columns = []
    for etapa in etapas_ativas:
        cards = etapa_buckets.get(etapa, [])
        columns.append(KanbanColumnOut(etapa=etapa, total=len(cards), cards=cards))

    return KanbanBoardOut(columns=columns, total_leads=len(leads))


@router.patch("/{cliente_id}/move", response_model=LeadOut)
async def move_card(
    cliente_id: UUID,
    body: MoveCardRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_superadmin:
        ut = await get_user_tenant_access(str(cliente_id), current_user, db)
        if not ut:
            raise HTTPException(status_code=403, detail="Sem acesso ao tenant")
        if ut.role == UserRole.viewer:
            raise HTTPException(status_code=403, detail="Viewers não podem mover cards")

    result = await db.execute(
        select(Lead).where(Lead.id == body.lead_id, Lead.cliente_id == cliente_id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")

    # Load nicho etapas for normalization
    cliente_result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = cliente_result.scalar_one_or_none()
    etapas: list[str] = []
    if cliente and cliente.nicho:
        nicho_cfg_result = await db.execute(
            select(NichoConfig).where(NichoConfig.nicho == cliente.nicho, NichoConfig.ativo == True)
        )
        nicho_cfg = nicho_cfg_result.scalar_one_or_none()
        if nicho_cfg and nicho_cfg.etapas_kanban:
            etapas = nicho_cfg.etapas_kanban

    if not etapas:
        raise HTTPException(
            status_code=422,
            detail=f"Nicho '{cliente.nicho if cliente else ''}' não possui etapas_kanban configuradas.",
        )

    norm_map = _build_etapa_norm(etapas)
    first_etapa = _get_first_etapa(etapas)

    # Validate nova_etapa is one of the configured stages
    nova_normalizada = normalizar_etapa(body.nova_etapa, norm_map, first_etapa)
    if nova_normalizada not in etapas:
        raise HTTPException(
            status_code=400,
            detail=f"Etapa '{body.nova_etapa}' não é uma etapa válida. Etapas disponíveis: {etapas}",
        )

    lead.etapa_funil = nova_normalizada
    if body.nova_temperatura:
        lead.temperatura = body.nova_temperatura
    lead.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(lead)
    return lead


@router.patch("/{cliente_id}/leads/{lead_id}/inativar", response_model=LeadOut)
async def inativar_lead(
    cliente_id: UUID,
    lead_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Inativa um lead (soft-delete via Lead.ativo = False).

    Efeitos:
    - Sai do Kanban, Conversas e Dashboards (todos filtram por Lead.ativo == True)
    - Mensagens e análises permanecem no banco (reversível)
    - Viewers não podem inativar
    """
    if not current_user.is_superadmin:
        ut = await get_user_tenant_access(str(cliente_id), current_user, db)
        if not ut:
            raise HTTPException(status_code=403, detail="Sem acesso ao tenant")
        if ut.role == UserRole.viewer:
            raise HTTPException(status_code=403, detail="Viewers não podem inativar leads")

    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.cliente_id == cliente_id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")

    if not lead.ativo:
        # Idempotente — já está inativo
        return lead

    lead.ativo = False
    lead.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(lead)
    return lead


@router.get("/{cliente_id}/leads/{lead_id}/analyses", response_model=List[AnaliseFullOut])
async def get_lead_analyses(
    cliente_id: UUID,
    lead_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    result = await db.execute(
        select(Analise)
        .where(Analise.lead_id == lead_id, Analise.cliente_id == cliente_id)
        .order_by(desc(Analise.created_at))
    )
    analises = result.scalars().all()

    out = []
    for a in analises:
        detalhe_dict = a.detalhe_json or None

        lead_extra_dict = a.extra_json or None

        kpi_out, kpi_dados = _build_kpi_objects(a)

        out.append(AnaliseFullOut(
            id=a.id,
            lead_id=a.lead_id,
            data_ref=str(a.data_ref) if a.data_ref else None,
            versao=a.versao,
            resumo_curto=a.resumo_curto,
            sentimento=a.sentimento,
            score_interesse=a.score_interesse,
            intencao=a.intencao,
            proximo_passo=a.proximo_passo,
            modelo_ia=a.modelo_ia,
            tokens_consumidos=a.tokens_consumidos,
            total_msgs=a.total_msgs,
            created_at=a.created_at,
            detalhe=detalhe_dict,
            kpi=kpi_out,
            lead_extra=lead_extra_dict,
        ))
    return out


@router.get("/{cliente_id}/leads/{lead_id}", response_model=LeadDetalheOut)
async def get_lead_detalhe(
    cliente_id: UUID,
    lead_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    # 1. Tenant access verified by get_user_tenant_access dependency above

    # 2. Query Lead
    lead_result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.cliente_id == cliente_id, Lead.ativo == True)
    )
    lead = lead_result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")

    # 3. Query latest Analise for this lead
    analise_result = await db.execute(
        select(Analise)
        .where(Analise.lead_id == lead_id, Analise.cliente_id == cliente_id)
        .order_by(desc(Analise.data_ref), desc(Analise.versao))
        .limit(1)
    )
    analise = analise_result.scalar_one_or_none()

    # 4. Build and return LeadDetalheOut
    return LeadDetalheOut(
        id=lead.id,
        cliente_id=lead.cliente_id,
        whatsapp=lead.whatsapp,
        nome=lead.nome,
        telefone_bot=lead.telefone_bot,
        origem=lead.origem,
        etapa_funil=lead.etapa_funil,
        temperatura=lead.temperatura,
        score=float(lead.score) if lead.score is not None else None,
        extras=lead.extras,
        bloqueado=lead.bloqueado,
        ativo=lead.ativo,
        cidade_lead=lead.cidade_lead,
        estado_lead=lead.estado_lead,
        perfil_lead=lead.perfil_lead,
        lead_recorrente=lead.lead_recorrente,
        followup_em=lead.followup_em,
        primeiraresposta_em=lead.primeiraresposta_em,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
        analise=AnaliseResumoOut(
            id=analise.id,
            data_ref=analise.data_ref,
            sentimento=analise.sentimento,
            score_interesse=float(analise.score_interesse) if analise.score_interesse is not None else None,
            intencao=analise.intencao,
            proximo_passo=analise.proximo_passo,
            resumo_curto=analise.resumo_curto,
            total_msgs=analise.total_msgs,
        ) if analise else None,
        analise_extra=AnaliseLeadExtraOut.model_validate(analise.extra_json) if analise and analise.extra_json else None,
    )


@router.get("/{cliente_id}/conversations", response_model=ConversasListOut)
async def get_conversations(
    cliente_id: UUID,
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    temperatura: Optional[str] = Query(None),
    etapa_funil: Optional[str] = Query(None),
    sentimento: Optional[str] = Query(None),
    telefone_bot: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Busca global por nome ou WhatsApp do lead"),
    offset: int = Query(0, ge=0, description="Paginação: a partir de qual posição retornar"),
    limit: int = Query(100, ge=1, le=200, description="Quantos contatos retornar (default 100, max 200)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Lista paginada de conversas do tenant.

    Retorna envelope `{items, total, has_more, next_offset}`. Filtros são
    acumulativos — busca + temperatura + etapa + sentimento aplicam JUNTOS.
    Ordenação: mensagem mais recente primeiro.
    """
    # Quando ambos os params de data forem omitidos, não aplica filtro de período —
    # retorna todas as conversas do cliente. Caso contrário, usa o intervalo
    # informado (se só um lado vier, o outro assume "aberto").
    apply_date_filter = data_inicio is not None or data_fim is not None

    dt_from: Optional[datetime] = None
    dt_to: Optional[datetime] = None
    if apply_date_filter:
        if data_inicio is not None:
            dt_from = datetime.combine(data_inicio, datetime.min.time(), tzinfo=timezone.utc)
        if data_fim is not None:
            dt_to = datetime.combine(data_fim + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)

    # Rank messages per lead by enviada_em DESC — rn=1 is the latest, avoids
    # timestamp-collision duplicates that occur with max()+join strategy
    msg_conditions = [Mensagem.cliente_id == cliente_id]
    if dt_from is not None:
        msg_conditions.append(Mensagem.enviada_em >= dt_from)
    if dt_to is not None:
        msg_conditions.append(Mensagem.enviada_em < dt_to)

    msg_ranked = (
        select(
            Mensagem.lead_id.label("lead_id"),
            Mensagem.conteudo.label("conteudo"),
            Mensagem.tipo.label("tipo"),
            Mensagem.direcao.label("direcao"),
            Mensagem.enviada_em.label("enviada_em"),
            func.row_number().over(
                partition_by=Mensagem.lead_id,
                order_by=desc(Mensagem.enviada_em),
            ).label("rn"),
        )
        .where(*msg_conditions)
        .subquery()
    )

    # Subquery: retorna o lead ativo mais recente para cada conversa. A identidade
    # atual é número conectado + WhatsApp; ``numero_bot_id = NULL`` continua sendo
    # um grupo próprio para preservar conversas legadas durante a transição.
    latest_per_conversation = (
        select(Lead.id)
        .where(Lead.cliente_id == cliente_id, Lead.ativo == True)
        .distinct(Lead.numero_bot_id, Lead.whatsapp)
        .order_by(Lead.numero_bot_id, Lead.whatsapp, desc(Lead.updated_at))
        .subquery()
    )

    # Base query: leads com mensagens no período (ou todos se sem filtro de data),
    # excluindo leads cujo whatsapp pertence a um bot ativo.
    lead_conditions = [
        Lead.cliente_id == cliente_id,
        Lead.ativo == True,
        msg_ranked.c.rn == 1,
        Lead.id.in_(select(latest_per_conversation.c.id)),
        ~exists(
            select(NumeroBot.id).where(
                NumeroBot.cliente_id == cliente_id,
                NumeroBot.numero == Lead.whatsapp,
                NumeroBot.ativo == True,
            )
        ),
    ]

    # Filtros em colunas do Lead (acumulativos)
    if temperatura:
        lead_conditions.append(func.lower(Lead.temperatura) == temperatura.strip().lower())
    if etapa_funil:
        # Comparação case/acento-insensitiva (igual ao kanban)
        lead_conditions.append(func.lower(Lead.etapa_funil) == etapa_funil.strip().lower())
    if telefone_bot:
        lead_conditions.append(Lead.telefone_bot == telefone_bot.strip())

    # Busca global: ILIKE em nome OU whatsapp. Escapamos % e _ pra evitar
    # injeção de wildcards do usuário.
    if search and search.strip():
        pattern = search.strip().replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")
        lead_conditions.append(
            Lead.nome.ilike(f"%{pattern}%", escape="\\") | Lead.whatsapp.ilike(f"%{pattern}%", escape="\\")
        )

    # Monta a query base — com ou sem JOIN em sentimento
    if sentimento:
        latest_analise = (
            select(
                Analise.lead_id.label("lead_id"),
                Analise.sentimento.label("sentimento"),
                func.row_number().over(
                    partition_by=Analise.lead_id,
                    order_by=desc(Analise.created_at),
                ).label("rn"),
            )
            .where(Analise.cliente_id == cliente_id)
            .subquery()
        )
        sentimento_lower = sentimento.strip().lower()
        base_select = (
            select(
                Lead,
                msg_ranked.c.conteudo,
                msg_ranked.c.tipo,
                msg_ranked.c.direcao,
                msg_ranked.c.enviada_em,
            )
            .join(msg_ranked, Lead.id == msg_ranked.c.lead_id)
            .join(latest_analise, (Lead.id == latest_analise.c.lead_id) & (latest_analise.c.rn == 1))
            .where(
                *lead_conditions,
                func.lower(latest_analise.c.sentimento) == sentimento_lower,
            )
        )
        # Pra contar total, usa o mesmo where mas só COUNT(*)
        count_select = (
            select(func.count(Lead.id))
            .select_from(Lead)
            .join(msg_ranked, Lead.id == msg_ranked.c.lead_id)
            .join(latest_analise, (Lead.id == latest_analise.c.lead_id) & (latest_analise.c.rn == 1))
            .where(
                *lead_conditions,
                func.lower(latest_analise.c.sentimento) == sentimento_lower,
            )
        )
    else:
        base_select = (
            select(
                Lead,
                msg_ranked.c.conteudo,
                msg_ranked.c.tipo,
                msg_ranked.c.direcao,
                msg_ranked.c.enviada_em,
            )
            .join(msg_ranked, Lead.id == msg_ranked.c.lead_id)
            .where(*lead_conditions)
        )
        count_select = (
            select(func.count(Lead.id))
            .select_from(Lead)
            .join(msg_ranked, Lead.id == msg_ranked.c.lead_id)
            .where(*lead_conditions)
        )

    # Total — para mostrar "X contatos" + saber has_more
    total_res = await db.execute(count_select)
    total = int(total_res.scalar() or 0)

    if total == 0:
        return ConversasListOut(items=[], total=0, has_more=False, next_offset=None)

    # Página principal
    paged = base_select.order_by(desc(msg_ranked.c.enviada_em)).offset(offset).limit(limit)
    result = await db.execute(paged)
    rows = result.all()

    items = [
        ConversaPreviewOut(
            lead_id=lead.id,
            whatsapp=lead.whatsapp,
            nome=lead.nome,
            ultima_mensagem=conteudo,
            tipo_ultima=tipo,
            direcao_ultima=_norm_direcao(direcao),
            enviada_em=enviada_em,
            # Campos novos — front usa pra colorir avatar (anel) + badge de score
            temperatura=lead.temperatura,
            score=lead.score,
            foto_url=lead.foto_url,
        )
        for lead, conteudo, tipo, direcao, enviada_em in rows
    ]

    has_more = (offset + len(items)) < total
    next_offset = offset + len(items) if has_more else None

    return ConversasListOut(
        items=items,
        total=total,
        has_more=has_more,
        next_offset=next_offset,
    )


@router.get("/{cliente_id}/conversations/etapas", response_model=List[str])
async def get_conversations_etapas(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Retorna a lista de etapas_kanban configuradas no nicho do cliente.
    Fallback: se o nicho não tiver etapas configuradas, retorna etapas
    distintas encontradas nos leads ativos deste cliente."""
    cliente_result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = cliente_result.scalar_one_or_none()

    etapas: list[str] = []
    if cliente and cliente.nicho:
        nicho_result = await db.execute(
            select(NichoConfig).where(NichoConfig.nicho == cliente.nicho)
        )
        nicho_cfg = nicho_result.scalar_one_or_none()
        if nicho_cfg and nicho_cfg.etapas_kanban:
            etapas = list(nicho_cfg.etapas_kanban)

    if not etapas:
        # Fallback: derivar do próprio Lead.etapa_funil
        distinct_result = await db.execute(
            select(Lead.etapa_funil)
            .where(
                Lead.cliente_id == cliente_id,
                Lead.ativo == True,
                Lead.etapa_funil.is_not(None),
            )
            .distinct()
        )
        etapas = sorted({e for (e,) in distinct_result.all() if e})

    return etapas


@router.get("/{cliente_id}/leads/{lead_id}/messages", response_model=List[MensagemOut])
async def get_lead_messages(
    cliente_id: UUID,
    lead_id: UUID,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    order: str = Query("asc", pattern="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """
    Lista mensagens do lead.

    - `order=asc` (default): comportamento legado — mais antigas primeiro.
    - `order=desc`: mais recentes primeiro. Útil pra paginação tipo WhatsApp:
       `offset=0, limit=50` traz as 50 últimas; `offset=50` traz as 50 anteriores;
       e por aí vai. Frontend reverte pra renderizar em ordem cronológica.
    """
    ordering = Mensagem.enviada_em.desc() if order == "desc" else Mensagem.enviada_em.asc()
    result = await db.execute(
        select(Mensagem)
        .where(Mensagem.lead_id == lead_id, Mensagem.cliente_id == cliente_id)
        .order_by(ordering)
        .limit(limit)
        .offset(offset)
    )
    msgs = result.scalars().all()
    for m in msgs:
        m.direcao = _norm_direcao(m.direcao)
    return msgs


@router.get("/{cliente_id}/stats")
async def get_stats(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    etapa_lower = func.lower(func.replace(Lead.etapa_funil, 'ã', 'a'))
    result = await db.execute(
        select(
            func.count(Lead.id).label("total"),
            func.sum(case((Lead.temperatura == "quente", 1), else_=0)).label("quentes"),
            func.sum(case((Lead.temperatura == "morno", 1), else_=0)).label("mornos"),
            func.sum(case((Lead.temperatura == "frio", 1), else_=0)).label("frios"),
            func.sum(case((etapa_lower == "fechado", 1), else_=0)).label("fechados"),
            func.sum(case((etapa_lower == "perdido", 1), else_=0)).label("perdidos"),
        )
        .select_from(Lead)
        .where(Lead.cliente_id == cliente_id, Lead.ativo == True)
    )
    row = result.one()
    return {
        "total_leads": row.total or 0,
        "quentes": row.quentes or 0,
        "mornos": row.mornos or 0,
        "frios": row.frios or 0,
        "fechados": row.fechados or 0,
        "perdidos": row.perdidos or 0,
    }
