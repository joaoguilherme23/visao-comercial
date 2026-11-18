import math
from collections import Counter
from datetime import date, timedelta, datetime, time as dtime, timezone as _tz
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, extract, case, and_, desc, or_, literal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_user_tenant_access
from app.models.user import User, UserRole
from app.models.dashboard import KpiCatalogo, DashboardConfig, AnaliseWidget
from app.models.lead import Lead
from app.models.analysis import Analise
from app.models.message import Mensagem
from app.models.tenant import Cliente
from app.models.numero import NumeroBot
from app.models.nicho import NichoConfig
from app.services.tenant_nicho_config import get_effective_nicho_fields, save_tenant_nicho_fields
from app.schemas.dashboard import (
    KpiCatalogoOut, KpiCatalogoCreate,
    DashboardConfigOut, DashboardConfigUpdate,
    KpiResultOut, LeadDrilldownOut,
    NichoCamposOut, NichoCamposUpdate,
    AnaliseWidgetCreate, AnaliseWidgetUpdate, AnaliseWidgetOut,
    AnaliseWidgetDataOut, WidgetDataItem, WIDGET_COMPAT,
)
from app.services.kpi_engine import calcular_kpi, calcular_kpi_com_comparacao, DDD_REGIAO, DIAS_SEMANA

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# ── Catalogo de KPIs ─────────────────────────────────────────────────────────

@router.get("/catalogo", response_model=List[KpiCatalogoOut])
async def list_catalogo(
    nicho: str = None,
    cliente_id: UUID = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validar acesso ao tenant se cliente_id foi informado
    if cliente_id and not current_user.is_superadmin:
        await get_user_tenant_access(str(cliente_id), current_user, db)

    q = select(KpiCatalogo).where(KpiCatalogo.ativo == True).order_by(KpiCatalogo.ordem_padrao)
    result = await db.execute(q)
    kpis = result.scalars().all()

    if cliente_id:
        kpis = [
            k for k in kpis
            if k.is_builtin or k.cliente_id is None or str(k.cliente_id) == str(cliente_id)
        ]
    else:
        if not current_user.is_superadmin:
            kpis = [k for k in kpis if k.is_builtin]

    if nicho:
        kpis = [
            k for k in kpis
            if k.nichos_compativeis is None or nicho in k.nichos_compativeis
        ]

    return kpis


@router.post("/catalogo", response_model=KpiCatalogoOut, status_code=201)
async def create_custom_kpi(
    body: KpiCatalogoCreate,
    cliente_id: UUID = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not cliente_id:
        raise HTTPException(status_code=400, detail="cliente_id obrigatorio para KPI custom")
    valid_ops = {"count", "sum", "avg", "percent", "mode"}
    if body.tipo_calculo not in valid_ops:
        raise HTTPException(status_code=400, detail=f"tipo_calculo invalido. Permitidos: {valid_ops}")
    if not current_user.is_superadmin:
        ut = await get_user_tenant_access(str(cliente_id), current_user, db)
        if not ut or ut.role not in [UserRole.admin]:
            raise HTTPException(status_code=403, detail="Apenas admins do tenant podem criar KPIs customizados")

    existing = await db.execute(select(KpiCatalogo).where(KpiCatalogo.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Slug '{body.slug}' ja existe")

    kpi = KpiCatalogo(**body.model_dump(), is_builtin=False, cliente_id=cliente_id)
    db.add(kpi)
    await db.flush()
    await db.refresh(kpi)
    return kpi


@router.get("/{cliente_id}/catalogo", response_model=List[KpiCatalogoOut])
async def list_catalogo_do_tenant(
    cliente_id: UUID, nicho: str = None, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rota canônica BFF: tenant sempre vem do path, nunca da query."""
    await get_user_tenant_access(str(cliente_id), current_user, db)
    return await list_catalogo(nicho=nicho, cliente_id=cliente_id, db=db, current_user=current_user)


@router.post("/{cliente_id}/catalogo", response_model=KpiCatalogoOut, status_code=201)
async def create_custom_kpi_do_tenant(
    cliente_id: UUID, body: KpiCatalogoCreate, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await get_user_tenant_access(str(cliente_id), current_user, db)
    return await create_custom_kpi(body=body, cliente_id=cliente_id, db=db, current_user=current_user)


# ── Dashboard Config ─────────────────────────────────────────────────────────

@router.get("/{cliente_id}/config", response_model=DashboardConfigOut)
async def get_dashboard_config(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    result = await db.execute(
        select(DashboardConfig).where(DashboardConfig.cliente_id == cliente_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        # Retorna config vazia — frontend interpreta kpis=[] como "usar KPIs padrão"
        from uuid import UUID as _UUID
        return DashboardConfigOut(
            id=_UUID(int=0),
            cliente_id=cliente_id,
            updated_by=current_user.id,
            kpis=[],
            layout="grid",
            created_at=None,
            updated_at=None,
        )
    return config


@router.put("/{cliente_id}/config", response_model=DashboardConfigOut)
async def update_dashboard_config(
    cliente_id: UUID,
    body: DashboardConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_superadmin:
        ut = await get_user_tenant_access(str(cliente_id), current_user, db)
        if not ut or ut.role == UserRole.viewer:
            raise HTTPException(403, "Apenas admins e managers podem configurar o dashboard")

    slugs = [k.slug for k in body.kpis]
    if slugs:
        existing = await db.execute(
            select(KpiCatalogo.slug).where(KpiCatalogo.slug.in_(slugs))
        )
        existing_slugs = {row[0] for row in existing.all()}
        invalid = set(slugs) - existing_slugs
        if invalid:
            raise HTTPException(400, f"KPIs invalidos: {invalid}")

    result = await db.execute(
        select(DashboardConfig).where(DashboardConfig.cliente_id == cliente_id)
    )
    config = result.scalar_one_or_none()
    kpis_data = [k.model_dump() for k in body.kpis]

    if config:
        config.kpis = kpis_data
        flag_modified(config, "kpis")
        config.layout = body.layout
        config.secoes_visiveis = body.secoes_visiveis
        config.updated_by = current_user.id
    else:
        config = DashboardConfig(
            cliente_id=cliente_id,
            updated_by=current_user.id,
            kpis=kpis_data,
            layout=body.layout,
            secoes_visiveis=body.secoes_visiveis,
        )
        db.add(config)

    await db.flush()
    await db.refresh(config)
    return config


# ── Nicho Campos (IA Extraction Fields) ──────────────────────────────────────

@router.get("/{cliente_id}/nicho-campos", response_model=NichoCamposOut)
async def get_nicho_campos(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna os campos de extração por IA do nicho do tenant. Acesso: manager, admin ou superadmin."""
    if not current_user.is_superadmin:
        ut = await get_user_tenant_access(str(cliente_id), current_user, db)
        if not ut or ut.role not in (UserRole.admin, UserRole.manager):
            raise HTTPException(403, "Apenas gestores e admins podem visualizar campos de extração")

    cliente_result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = cliente_result.scalar_one_or_none()
    if not cliente or not cliente.nicho:
        raise HTTPException(404, "Tenant não possui nicho configurado")

    config = await get_effective_nicho_fields(db, cliente_id, cliente.nicho)
    if config is None:
        raise HTTPException(404, f"Nicho '{cliente.nicho}' não encontrado em nicho_config")

    return NichoCamposOut(
        nicho=config["nicho"],
        campos_kpi=config["campos_kpi"] or [],
        campos_analise=config["campos_analise"] or [],
    )


@router.put("/{cliente_id}/nicho-campos", response_model=NichoCamposOut)
async def update_nicho_campos(
    cliente_id: UUID,
    body: NichoCamposUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza os campos de extração por IA do nicho do tenant. Acesso: manager, admin ou superadmin."""
    if not current_user.is_superadmin:
        ut = await get_user_tenant_access(str(cliente_id), current_user, db)
        if not ut or ut.role not in (UserRole.admin, UserRole.manager):
            raise HTTPException(403, "Apenas gestores e admins podem configurar campos de extração")

    cliente_result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = cliente_result.scalar_one_or_none()
    if not cliente or not cliente.nicho:
        raise HTTPException(404, "Tenant não possui nicho configurado")

    nicho = cliente.nicho
    template_exists = await db.execute(
        select(NichoConfig.id).where(NichoConfig.nicho == nicho, NichoConfig.ativo.is_(True))
    )
    if template_exists.scalar_one_or_none() is None:
        raise HTTPException(404, f"Nicho '{nicho}' não encontrado em nicho_config")

    await save_tenant_nicho_fields(
        db=db,
        cliente_id=cliente_id,
        nicho=nicho,
        campos_kpi=[campo.model_dump() for campo in body.campos_kpi],
        campos_analise=[campo.model_dump() for campo in body.campos_analise],
        updated_by=current_user.id,
    )
    config = await get_effective_nicho_fields(db, cliente_id, nicho)
    return NichoCamposOut(
        nicho=config["nicho"],
        campos_kpi=config["campos_kpi"] or [],
        campos_analise=config["campos_analise"] or [],
    )


@router.get("/{cliente_id}/campos-widget", response_model=NichoCamposOut)
async def get_campos_widget(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """
    Retorna a lista (read-only) dos campos de extração disponíveis para o nicho do tenant.

    Usado pelo WidgetBuilder para popular o select de "Campo" quando o usuário está
    criando/editando um widget de análise. Disponível para qualquer membro com acesso
    ao tenant (gestor/admin) — edição dos campos continua restrita a admins em
    `/nicho-campos`.
    """
    cliente_result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = cliente_result.scalar_one_or_none()
    if not cliente or not cliente.nicho:
        # Retorna vazio em vez de 404 para não quebrar a UI do WidgetBuilder
        return NichoCamposOut(nicho="", campos_kpi=[], campos_analise=[])

    config = await get_effective_nicho_fields(db, cliente_id, cliente.nicho)
    if config is None:
        return NichoCamposOut(nicho=cliente.nicho, campos_kpi=[], campos_analise=[])

    return NichoCamposOut(
        nicho=config["nicho"],
        campos_kpi=config["campos_kpi"] or [],
        campos_analise=config["campos_analise"] or [],
    )


# ── KPI Calculation ──────────────────────────────────────────────────────────

def _analise_join(q, *conditions):
    """Join com Analise + distinct para evitar duplicatas de leads com múltiplas análises."""
    return q.join(Analise, Analise.lead_id == Lead.id).where(*conditions).distinct()

_SLUG_FILTERS = {
    # ── Lead direto (sem join) ──────────────────────────────────────────────
    "total_leads":              lambda q: q,
    "leads_ativos":             lambda q: q.where(Lead.ativo == True),
    "leads_identificados":      lambda q: q.where(Lead.nome.isnot(None), Lead.nome != ""),
    "leads_sem_etapa":          lambda q: q.where(Lead.etapa_funil.is_(None)),
    "leads_bloqueados":         lambda q: q.where(Lead.bloqueado == True),
    "score_medio":              lambda q: q.where(Lead.score.isnot(None)),
    "pct_leads_identificados":  lambda q: q.where(Lead.nome.isnot(None), Lead.nome != ""),
    "pct_leads_fechados":       lambda q: q.where(func.lower(func.coalesce(Lead.etapa_funil, "")) == "fechado"),
    "pct_leads_perdidos":       lambda q: q.where(func.lower(func.coalesce(Lead.etapa_funil, "")) == "perdido"),
    "leads_com_cidade":         lambda q: q.where(Lead.cidade_lead.isnot(None), Lead.cidade_lead != ""),

    # ── Urgência (join Analise) ─────────────────────────────────────────────
    "leads_urgencia_alta":      lambda q: _analise_join(q, func.lower(Analise.kpi_urgencia) == "alta"),
    "leads_urgencia_media":     lambda q: _analise_join(q, func.lower(Analise.kpi_urgencia) == "media"),
    "leads_urgencia_baixa":     lambda q: _analise_join(q, func.lower(Analise.kpi_urgencia) == "baixa"),
    "pct_alta_urgencia":        lambda q: _analise_join(q, func.lower(Analise.kpi_urgencia) == "alta"),
    "pct_media_urgencia":       lambda q: _analise_join(q, func.lower(Analise.kpi_urgencia) == "media"),
    "pct_baixa_urgencia":       lambda q: _analise_join(q, func.lower(Analise.kpi_urgencia) == "baixa"),

    # ── Sentimento (join Analise) ───────────────────────────────────────────
    "analises_positivas":       lambda q: _analise_join(q, Analise.sentimento == "positivo"),
    "analises_negativas":       lambda q: _analise_join(q, Analise.sentimento == "negativo"),
    "analises_neutras":         lambda q: _analise_join(q, Analise.sentimento == "neutro"),
    "pct_sentimento_positivo":  lambda q: _analise_join(q, Analise.sentimento == "positivo"),

    # ── Score / fechamento (join Analise) ───────────────────────────────────
    "score_interesse_medio":    lambda q: _analise_join(q, Analise.score_interesse.isnot(None)),
    "score_fechamento_medio":   lambda q: _analise_join(q, Analise.kpi_score_fechamento.isnot(None)),
    "score_fechamento_alto":    lambda q: _analise_join(q, Analise.kpi_score_fechamento >= 0.7),
    "pct_fechamento_alto":      lambda q: _analise_join(q, Analise.kpi_score_fechamento >= 0.7),
    "pct_interesse_alto":       lambda q: _analise_join(q, Analise.score_interesse >= 7.0),

    # ── Outros com análise ──────────────────────────────────────────────────
    "leads_oportunidade_aberta": lambda q: _analise_join(q, Analise.extra_json["oportunidade_aberta"].astext == "true"),
}

@router.get("/{cliente_id}/kpis", response_model=List[KpiResultOut])
async def get_dashboard_kpis(
    cliente_id: UUID,
    data_inicio: date = None,
    data_fim: date = None,
    telefone_bot: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Calcula e retorna os KPIs configurados para o tenant.
    Aceita data_inicio e data_fim para filtro de período e comparação automática.
    Aceita telefone_bot para filtrar apenas leads atendidos por um número específico.
    """
    cfg_result = await db.execute(
        select(DashboardConfig).where(DashboardConfig.cliente_id == cliente_id)
    )
    config = cfg_result.scalar_one_or_none()

    if not config or not config.kpis:
        kpi_result = await db.execute(
            select(KpiCatalogo)
            .where(KpiCatalogo.ativo == True, KpiCatalogo.is_builtin == True)
            .where(KpiCatalogo.categoria_kpi.in_(["leads", "conversao"]))
            .order_by(KpiCatalogo.ordem_padrao)
            .limit(6)
        )
        kpis = kpi_result.scalars().all()
        results = []
        for kpi in kpis:
            valor, variacao_pct, valor_anterior = await calcular_kpi_com_comparacao(
                db, cliente_id, kpi, data_inicio, data_fim, telefone_bot
            )
            results.append(KpiResultOut(
                slug=kpi.slug, nome=kpi.nome, valor=valor,
                formato=kpi.formato, icone=kpi.icone, cor=kpi.cor,
                categoria_kpi=kpi.categoria_kpi, ordem=kpi.ordem_padrao or 0,
                variacao_pct=variacao_pct, valor_anterior=valor_anterior,
            ))
        return results

    slug_map = {k["slug"]: k for k in config.kpis}
    selected_slugs = list(slug_map.keys())

    kpi_result = await db.execute(
        select(KpiCatalogo).where(KpiCatalogo.slug.in_(selected_slugs), KpiCatalogo.ativo == True)
    )
    kpi_objs = {k.slug: k for k in kpi_result.scalars().all()}

    results = []
    for slug in selected_slugs:
        kpi = kpi_objs.get(slug)
        if not kpi:
            continue
        sel = slug_map[slug]
        if not sel.get("visivel", True):
            continue

        valor, variacao_pct, valor_anterior = await calcular_kpi_com_comparacao(
            db, cliente_id, kpi, data_inicio, data_fim, telefone_bot
        )
        results.append(KpiResultOut(
            slug=kpi.slug, nome=kpi.nome, valor=valor,
            formato=kpi.formato, icone=kpi.icone, cor=kpi.cor,
            categoria_kpi=kpi.categoria_kpi,
            ordem=sel.get("ordem", kpi.ordem_padrao or 0),
            variacao_pct=variacao_pct, valor_anterior=valor_anterior,
        ))

    results.sort(key=lambda r: r.ordem)
    return results


# ── Temperatura breakdown ─────────────────────────────────────────────────────

@router.get("/{cliente_id}/temperatura")
async def get_temperatura_breakdown(
    cliente_id: UUID,
    data_inicio: date = None,
    data_fim: date = None,
    telefone_bot: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    q = (
        select(
            func.count().filter(Lead.temperatura == "quente").label("quente"),
            func.count().filter(Lead.temperatura == "morno").label("morno"),
            func.count().filter(Lead.temperatura == "frio").label("frio"),
            func.count().filter(Lead.temperatura.is_(None)).label("sem_temperatura"),
            func.count().label("total"),
        )
        .select_from(Lead)
        .where(Lead.cliente_id == cliente_id, Lead.ativo == True)
    )
    if data_inicio:
        q = q.where(Lead.created_at >= datetime.combine(data_inicio, dtime.min, _tz.utc))
    if data_fim:
        q = q.where(Lead.created_at < datetime.combine(data_fim + timedelta(days=1), dtime.min, _tz.utc))
    if telefone_bot:
        q = q.where(Lead.telefone_bot == telefone_bot.strip())

    row = (await db.execute(q)).first()
    return {
        "quente": row.quente or 0,
        "morno": row.morno or 0,
        "frio": row.frio or 0,
        "sem_temperatura": row.sem_temperatura or 0,
        "total": row.total or 0,
    }


# ── Histórico (série temporal para sparklines) ────────────────────────────────

@router.get("/{cliente_id}/historico")
async def get_historico(
    cliente_id: UUID,
    data_inicio: date = None,
    data_fim: date = None,
    telefone_bot: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Retorna leads por dia no período. Usado para sparklines e área charts."""
    if not data_fim:
        data_fim = date.today()
    if not data_inicio:
        data_inicio = data_fim - timedelta(days=29)

    dt_from = datetime.combine(data_inicio, dtime.min, _tz.utc)
    dt_to = datetime.combine(data_fim + timedelta(days=1), dtime.min, _tz.utc)

    dia_col = func.date_trunc("day", Lead.created_at).label("dia")
    q = (
        select(dia_col, func.count().label("novos_leads"))
        .where(
            Lead.cliente_id == cliente_id,
            Lead.ativo == True,
            Lead.created_at >= dt_from,
            Lead.created_at < dt_to,
        )
        .group_by(dia_col)
        .order_by(dia_col)
    )
    if telefone_bot:
        q = q.where(Lead.telefone_bot == telefone_bot.strip())
    rows = (await db.execute(q)).all()
    return [
        {"data": row.dia.date().isoformat(), "novos_leads": row.novos_leads}
        for row in rows
    ]


# ── Preview ───────────────────────────────────────────────────────────────────

@router.post("/{cliente_id}/preview")
async def preview_kpi(
    cliente_id: UUID,
    body: KpiCatalogoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    temp_kpi = KpiCatalogo(**body.model_dump(), is_builtin=False)
    valor = await calcular_kpi(db, cliente_id, temp_kpi)
    return {"valor": valor, "formato": body.formato}


# ── Funil ─────────────────────────────────────────────────────────────────────

@router.get("/{cliente_id}/funil")
async def get_funil(
    cliente_id: UUID,
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    telefone_bot: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Retorna contagem de leads por etapa_funil no período."""
    etapa_col = func.coalesce(Lead.etapa_funil, "Sem Etapa").label("etapa")
    q = (
        select(etapa_col, func.count().label("total"))
        .where(and_(Lead.cliente_id == cliente_id, Lead.ativo == True))
        .group_by(etapa_col)
        .order_by(func.count().desc())
    )
    if data_inicio:
        q = q.where(Lead.created_at >= datetime.combine(data_inicio, dtime.min, _tz.utc))
    if data_fim:
        q = q.where(Lead.created_at < datetime.combine(data_fim + timedelta(days=1), dtime.min, _tz.utc))
    if telefone_bot:
        q = q.where(Lead.telefone_bot == telefone_bot.strip())

    rows = (await db.execute(q)).all()
    sum_total = sum(r.total for r in rows) or 1
    return [
        {
            "etapa": r.etapa,
            "total": r.total,
            "pct": round(r.total / sum_total * 100, 2),
        }
        for r in rows
    ]


# ── Objeções ──────────────────────────────────────────────────────────────────

@router.get("/{cliente_id}/objecoes")
async def get_objecoes(
    cliente_id: UUID,
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    somente_sem_conversao: bool = Query(False),
    telefone_bot: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Ranking de objeções lido de extra_json.motivo_nao_fechamento e
    extra_json.motivo_desistencia — campos fixos cross-nicho, sempre presentes.
    """
    _INVALIDOS = {
        "null", "none", "n/a", "na", "não informado", "nao informado",
        "nenhuma", "nenhum", "não se aplica", "nao se aplica",
        "indefinido", "desconhecido", "sem informação", "sem informacao",
        "não disponível", "nao disponivel", "-", "--", ".", "",
    }

    def _col(campo: str):
        return func.lower(func.trim(Analise.extra_json[campo].astext))

    def _subq(campo: str):
        col = _col(campo)
        q = (
            select(col.label("motivo"), func.count().label("total"))
            .select_from(Analise)
            .join(Lead, Lead.id == Analise.lead_id)
            .where(
                and_(
                    Analise.cliente_id == cliente_id,
                    Analise.extra_json[campo].astext.isnot(None),
                    Analise.extra_json[campo].astext != "",
                    Analise.extra_json[campo].astext != "null",
                    func.lower(func.trim(Analise.extra_json[campo].astext)).notin_(list(_INVALIDOS)),
                )
            )
            .group_by(col)
            .order_by(func.count().desc())
        )
        if data_inicio:
            q = q.where(Analise.data_ref >= data_inicio)
        if data_fim:
            q = q.where(Analise.data_ref <= data_fim)
        if somente_sem_conversao:
            q = q.where(Lead.etapa_funil.notin_(["Fechado", "fechado"]))
        if telefone_bot:
            q = q.where(Lead.telefone_bot == telefone_bot.strip())
        return q

    rows_nf = (await db.execute(_subq("motivo_nao_fechamento"))).all()
    rows_ds = (await db.execute(_subq("motivo_desistencia"))).all()

    def _prefix_key(text: str) -> str:
        return " ".join(text.split()[:3])

    merged: dict[str, dict] = {}
    for r in list(rows_nf) + list(rows_ds):
        motivo_lower = r.motivo.strip()
        if not motivo_lower or motivo_lower in _INVALIDOS or len(motivo_lower) < 3:
            continue
        key = _prefix_key(motivo_lower)
        if key not in merged:
            merged[key] = {"motivo": motivo_lower.capitalize(), "total": r.total}
        else:
            merged[key]["total"] += r.total

    sorted_items = sorted(merged.values(), key=lambda x: x["total"], reverse=True)[:10]
    sum_total = sum(i["total"] for i in sorted_items) or 1

    return [
        {
            "motivo": item["motivo"],
            "total": item["total"],
            "pct": round(item["total"] / sum_total * 100, 2),
        }
        for item in sorted_items
    ]


# ── Horário ───────────────────────────────────────────────────────────────────

@router.get("/{cliente_id}/horario")
async def get_leads_por_horario(
    cliente_id: UUID,
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    telefone_bot: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Retorna contagem de leads por faixa horária (madrugada/manhã/tarde/noite)."""
    buckets = [
        ("madrugada", "Madrugada (00h-06h)", 0, 6),
        ("manha",     "Manhã (06h-12h)",      6, 12),
        ("tarde",     "Tarde (12h-18h)",       12, 18),
        ("noite",     "Noite (18h-00h)",       18, 24),
    ]

    hora_col = extract("hour", Lead.created_at)
    q = (
        select(hora_col.label("hora"), func.count().label("total"))
        .where(and_(Lead.cliente_id == cliente_id, Lead.ativo == True))
        .group_by(hora_col)
    )
    if data_inicio:
        q = q.where(Lead.created_at >= datetime.combine(data_inicio, dtime.min, _tz.utc))
    if data_fim:
        q = q.where(Lead.created_at < datetime.combine(data_fim + timedelta(days=1), dtime.min, _tz.utc))
    if telefone_bot:
        q = q.where(Lead.telefone_bot == telefone_bot.strip())

    rows = (await db.execute(q)).all()

    # Accumulate into buckets
    counts: dict[str, int] = {b[0]: 0 for b in buckets}
    for r in rows:
        hour = int(r.hora)
        for faixa, _label, h_min, h_max in buckets:
            if h_min <= hour < h_max:
                counts[faixa] += r.total
                break

    sum_total = sum(counts.values()) or 1
    return [
        {
            "faixa": faixa,
            "label": label,
            "total": counts[faixa],
            "pct": round(counts[faixa] / sum_total * 100, 2),
        }
        for faixa, label, _h_min, _h_max in buckets
    ]


# ── Horário de Respostas — 24h ────────────────────────────────────────────────

@router.get("/{cliente_id}/horario-respostas")
async def get_horario_respostas(
    cliente_id: UUID,
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    telefone_bot: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Retorna volume de mensagens de saída (respostas) agrupado por hora do dia (0–23h)."""
    hora_col = extract("hour", Mensagem.enviada_em)
    q = (
        select(hora_col.label("hora"), func.count().label("total"))
        .where(and_(
            Mensagem.cliente_id == cliente_id,
            Mensagem.direcao == "saida",
        ))
        .group_by(hora_col)
        .order_by(hora_col)
    )
    if data_inicio:
        q = q.where(Mensagem.enviada_em >= datetime.combine(data_inicio, dtime.min, _tz.utc))
    if data_fim:
        q = q.where(Mensagem.enviada_em < datetime.combine(data_fim + timedelta(days=1), dtime.min, _tz.utc))
    if telefone_bot:
        # Mensagem não tem telefone_bot — restringe via Lead.telefone_bot
        q = q.where(Mensagem.lead_id.in_(select(Lead.id).where(Lead.telefone_bot == telefone_bot.strip())))

    rows = (await db.execute(q)).all()
    counts = {int(r.hora): r.total for r in rows}
    total = sum(counts.values()) or 1

    return [
        {
            "hora": h,
            "label": f"{h:02d}h",
            "total": counts.get(h, 0),
            "pct": round(counts.get(h, 0) / total * 100, 2),
        }
        for h in range(24)
    ]


@router.get("/{cliente_id}/horario-leads")
async def get_horario_leads(
    cliente_id: UUID,
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    telefone_bot: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Retorna volume de mensagens de entrada (leads) agrupado por hora do dia (0–23h)."""
    hora_col = extract("hour", Mensagem.enviada_em)
    q = (
        select(hora_col.label("hora"), func.count().label("total"))
        .where(and_(
            Mensagem.cliente_id == cliente_id,
            Mensagem.direcao == "entrada",
        ))
        .group_by(hora_col)
        .order_by(hora_col)
    )
    if data_inicio:
        q = q.where(Mensagem.enviada_em >= datetime.combine(data_inicio, dtime.min, _tz.utc))
    if data_fim:
        q = q.where(Mensagem.enviada_em < datetime.combine(data_fim + timedelta(days=1), dtime.min, _tz.utc))
    if telefone_bot:
        q = q.where(Mensagem.lead_id.in_(select(Lead.id).where(Lead.telefone_bot == telefone_bot.strip())))

    rows = (await db.execute(q)).all()
    counts = {int(r.hora): r.total for r in rows}
    total = sum(counts.values()) or 1

    return [
        {
            "hora": h,
            "label": f"{h:02d}h",
            "total": counts.get(h, 0),
            "pct": round(counts.get(h, 0) / total * 100, 2),
        }
        for h in range(24)
    ]


# ── Dia da Semana ─────────────────────────────────────────────────────────────

# Ordem Seg→Dom para exibição (DOW postgres: 0=Dom, 1=Seg, ..., 6=Sáb)
_DIA_ORDER = [1, 2, 3, 4, 5, 6, 0]
_DIA_LABELS = {
    0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb",
}

@router.get("/{cliente_id}/dia-semana")
async def get_leads_por_dia_semana(
    cliente_id: UUID,
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    telefone_bot: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Distribuição de leads únicos por dia da semana da primeira mensagem (Seg→Dom)."""
    # Usa a primeira mensagem de entrada de cada lead para contar 1 lead por dia da semana,
    # evitando inflar o total quando um mesmo lead envia múltiplas mensagens.
    q_sub = (
        select(
            Mensagem.lead_id,
            func.min(Mensagem.enviada_em).label("primeira_em"),
        )
        .where(and_(Mensagem.cliente_id == cliente_id, Mensagem.direcao == "entrada"))
        .group_by(Mensagem.lead_id)
    )
    if data_inicio:
        q_sub = q_sub.where(Mensagem.enviada_em >= datetime.combine(data_inicio, dtime.min, _tz.utc))
    if data_fim:
        q_sub = q_sub.where(Mensagem.enviada_em < datetime.combine(data_fim + timedelta(days=1), dtime.min, _tz.utc))
    if telefone_bot:
        q_sub = q_sub.where(Mensagem.lead_id.in_(select(Lead.id).where(Lead.telefone_bot == telefone_bot.strip())))
    primeira_msg = q_sub.subquery()

    dia_col = extract("dow", primeira_msg.c.primeira_em).label("dia")
    q = (
        select(dia_col, func.count().label("total"))
        .select_from(primeira_msg)
        .group_by(dia_col)
    )

    rows = (await db.execute(q)).all()
    counts: dict[int, int] = {d: 0 for d in range(7)}
    for r in rows:
        counts[int(r.dia)] = r.total

    sum_total = sum(counts.values()) or 1
    return [
        {
            "dia": dow,
            "label": _DIA_LABELS[dow],
            "nome": DIAS_SEMANA[dow],
            "total": counts[dow],
            "pct": round(counts[dow] / sum_total * 100, 1),
        }
        for dow in _DIA_ORDER
    ]


# ── Estado via DDD ─────────────────────────────────────────────────────────────

@router.get("/{cliente_id}/estado-ddd")
async def get_leads_por_estado_ddd(
    cliente_id: UUID,
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    telefone_bot: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Distribuição de leads por estado inferido via DDD do WhatsApp."""
    # Remove prefixo '+' antes de extrair DDD: "+5511..." → "5511...", posições 3-4 = DDD
    numero_norm = func.ltrim(Lead.whatsapp, "+")
    ddd_col = func.substring(numero_norm, 3, 2).label("ddd")
    q = (
        select(ddd_col, func.count().label("total"))
        .where(
            and_(
                Lead.cliente_id == cliente_id,
                Lead.ativo == True,
                # Mínimo 12 chars após normalização: DDI(2) + DDD(2) + número(8+)
                func.length(numero_norm) >= 12,
            )
        )
        .group_by(ddd_col)
        .order_by(func.count().desc())
    )
    if data_inicio:
        q = q.where(Lead.created_at >= datetime.combine(data_inicio, dtime.min, _tz.utc))
    if data_fim:
        q = q.where(Lead.created_at < datetime.combine(data_fim + timedelta(days=1), dtime.min, _tz.utc))
    if telefone_bot:
        q = q.where(Lead.telefone_bot == telefone_bot.strip())

    rows = (await db.execute(q)).all()

    # Agrupa por estado usando o mapeamento DDD→região
    estado_counts: dict[str, int] = {}
    for r in rows:
        regiao = DDD_REGIAO.get(str(r.ddd), "Outros")
        estado_counts[regiao] = estado_counts.get(regiao, 0) + r.total

    # Extrai sigla e nome do formato "Nome do Estado (SG)"
    sum_total = sum(estado_counts.values()) or 1
    resultado = []
    for regiao, total in sorted(estado_counts.items(), key=lambda x: -x[1]):
        # Extrai sigla do padrão "Nome (SG)" ou "Nome/Nome (SG/SG)"
        sigla = regiao.split("(")[-1].rstrip(")").split("/")[0] if "(" in regiao else "?"
        nome = regiao.split("(")[0].strip()
        resultado.append({
            "sigla": sigla,
            "nome": nome,
            "total": total,
            "pct": round(total / sum_total * 100, 1),
        })

    return resultado


# ── Leads por Faixa de Score ─────────────────────────────────────────────────

@router.get("/{cliente_id}/leads-score-faixa")
async def get_leads_por_score_faixa(
    cliente_id: UUID,
    score_min: float = Query(...),
    score_max: float = Query(...),
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    telefone_bot: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Lista leads de uma faixa de score para o drill-down do painel de qualificação."""
    q = (
        select(
            Lead.id,
            Lead.nome,
            Lead.whatsapp,
            Lead.score,
            Lead.etapa_funil,
            Lead.temperatura,
            Lead.created_at,
        )
        .where(
            and_(
                Lead.cliente_id == cliente_id,
                Lead.ativo == True,
                Lead.score.isnot(None),
                Lead.score >= score_min,
                Lead.score <= score_max,
            )
        )
        .order_by(Lead.score.desc(), Lead.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if data_inicio:
        q = q.where(Lead.created_at >= datetime.combine(data_inicio, dtime.min, _tz.utc))
    if data_fim:
        q = q.where(Lead.created_at < datetime.combine(data_fim + timedelta(days=1), dtime.min, _tz.utc))
    if telefone_bot:
        q = q.where(Lead.telefone_bot == telefone_bot.strip())

    rows = (await db.execute(q)).all()
    return [
        {
            "id":         str(r.id),
            "nome":       r.nome,
            "whatsapp":   r.whatsapp,
            "score":      float(r.score),
            "etapa_funil": r.etapa_funil,
            "temperatura": r.temperatura,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


# ── Score de Qualificação — Faixas ────────────────────────────────────────────

_SCORE_FAIXAS = [
    (9, 10, "9–10", "Altíssima qualif.", "#16a34a"),
    (7,  9, "7–8",  "Alta qualif.",      "#4ade80"),
    (5,  7, "5–6",  "Média qualif.",     "#facc15"),
    (3,  5, "3–4",  "Baixa qualif.",     "#fb923c"),
    (1,  3, "1–2",  "Não qualificado",   "#ef4444"),
    (0,  1, "0",    "Sem score",         "#6b7280"),
]

@router.get("/{cliente_id}/score-faixas")
async def get_score_faixas(
    cliente_id: UUID,
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    telefone_bot: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Distribuição de leads por faixa de score de qualificação (escala 1–10)."""
    q = (
        select(Lead.score, func.count().label("total"))
        .where(
            and_(
                Lead.cliente_id == cliente_id,
                Lead.ativo == True,
                Lead.score.isnot(None),
            )
        )
        .group_by(Lead.score)
    )
    if data_inicio:
        q = q.where(Lead.created_at >= datetime.combine(data_inicio, dtime.min, _tz.utc))
    if data_fim:
        q = q.where(Lead.created_at < datetime.combine(data_fim + timedelta(days=1), dtime.min, _tz.utc))
    if telefone_bot:
        q = q.where(Lead.telefone_bot == telefone_bot.strip())

    rows = (await db.execute(q)).all()

    counts: dict[str, int] = {f[2]: 0 for f in _SCORE_FAIXAS}
    for r in rows:
        score = float(r.score)
        for s_min, s_max, faixa, _label, _cor in _SCORE_FAIXAS:
            if s_min <= score < s_max or (s_max == 10 and score == 10):
                counts[faixa] += r.total
                break

    sum_total = sum(counts.values()) or 1
    return [
        {
            "faixa": faixa,
            "label": label,
            "cor": cor,
            "total": counts[faixa],
            "pct": round(counts[faixa] / sum_total * 100, 1),
        }
        for _s_min, _s_max, faixa, label, cor in _SCORE_FAIXAS
    ]


# ── Sentimento Histórico ──────────────────────────────────────────────────────

@router.get("/{cliente_id}/sentimento-historico")
async def get_sentimento_historico(
    cliente_id: UUID,
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    telefone_bot: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Retorna evolução semanal/diária/mensal do sentimento para stacked area chart."""
    # Determine granularity based on range
    if not data_fim:
        data_fim = date.today()
    if not data_inicio:
        data_inicio = data_fim - timedelta(days=29)

    delta_days = (data_fim - data_inicio).days
    if delta_days > 90:
        trunc = "month"
    elif delta_days > 14:
        trunc = "week"
    else:
        trunc = "day"

    dt_from = datetime.combine(data_inicio, dtime.min, _tz.utc)
    dt_to = datetime.combine(data_fim + timedelta(days=1), dtime.min, _tz.utc)

    # Usa data_ref (data da conversa) em vez de created_at (data de processamento)
    # para evitar distorção por atraso do processamento assíncrono
    periodo_col = func.date_trunc(trunc, Analise.data_ref).label("periodo")
    q = (
        select(periodo_col, Analise.sentimento, func.count().label("total"))
        .where(
            and_(
                Analise.cliente_id == cliente_id,
                Analise.data_ref >= data_inicio,
                Analise.data_ref <= data_fim,
            )
        )
        .group_by(periodo_col, Analise.sentimento)
        .order_by(periodo_col)
    )
    if telefone_bot:
        q = q.where(Analise.lead_id.in_(select(Lead.id).where(Lead.telefone_bot == telefone_bot.strip())))

    rows = (await db.execute(q)).all()

    # Pivot into {periodo: {sentimento: count}}
    pivot: dict[str, dict[str, int]] = {}
    sentimentos = ["positivo", "neutro", "negativo", "misto"]
    for r in rows:
        key = r.periodo.date().isoformat()
        if key not in pivot:
            pivot[key] = {s: 0 for s in sentimentos}
        s = (r.sentimento or "").lower()
        if s in sentimentos:
            pivot[key][s] += r.total

    return [
        {
            "periodo": key,
            "positivo": vals["positivo"],
            "neutro": vals["neutro"],
            "negativo": vals["negativo"],
            "misto": vals["misto"],
        }
        for key, vals in sorted(pivot.items())
    ]


# ── Volume de Mensagens ───────────────────────────────────────────────────────

@router.get("/{cliente_id}/mensagens-volume")
async def get_mensagens_volume(
    cliente_id: UUID,
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    telefone_bot: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Retorna contagem diária de mensagens por direção (ia=out, lead=in)."""
    if not data_fim:
        data_fim = date.today()
    if not data_inicio:
        data_inicio = data_fim - timedelta(days=29)

    dt_from = datetime.combine(data_inicio, dtime.min, _tz.utc)
    dt_to = datetime.combine(data_fim + timedelta(days=1), dtime.min, _tz.utc)

    dia_col = func.date_trunc("day", Mensagem.enviada_em).label("dia")
    q = (
        select(
            dia_col,
            func.count().filter(Mensagem.direcao == "saida").label("ia"),
            func.count().filter(Mensagem.direcao == "entrada").label("lead"),
            func.count().label("total"),
        )
        .where(
            and_(
                Mensagem.cliente_id == cliente_id,
                Mensagem.enviada_em >= dt_from,
                Mensagem.enviada_em < dt_to,
            )
        )
        .group_by(dia_col)
        .order_by(dia_col)
    )
    if telefone_bot:
        q = q.where(Mensagem.lead_id.in_(select(Lead.id).where(Lead.telefone_bot == telefone_bot.strip())))

    rows = (await db.execute(q)).all()

    serie = [
        {
            "data": row.dia.date().isoformat(),
            "ia": row.ia or 0,
            "lead": row.lead or 0,
            "total": row.total or 0,
        }
        for row in rows
    ]

    total_ia = sum(r["ia"] for r in serie)
    total_lead = sum(r["lead"] for r in serie)
    total_geral = total_ia + total_lead
    pct_automacao = round(total_ia / total_geral * 100, 2) if total_geral else 0.0

    return {
        "resumo": {
            "total_ia": total_ia,
            "total_lead": total_lead,
            "total_geral": total_geral,
            "pct_automacao": pct_automacao,
        },
        "serie": serie,
    }


# ── Evolução Anual ────────────────────────────────────────────────────────────

_MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
             "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

_CORES_TEMPERATURA = {
    "quente": "#ef4444",
    "morno": "#f97316",
    "frio": "#3b82f6",
    "sem_temp": "#6b7280",
}

_PALETA_ETAPA = [
    "#8b5cf6", "#06b6d4", "#22c55e",
    "#f59e0b", "#ef4444", "#ec4899", "#6b7280",
]


@router.get("/{cliente_id}/evolucao-anual")
async def get_evolucao_anual(
    cliente_id: UUID,
    ano: int = Query(default=None),
    agrupar_por: str = Query(default="temperatura"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Retorna evolução anual de leads agrupada por mês+semana do mês, empilhada
    por temperatura ou etapa_funil. Retorna todos os 48 períodos (12 meses × 4
    semanas) com zeros preenchidos."""
    if ano is None:
        ano = date.today().year

    from datetime import timezone as _tz
    dt_from = datetime(ano, 1, 1, tzinfo=_tz.utc)
    dt_to = datetime(ano + 1, 1, 1, tzinfo=_tz.utc)

    q = (
        select(Lead)
        .where(
            and_(
                Lead.cliente_id == cliente_id,
                Lead.ativo == True,
                Lead.created_at >= dt_from,
                Lead.created_at < dt_to,
            )
        )
    )
    result = await db.execute(q)
    leads = result.scalars().all()

    # Determine grouping keys
    if agrupar_por == "temperatura":
        chaves = ["quente", "morno", "frio", "sem_temp"]
        cores = {k: _CORES_TEMPERATURA[k] for k in chaves}

        def get_key(lead: Lead) -> str:
            t = (lead.temperatura or "").lower()
            return t if t in ("quente", "morno", "frio") else "sem_temp"

    else:
        # agrupar_por == "etapa_funil": top-6 + Outros
        freq: Counter = Counter()
        for lead in leads:
            freq[lead.etapa_funil or "Sem Etapa"] += 1
        top6 = [k for k, _ in freq.most_common(6)]
        outros_existe = len(freq) > 6

        chaves = top6 + (["Outros"] if outros_existe else [])
        cores = {chave: _PALETA_ETAPA[i % len(_PALETA_ETAPA)] for i, chave in enumerate(chaves)}

        top6_set = set(top6)

        def get_key(lead: Lead) -> str:
            etapa = lead.etapa_funil or "Sem Etapa"
            if etapa in top6_set:
                return etapa
            return "Outros"

    # Build empty 48-period grid: {(mes, semana): {chave: 0}}
    grid: dict[tuple[int, int], dict[str, int]] = {}
    for m in range(1, 13):
        for w in range(1, 5):
            grid[(m, w)] = {k: 0 for k in chaves}

    for lead in leads:
        if lead.created_at is None:
            continue
        mes = lead.created_at.month
        dia = lead.created_at.day
        semana = min(math.ceil(dia / 7), 4)
        key = get_key(lead)
        if key in grid[(mes, semana)]:
            grid[(mes, semana)][key] += 1

    # Build series list
    serie = []
    for m in range(1, 13):
        for w in range(1, 5):
            entry = {
                "mes": _MESES_PT[m - 1],
                "mes_num": m,
                "semana": w,
                "label": f"{_MESES_PT[m - 1]} S{w}",
            }
            entry.update(grid[(m, w)])
            serie.append(entry)

    return {
        "ano": ano,
        "agrupar_por": agrupar_por,
        "chaves": chaves,
        "cores": cores,
        "serie": serie,
    }


# ── Leads Recentes ────────────────────────────────────────────────────────────

@router.get("/{cliente_id}/leads-recentes")
async def get_leads_recentes(
    cliente_id: UUID,
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    telefone_bot: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Retorna os leads mais recentes do tenant para exibição no dashboard."""
    latest_intencao = (
        select(Analise.intencao)
        .where(Analise.lead_id == Lead.id, Analise.cliente_id == cliente_id)
        .order_by(desc(Analise.data_ref), desc(Analise.versao))
        .limit(1)
        .scalar_subquery()
    )

    q = (
        select(
            Lead.id,
            Lead.nome,
            Lead.whatsapp,
            Lead.temperatura,
            Lead.score,
            Lead.etapa_funil,
            Lead.created_at,
            latest_intencao.label("intencao"),
        )
        .where(and_(Lead.cliente_id == cliente_id, Lead.ativo == True))
        .order_by(Lead.created_at.desc())
    )
    if data_inicio:
        q = q.where(Lead.created_at >= datetime.combine(data_inicio, dtime.min, _tz.utc))
    if data_fim:
        q = q.where(Lead.created_at < datetime.combine(data_fim + timedelta(days=1), dtime.min, _tz.utc))
    if telefone_bot:
        q = q.where(Lead.telefone_bot == telefone_bot.strip())

    rows = (await db.execute(q)).all()
    return [
        {
            "id":          str(r.id),
            "nome":        r.nome,
            "whatsapp":    r.whatsapp,
            "temperatura": r.temperatura,
            "score":       float(r.score) if r.score is not None else None,
            "etapa_funil": r.etapa_funil,
            "created_at":  r.created_at.isoformat() if r.created_at else None,
            "intencao":    r.intencao,
        }
        for r in rows
    ]


# ─── Leads drilldown (KPI/temperatura/etapa) ───────────────────────────────────
@router.get("/{cliente_id}/leads-drilldown", response_model=List[LeadDrilldownOut])
async def get_leads_drilldown(
    cliente_id: UUID,
    slug: Optional[str] = Query(None, description="Slug do KPI para filtrar (ex: total_leads, leads_bloqueados)"),
    temperatura: Optional[str] = Query(None),
    etapa: Optional[str] = Query(None),
    sigla: Optional[str] = Query(None, description="Sigla do estado (ex: SP, RJ) para filtrar por DDD"),
    campo_filtro: Optional[str] = Query(None, description="Campo do widget para filtrar (ex: cidade_lead, sentimento, kpi_urgencia)"),
    valor_filtro: Optional[str] = Query(None, description="Valor do campo para filtrar"),
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    q = (
        select(Lead)
        .where(Lead.cliente_id == cliente_id, Lead.ativo == True)
        .order_by(desc(Lead.created_at))
        .limit(limit)
        .offset(offset)
    )

    if slug:
        filt = _SLUG_FILTERS.get(slug)
        if filt:
            q = filt(q)

    if temperatura:
        q = q.where(func.lower(Lead.temperatura) == temperatura.lower())

    if etapa:
        q = q.where(func.coalesce(Lead.etapa_funil, "Sem Etapa") == etapa)

    if sigla:
        # Reverse lookup: encontra todos os DDDs que pertencem à sigla informada
        sigla_upper = sigla.upper()
        ddds = [
            ddd for ddd, regiao in DDD_REGIAO.items()
            if f"({sigla_upper})" in regiao
            or f"({sigla_upper}/" in regiao
            or f"/{sigla_upper})" in regiao
        ]
        if ddds:
            numero_norm = func.ltrim(Lead.whatsapp, "+")
            ddd_col = func.substring(numero_norm, 3, 2)
            q = q.where(ddd_col.in_(ddds))
        else:
            q = q.where(literal(False))

    # Filtra por data de criação do lead apenas quando não há campo_filtro de widget.
    # Com campo_filtro, o período é aplicado na subquery de analises — o lead pode ser mais antigo.
    if not campo_filtro:
        if data_inicio:
            q = q.where(Lead.created_at >= datetime.combine(data_inicio, dtime.min, _tz.utc))
        if data_fim:
            q = q.where(Lead.created_at < datetime.combine(data_fim + timedelta(days=1), dtime.min, _tz.utc))

    _LEAD_CAMPOS_DIRETOS = {'cidade_lead', 'estado_lead', 'perfil_lead', 'origem', 'etapa_funil', 'temperatura'}
    if campo_filtro and valor_filtro:
        if campo_filtro in _LEAD_CAMPOS_DIRETOS and hasattr(Lead, campo_filtro):
            col = getattr(Lead, campo_filtro)
            q = q.where(func.lower(func.coalesce(col, '')) == valor_filtro.lower())
        else:
            sub = select(Analise.lead_id).where(Analise.cliente_id == cliente_id)
            if data_inicio:
                sub = sub.where(Analise.data_ref >= data_inicio)
            if data_fim:
                sub = sub.where(Analise.data_ref <= data_fim)
            if campo_filtro.startswith('kpi_dados.'):
                key = campo_filtro.split('.', 1)[1]
                sub = sub.where(Analise.kpi_dados[key].astext.ilike(valor_filtro))
            elif campo_filtro.startswith('extra_json.'):
                key = campo_filtro.split('.', 1)[1]
                sub = sub.where(Analise.extra_json[key].astext.ilike(valor_filtro))
            elif hasattr(Analise, campo_filtro):
                col_a = getattr(Analise, campo_filtro)
                sub = sub.where(func.lower(func.coalesce(col_a, '')) == valor_filtro.lower())
            else:
                sub = sub.where(literal(False))
            q = q.where(Lead.id.in_(sub.distinct()))

    rows = (await db.execute(q)).scalars().all()
    return [
        LeadDrilldownOut(
            id=lead.id,
            nome=lead.nome,
            whatsapp=lead.whatsapp,
            etapa_funil=lead.etapa_funil,
            temperatura=lead.temperatura,
            score=float(lead.score) if lead.score is not None else None,
            created_at=lead.created_at,
        )
        for lead in rows
    ]


# ── Analise Widgets ───────────────────────────────────────────────────────────

_OPERACOES_VALIDAS = set(WIDGET_COMPAT.keys())
_GRAFICOS_VALIDOS  = {"bar", "pie", "donut", "line", "area", "metric", "table", "treemap", "funnel", "column"}
_INVALIDOS_WIDGET  = {
    "null", "none", "n/a", "na", "não informado", "nao informado",
    "nenhuma", "nenhum", "não se aplica", "nao se aplica",
    "indefinido", "desconhecido", "-", "--", ".", "",
}


def _validar_widget(operacao: str, tipo_grafico: str) -> None:
    if operacao not in _OPERACOES_VALIDAS:
        raise HTTPException(status_code=422, detail=f"Operação '{operacao}' inválida.")
    if tipo_grafico not in _GRAFICOS_VALIDOS:
        raise HTTPException(status_code=422, detail=f"Tipo de gráfico '{tipo_grafico}' inválido.")
    if tipo_grafico not in WIDGET_COMPAT.get(operacao, []):
        raise HTTPException(
            status_code=422,
            detail=f"Tipo '{tipo_grafico}' incompatível com '{operacao}'. Compatíveis: {WIDGET_COMPAT[operacao]}",
        )


@router.get("/{cliente_id}/widgets", response_model=List[AnaliseWidgetOut])
async def list_widgets(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Lista widgets ativos do cliente + widgets globais do nicho."""
    cliente_result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = cliente_result.scalar_one_or_none()
    nicho = cliente.nicho if cliente else None

    if nicho:
        cond = and_(
            or_(
                AnaliseWidget.cliente_id == cliente_id,
                and_(AnaliseWidget.cliente_id.is_(None), AnaliseWidget.nicho == nicho),
            ),
            AnaliseWidget.ativo == True,
        )
    else:
        cond = and_(AnaliseWidget.cliente_id == cliente_id, AnaliseWidget.ativo == True)

    rows = (await db.execute(
        select(AnaliseWidget).where(cond).order_by(AnaliseWidget.ordem, AnaliseWidget.created_at)
    )).scalars().all()
    return rows


@router.post("/{cliente_id}/widgets", response_model=AnaliseWidgetOut, status_code=201)
async def create_widget(
    cliente_id: UUID,
    body: AnaliseWidgetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    _validar_widget(body.operacao, body.tipo_grafico)
    widget = AnaliseWidget(cliente_id=cliente_id, **body.model_dump())
    db.add(widget)
    await db.flush()
    await db.refresh(widget)
    return widget


@router.patch("/{cliente_id}/widgets/{widget_id}", response_model=AnaliseWidgetOut)
async def update_widget(
    cliente_id: UUID,
    widget_id: UUID,
    body: AnaliseWidgetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    result = await db.execute(
        select(AnaliseWidget).where(
            AnaliseWidget.id == widget_id,
            AnaliseWidget.cliente_id == cliente_id,
        )
    )
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget não encontrado")
    data = body.model_dump(exclude_none=True)
    if "operacao" in data or "tipo_grafico" in data:
        _validar_widget(data.get("operacao", widget.operacao), data.get("tipo_grafico", widget.tipo_grafico))
    for field, value in data.items():
        setattr(widget, field, value)
    await db.flush()
    await db.refresh(widget)
    return widget


@router.delete("/{cliente_id}/widgets/{widget_id}", status_code=204)
async def delete_widget(
    cliente_id: UUID,
    widget_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    result = await db.execute(
        select(AnaliseWidget).where(
            AnaliseWidget.id == widget_id,
            AnaliseWidget.cliente_id == cliente_id,
        )
    )
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget não encontrado")
    await db.delete(widget)
    await db.flush()


@router.get("/{cliente_id}/widgets/{widget_id}/data", response_model=AnaliseWidgetDataOut)
async def get_widget_data(
    cliente_id: UUID,
    widget_id: UUID,
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    result = await db.execute(
        select(AnaliseWidget).where(
            AnaliseWidget.id == widget_id,
            AnaliseWidget.ativo == True,
            or_(AnaliseWidget.cliente_id == cliente_id, AnaliseWidget.cliente_id.is_(None)),
        )
    )
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget não encontrado ou inativo")

    # total base no período
    q_base = select(func.count()).select_from(Analise).where(Analise.cliente_id == cliente_id)
    if data_inicio:
        q_base = q_base.where(Analise.data_ref >= data_inicio)
    if data_fim:
        q_base = q_base.where(Analise.data_ref <= data_fim)
    total_base = (await db.execute(q_base)).scalar() or 0

    campo = widget.campo

    if widget.operacao == "top_n":
        motivo_col = func.lower(func.trim(Analise.kpi_dados[campo].astext))
        q = (
            select(motivo_col.label("label"), func.count().label("cnt"))
            .select_from(Analise)
            .join(Lead, Lead.id == Analise.lead_id)
            .where(and_(
                Analise.cliente_id == cliente_id,
                Analise.kpi_dados[campo].astext.isnot(None),
                Analise.kpi_dados[campo].astext != "",
                func.lower(func.trim(Analise.kpi_dados[campo].astext)).notin_(list(_INVALIDOS_WIDGET)),
            ))
            .group_by(motivo_col)
            .order_by(func.count().desc())
            .limit(widget.limite)
        )
        if data_inicio:
            q = q.where(Analise.data_ref >= data_inicio)
        if data_fim:
            q = q.where(Analise.data_ref <= data_fim)
        if widget.somente_sem_conversao:
            q = q.where(Lead.etapa_funil.notin_(["Fechado", "fechado"]))
        rows = (await db.execute(q)).all()
        total = sum(r.cnt for r in rows) or 1
        data_out = [
            WidgetDataItem(
                label=r.label.capitalize() if r.label else "—",
                value=r.cnt,
                pct=round(r.cnt / total * 100, 1),
            )
            for r in rows if r.label and len(r.label.strip()) >= 2
        ]
    else:
        class _FakeKpi:
            slug = f"widget_{widget_id}"
            config_calculo = {
                "fonte": "analises",
                "operacao": widget.operacao,
                "campo": f"kpi_dados.{campo}",
                "filtros": widget.filtros or [],
            }
        valor = await calcular_kpi(db, cliente_id, _FakeKpi(), data_inicio, data_fim)
        data_out = [WidgetDataItem(label=widget.label, value=valor)]

    return AnaliseWidgetDataOut(
        id=widget.id,
        label=widget.label,
        tipo_grafico=widget.tipo_grafico,
        operacao=widget.operacao,
        campo=campo,
        cor=widget.cor,
        data=data_out,
        total_base=total_base,
    )


# ── Comparativo de Números ────────────────────────────────────────────────────

@router.get("/{cliente_id}/comparativo-numeros")
async def get_comparativo_numeros(
    cliente_id: UUID,
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """
    Retorna métricas comparativas por número WhatsApp (NumeroBot) do tenant.
    Inclui: total leads, fechados, taxa de conversão, temperatura breakdown,
    score médio e total de mensagens trocadas.
    Visível apenas quando o tenant possui 2+ números cadastrados.
    """
    # Busca números ativos do tenant
    numeros_result = await db.execute(
        select(NumeroBot)
        .where(NumeroBot.cliente_id == cliente_id, NumeroBot.ativo == True)
        .order_by(NumeroBot.nome, NumeroBot.numero)
    )
    numeros = numeros_result.scalars().all()

    if len(numeros) < 2:
        return []

    dt_from = datetime.combine(data_inicio, dtime.min, _tz.utc) if data_inicio else None
    dt_to = datetime.combine(data_fim + timedelta(days=1), dtime.min, _tz.utc) if data_fim else None

    resultado = []
    for num in numeros:
        # Base query: leads vinculados a este número via telefone_bot
        base_cond = and_(
            Lead.cliente_id == cliente_id,
            Lead.ativo == True,
            Lead.telefone_bot == num.numero,
        )
        if dt_from:
            base_cond = and_(base_cond, Lead.created_at >= dt_from)
        if dt_to:
            base_cond = and_(base_cond, Lead.created_at < dt_to)

        # Contagens agregadas em uma única query
        q_agg = select(
            func.count().label("total_leads"),
            func.count().filter(
                func.lower(func.coalesce(Lead.etapa_funil, "")) == "fechado"
            ).label("total_fechados"),
            func.count().filter(Lead.temperatura == "quente").label("quente"),
            func.count().filter(Lead.temperatura == "morno").label("morno"),
            func.count().filter(Lead.temperatura == "frio").label("frio"),
            func.avg(Lead.score).label("score_medio"),
        ).where(base_cond)

        row = (await db.execute(q_agg)).first()

        total_leads = row.total_leads or 0
        total_fechados = row.total_fechados or 0
        taxa_conversao = round(total_fechados / total_leads * 100, 1) if total_leads > 0 else 0.0
        score_medio = float(row.score_medio) if row.score_medio is not None else None
        if score_medio is not None:
            score_medio = round(score_medio, 1)

        # Total de mensagens para este número — via join Lead.telefone_bot
        q_msg = (
            select(func.count())
            .select_from(Mensagem)
            .join(Lead, Lead.id == Mensagem.lead_id)
            .where(
                Mensagem.cliente_id == cliente_id,
                Lead.telefone_bot == num.numero,
            )
        )
        if dt_from:
            q_msg = q_msg.where(Mensagem.enviada_em >= dt_from)
        if dt_to:
            q_msg = q_msg.where(Mensagem.enviada_em < dt_to)

        total_mensagens = (await db.execute(q_msg)).scalar() or 0

        resultado.append({
            "numero_id":      str(num.id),
            "numero":         num.numero,
            "nome":           num.nome or num.numero,
            "total_leads":    total_leads,
            "total_fechados": total_fechados,
            "taxa_conversao": taxa_conversao,
            "quente":         row.quente or 0,
            "morno":          row.morno or 0,
            "frio":           row.frio or 0,
            "score_medio":    score_medio,
            "total_mensagens": total_mensagens,
        })

    # Ordena por total_leads desc
    resultado.sort(key=lambda x: x["total_leads"], reverse=True)
    return resultado
