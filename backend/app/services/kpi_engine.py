"""
KPI Engine — executa calculos de KPIs baseado em config_calculo JSONB.

Operacoes suportadas: count, sum, avg, percent, mode, mode_dia_semana, mode_ddd_regiao
Fontes suportadas: leads, analises, mensagens

Opcoes extras em config_calculo:
  skip_ativo_filter (bool) — ignora o filtro ativo=True da fonte (ex: total_leads conta todos)
  multiplicar (number)     — multiplica o resultado final (ex: 100 para converter 0-1 em percentual)
"""

import logging
from datetime import date, datetime, time as dtime, timedelta, timezone as _tz
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
from typing import Any

from app.models.lead import Lead
from app.models.analysis import Analise
from app.models.message import Mensagem

logger = logging.getLogger(__name__)

DIAS_SEMANA = [
    "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
    "Quinta-feira", "Sexta-feira", "Sábado",
]

DDD_REGIAO = {
    "11": "São Paulo (SP)", "12": "São Paulo (SP)", "13": "São Paulo (SP)",
    "14": "São Paulo (SP)", "15": "São Paulo (SP)", "16": "São Paulo (SP)",
    "17": "São Paulo (SP)", "18": "São Paulo (SP)", "19": "São Paulo (SP)",
    "21": "Rio de Janeiro (RJ)", "22": "Rio de Janeiro (RJ)", "24": "Rio de Janeiro (RJ)",
    "27": "Espírito Santo (ES)", "28": "Espírito Santo (ES)",
    "31": "Minas Gerais (MG)", "32": "Minas Gerais (MG)", "33": "Minas Gerais (MG)",
    "34": "Minas Gerais (MG)", "35": "Minas Gerais (MG)", "37": "Minas Gerais (MG)",
    "38": "Minas Gerais (MG)",
    "41": "Paraná (PR)", "42": "Paraná (PR)", "43": "Paraná (PR)",
    "44": "Paraná (PR)", "45": "Paraná (PR)", "46": "Paraná (PR)",
    "47": "Santa Catarina (SC)", "48": "Santa Catarina (SC)", "49": "Santa Catarina (SC)",
    "51": "Rio Grande do Sul (RS)", "53": "Rio Grande do Sul (RS)",
    "54": "Rio Grande do Sul (RS)", "55": "Rio Grande do Sul (RS)",
    "61": "Goiás/DF (GO/DF)", "62": "Goiás (GO)", "64": "Goiás (GO)",
    "63": "Tocantins (TO)",
    "65": "Mato Grosso (MT)", "66": "Mato Grosso (MT)",
    "67": "Mato Grosso do Sul (MS)",
    "68": "Acre (AC)",
    "69": "Rondônia (RO)",
    "71": "Bahia (BA)", "73": "Bahia (BA)", "74": "Bahia (BA)",
    "75": "Bahia (BA)", "77": "Bahia (BA)",
    "79": "Sergipe (SE)",
    "81": "Pernambuco (PE)", "87": "Pernambuco (PE)",
    "82": "Alagoas (AL)",
    "83": "Paraíba (PB)",
    "84": "Rio Grande do Norte (RN)",
    "85": "Ceará (CE)", "88": "Ceará (CE)",
    "86": "Piauí (PI)", "89": "Piauí (PI)",
    "91": "Pará (PA)", "93": "Pará (PA)", "94": "Pará (PA)",
    "92": "Amazonas (AM)", "97": "Amazonas (AM)",
    "95": "Roraima (RR)",
    "96": "Amapá (AP)",
    "98": "Maranhão (MA)", "99": "Maranhão (MA)",
}

FONTES = {
    "leads": Lead,
    "analises": Analise,
    "mensagens": Mensagem,
}

# Coluna de data por fonte para filtro de período
_DATE_COL = {
    "leads": lambda: Lead.created_at,
    "analises": lambda: Analise.data_ref,
    "mensagens": lambda: Mensagem.enviada_em,
}

OPS = {
    "eq": lambda col, val: col == val,
    "neq": lambda col, val: col != val,
    "gt": lambda col, val: col > val,
    "gte": lambda col, val: col >= val,
    "lt": lambda col, val: col < val,
    "lte": lambda col, val: col <= val,
    "ilike": lambda col, val: col.ilike(f"%{val}%"),
    "notnull": lambda col, val: col.isnot(None),
    "isnull": lambda col, val: col.is_(None),
}


def _resolve_column(model, campo: str, config: dict):
    if campo.startswith("dados."):
        json_key = campo.split(".", 1)[1]
        return model.dados[json_key].astext
    if campo.startswith("kpi_dados."):
        json_key = campo.split(".", 1)[1]
        return model.kpi_dados[json_key].astext
    if campo.startswith("extra_json."):
        json_key = campo.split(".", 1)[1]
        return model.extra_json[json_key].astext
    if hasattr(model, campo):
        return getattr(model, campo)
    return None


def _apply_base_filters(q, model, cliente_id: UUID, config: dict = None):
    if hasattr(model, "cliente_id"):
        q = q.where(model.cliente_id == cliente_id)
    if hasattr(model, "ativo"):
        skip = config and config.get("skip_ativo_filter", False)
        if not skip:
            q = q.where(model.ativo == True)
    return q


def _apply_date_filter(q, fonte_nome: str, date_from: date | None, date_to: date | None):
    """Aplica filtro de período na coluna de data da fonte.

    Usa limite superior exclusivo (< date_to + 1d) para garantir que o dia inteiro seja
    incluído em colunas DateTime (created_at, enviada_em) — consistente com os endpoints
    dedicados do router. Para colunas Date (data_ref) o resultado é idêntico.
    """
    if date_from is None and date_to is None:
        return q
    col_fn = _DATE_COL.get(fonte_nome)
    if col_fn is None:
        return q
    col = col_fn()
    if date_from is not None:
        q = q.where(col >= datetime.combine(date_from, dtime.min, _tz.utc).replace(tzinfo=_tz.utc))
    if date_to is not None:
        q = q.where(col < datetime.combine(date_to + timedelta(days=1), dtime.min, _tz.utc).replace(tzinfo=_tz.utc))
    return q


def _apply_telefone_bot_filter(q, fonte_nome: str, telefone_bot: str | None):
    """Aplica filtro por telefone_bot (número do WhatsApp que atendeu o lead).

    - fonte=leads: filtra direto em Lead.telefone_bot
    - fonte=analises / mensagens: restringe lead_id a leads com o telefone_bot informado
    """
    if not telefone_bot:
        return q
    tb = telefone_bot.strip()
    if not tb:
        return q
    if fonte_nome == "leads":
        return q.where(Lead.telefone_bot == tb)
    if fonte_nome in ("analises", "mensagens"):
        model = FONTES[fonte_nome]
        lead_ids_sub = select(Lead.id).where(Lead.telefone_bot == tb)
        return q.where(model.lead_id.in_(lead_ids_sub))
    return q


def _apply_custom_filters(q, model, filtros: list, config: dict):
    for f in filtros:
        col = _resolve_column(model, f.get("campo", ""), config)
        if col is None:
            continue
        op_fn = OPS.get(f.get("op", "eq"))
        if op_fn is None:
            continue
        valor = f.get("valor")
        campo = f.get("campo", "")
        if isinstance(valor, bool) and (campo.startswith("dados.") or campo.startswith("kpi_dados.") or campo.startswith("extra_json.")):
            valor = str(valor).lower()
        q = q.where(op_fn(col, valor))
    return q


async def calcular_kpi(
    db: AsyncSession,
    cliente_id: UUID,
    kpi,
    date_from: date | None = None,
    date_to: date | None = None,
    telefone_bot: str | None = None,
) -> Any:
    config = kpi.config_calculo
    fonte_nome = config.get("fonte", "leads")
    operacao = config.get("operacao", "count")
    filtros = config.get("filtros", [])

    model = FONTES.get(fonte_nome)
    if model is None:
        logger.warning("KPI '%s': fonte desconhecida '%s'", kpi.slug, fonte_nome)
        return 0

    try:
        if operacao == "count":
            result = await _count(db, model, filtros, config, cliente_id, fonte_nome, date_from, date_to, telefone_bot)
        elif operacao == "sum":
            result = await _sum(db, model, filtros, config, cliente_id, fonte_nome, date_from, date_to, telefone_bot)
        elif operacao == "avg":
            result = await _avg(db, model, filtros, config, cliente_id, fonte_nome, date_from, date_to, telefone_bot)
        elif operacao == "percent":
            result = await _percent(db, model, filtros, config, cliente_id, fonte_nome, date_from, date_to, telefone_bot)
        elif operacao == "top_n":
            result = await _top_n(db, model, filtros, config, cliente_id, fonte_nome, date_from, date_to, telefone_bot)
        elif operacao == "count_distinct":
            result = await _count_distinct(db, model, filtros, config, cliente_id, fonte_nome, date_from, date_to, telefone_bot)
        elif operacao == "mode":
            result = await _mode(db, model, filtros, config, cliente_id, fonte_nome, date_from, date_to, telefone_bot)
        elif operacao == "mode_dia_semana":
            result = await _mode_dia_semana(db, cliente_id, date_from, date_to, telefone_bot)
        elif operacao == "mode_ddd_regiao":
            result = await _mode_ddd_regiao(db, cliente_id, date_from, date_to, telefone_bot)
        elif operacao == "avg_hora_resposta":
            result = await _avg_hora_resposta(db, cliente_id, date_from, date_to, telefone_bot)
        elif operacao == "avg_tempo_primeira_resposta":
            result = await _avg_tempo_primeira_resposta(db, cliente_id, date_from, date_to, telefone_bot)
        else:
            logger.warning("KPI '%s': operacao desconhecida '%s'", kpi.slug, operacao)
            return 0

        multiplicar = config.get("multiplicar")
        if multiplicar and isinstance(result, (int, float)):
            result = round(result * multiplicar, 1)

        return result

    except Exception:
        logger.exception("Erro ao calcular KPI '%s' (fonte=%s, op=%s)", kpi.slug, fonte_nome, operacao)
        return 0


async def calcular_kpi_com_comparacao(
    db: AsyncSession,
    cliente_id: UUID,
    kpi,
    date_from: date | None = None,
    date_to: date | None = None,
    telefone_bot: str | None = None,
) -> tuple[Any, float | None, float | None]:
    """Calcula KPI para o período atual e compara com o período anterior de igual duração.

    Returns:
        (valor_atual, variacao_pct, valor_anterior)
        variacao_pct e valor_anterior são None quando não é possível comparar.
    """
    valor_atual = await calcular_kpi(db, cliente_id, kpi, date_from, date_to, telefone_bot)

    # Só faz comparação para resultados numéricos com período definido
    if not isinstance(valor_atual, (int, float)) or date_from is None or date_to is None:
        return valor_atual, None, None

    duracao_dias = (date_to - date_from).days + 1
    prev_to = date_from - timedelta(days=1)
    prev_from = prev_to - timedelta(days=duracao_dias - 1)

    try:
        prev_raw = await calcular_kpi(db, cliente_id, kpi, prev_from, prev_to, telefone_bot)
    except Exception:
        return valor_atual, None, None

    if not isinstance(prev_raw, (int, float)):
        return valor_atual, None, None

    valor_anterior = float(prev_raw)
    atual = float(valor_atual)

    if valor_anterior != 0:
        variacao_pct = round(((atual - valor_anterior) / valor_anterior) * 100, 1)
    elif atual > 0:
        variacao_pct = 100.0
    else:
        variacao_pct = 0.0

    return valor_atual, variacao_pct, valor_anterior


async def _count(db, model, filtros, config, cliente_id, fonte_nome, date_from, date_to, telefone_bot=None):
    q = select(func.count()).select_from(model)
    q = _apply_base_filters(q, model, cliente_id, config)
    q = _apply_date_filter(q, fonte_nome, date_from, date_to)
    q = _apply_telefone_bot_filter(q, fonte_nome, telefone_bot)
    q = _apply_custom_filters(q, model, filtros, config)
    return (await db.execute(q)).scalar() or 0


async def _count_distinct(db, model, filtros, config, cliente_id, fonte_nome, date_from, date_to, telefone_bot=None):
    """Conta valores distintos de um campo (ex: lead_id únicos), ignorando NULLs automaticamente."""
    distinct_campo = config.get("distinct_campo", "lead_id")
    col = _resolve_column(model, distinct_campo, config)
    if col is None:
        return 0
    q = select(func.count(col.distinct())).select_from(model)
    q = _apply_base_filters(q, model, cliente_id, config)
    q = _apply_date_filter(q, fonte_nome, date_from, date_to)
    q = _apply_telefone_bot_filter(q, fonte_nome, telefone_bot)
    q = _apply_custom_filters(q, model, filtros, config)
    return (await db.execute(q)).scalar() or 0


async def _sum(db, model, filtros, config, cliente_id, fonte_nome, date_from, date_to, telefone_bot=None):
    col = _resolve_column(model, config.get("campo", ""), config)
    if col is None:
        return 0
    q = select(func.sum(col)).select_from(model)
    q = _apply_base_filters(q, model, cliente_id, config)
    q = _apply_date_filter(q, fonte_nome, date_from, date_to)
    q = _apply_telefone_bot_filter(q, fonte_nome, telefone_bot)
    q = _apply_custom_filters(q, model, filtros, config)
    val = (await db.execute(q)).scalar()
    return round(float(val), 2) if val else 0


async def _avg(db, model, filtros, config, cliente_id, fonte_nome, date_from, date_to, telefone_bot=None):
    col = _resolve_column(model, config.get("campo", ""), config)
    if col is None:
        return 0
    q = select(func.avg(col)).select_from(model)
    q = _apply_base_filters(q, model, cliente_id, config)
    q = _apply_date_filter(q, fonte_nome, date_from, date_to)
    q = _apply_telefone_bot_filter(q, fonte_nome, telefone_bot)
    q = _apply_custom_filters(q, model, filtros, config)
    val = (await db.execute(q)).scalar()
    return round(float(val), 2) if val else 0


async def _percent(db, model, filtros, config, cliente_id, fonte_nome, date_from, date_to, telefone_bot=None):
    filtros_num = config.get("filtros_numerador", filtros)
    filtros_den = config.get("filtros_denominador", [])

    q_total = select(func.count()).select_from(model)
    q_total = _apply_base_filters(q_total, model, cliente_id, config)
    q_total = _apply_date_filter(q_total, fonte_nome, date_from, date_to)
    q_total = _apply_telefone_bot_filter(q_total, fonte_nome, telefone_bot)
    q_total = _apply_custom_filters(q_total, model, filtros_den, config)
    total = (await db.execute(q_total)).scalar() or 0
    if total == 0:
        return 0

    q_num = select(func.count()).select_from(model)
    q_num = _apply_base_filters(q_num, model, cliente_id, config)
    q_num = _apply_date_filter(q_num, fonte_nome, date_from, date_to)
    q_num = _apply_telefone_bot_filter(q_num, fonte_nome, telefone_bot)
    q_num = _apply_custom_filters(q_num, model, filtros_num, config)
    num = (await db.execute(q_num)).scalar() or 0
    return round((num / total) * 100, 1)


async def _mode(db, model, filtros, config, cliente_id, fonte_nome, date_from, date_to, telefone_bot=None):
    col = _resolve_column(model, config.get("campo", ""), config)
    if col is None:
        return "—"
    q = select(col, func.count().label("cnt")).select_from(model).where(col.isnot(None))
    q = _apply_base_filters(q, model, cliente_id, config)
    q = _apply_date_filter(q, fonte_nome, date_from, date_to)
    q = _apply_telefone_bot_filter(q, fonte_nome, telefone_bot)
    q = _apply_custom_filters(q, model, filtros, config)
    q = q.group_by(col).order_by(func.count().desc()).limit(1)
    row = (await db.execute(q)).first()
    return str(row[0]) if row else "—"


async def _top_n(db, model, filtros, config, cliente_id, fonte_nome, date_from, date_to, telefone_bot=None):
    """Retorna lista [{label, value, pct}] com os N valores mais frequentes de um campo."""
    col = _resolve_column(model, config.get("campo", ""), config)
    if col is None:
        return []
    limite = config.get("limite", 10)
    col_lower = func.lower(func.trim(col))
    q = (
        select(col_lower.label("label"), func.count().label("cnt"))
        .select_from(model)
        .where(col.isnot(None))
    )
    q = _apply_base_filters(q, model, cliente_id, config)
    q = _apply_date_filter(q, fonte_nome, date_from, date_to)
    q = _apply_telefone_bot_filter(q, fonte_nome, telefone_bot)
    q = _apply_custom_filters(q, model, filtros, config)
    q = q.group_by(col_lower).order_by(func.count().desc()).limit(limite)
    rows = (await db.execute(q)).all()
    total = sum(r.cnt for r in rows) or 1
    return [
        {
            "label": r.label.capitalize() if r.label else "—",
            "value": r.cnt,
            "pct": round(r.cnt / total * 100, 1),
        }
        for r in rows
        if r.label and len(r.label.strip()) >= 2
    ]


async def _mode_dia_semana(db, cliente_id: UUID, date_from: date | None, date_to: date | None, telefone_bot: str | None = None) -> str:
    dia_col = func.extract("dow", Mensagem.enviada_em).label("dia")
    q = (
        select(dia_col, func.count().label("cnt"))
        .where(Mensagem.cliente_id == cliente_id, Mensagem.direcao == "entrada")
    )
    if date_from:
        q = q.where(Mensagem.enviada_em >= datetime.combine(date_from, dtime.min, _tz.utc))
    if date_to:
        q = q.where(Mensagem.enviada_em < datetime.combine(date_to + timedelta(days=1), dtime.min, _tz.utc))
    q = _apply_telefone_bot_filter(q, "mensagens", telefone_bot)
    q = q.group_by(dia_col).order_by(func.count().desc()).limit(1)
    row = (await db.execute(q)).first()
    if not row:
        return "—"
    return DIAS_SEMANA[int(row.dia)]


async def _mode_ddd_regiao(db, cliente_id: UUID, date_from: date | None, date_to: date | None, telefone_bot: str | None = None) -> str:
    # Remove prefixo '+' antes de extrair DDD: "+5511..." → "5511...", "5511..." → posição 3-4
    numero_norm = func.ltrim(Lead.whatsapp, "+")
    ddd_col = func.substring(numero_norm, 3, 2).label("ddd")
    # Mínimo 12 chars após normalização: DDI(2) + DDD(2) + número(8+)
    q = (
        select(ddd_col, func.count().label("cnt"))
        .where(
            Lead.cliente_id == cliente_id,
            Lead.ativo == True,
            func.length(numero_norm) >= 12,
        )
    )
    if date_from:
        q = q.where(Lead.created_at >= datetime.combine(date_from, dtime.min, _tz.utc))
    if date_to:
        q = q.where(Lead.created_at < datetime.combine(date_to + timedelta(days=1), dtime.min, _tz.utc))
    q = _apply_telefone_bot_filter(q, "leads", telefone_bot)
    q = q.group_by(ddd_col).order_by(func.count().desc()).limit(1)
    row = (await db.execute(q)).first()
    if not row:
        return "—"
    return DDD_REGIAO.get(row.ddd, "Outros")


async def _avg_hora_resposta(db, cliente_id: UUID, date_from: date | None, date_to: date | None, telefone_bot: str | None = None) -> str:
    q = select(func.avg(func.extract("hour", Mensagem.enviada_em))).where(
        Mensagem.cliente_id == cliente_id, Mensagem.direcao == "entrada"
    )
    if date_from:
        q = q.where(Mensagem.enviada_em >= datetime.combine(date_from, dtime.min, _tz.utc))
    if date_to:
        q = q.where(Mensagem.enviada_em < datetime.combine(date_to + timedelta(days=1), dtime.min, _tz.utc))
    q = _apply_telefone_bot_filter(q, "mensagens", telefone_bot)
    val = (await db.execute(q)).scalar()
    if val is None:
        return "—"
    hora = int(round(float(val)))
    return f"{hora:02d}h"


async def _avg_tempo_primeira_resposta(db, cliente_id: UUID, date_from: date | None, date_to: date | None, telefone_bot: str | None = None) -> str:
    dt_from = datetime.combine(date_from, dtime.min, _tz.utc) if date_from else None
    dt_to = datetime.combine(date_to + timedelta(days=1), dtime.min, _tz.utc) if date_to else None

    # Se filtrar por telefone_bot, restringe aos leads atendidos por esse número
    lead_filter_sub = None
    if telefone_bot and telefone_bot.strip():
        lead_filter_sub = select(Lead.id).where(Lead.telefone_bot == telefone_bot.strip())

    # Primeira mensagem de entrada por lead — filtrada pelo período selecionado
    sub_in = (
        select(
            Mensagem.lead_id.label("lead_id"),
            func.min(Mensagem.enviada_em).label("min_in"),
        )
        .where(Mensagem.cliente_id == cliente_id, Mensagem.direcao == "entrada")
        .group_by(Mensagem.lead_id)
    )
    if dt_from:
        sub_in = sub_in.where(Mensagem.enviada_em >= dt_from)
    if dt_to:
        sub_in = sub_in.where(Mensagem.enviada_em < dt_to)
    if lead_filter_sub is not None:
        sub_in = sub_in.where(Mensagem.lead_id.in_(lead_filter_sub))
    sub_in = sub_in.subquery()

    # Primeira mensagem de saída por lead — sem filtro de data,
    # apenas precisa ser posterior à primeira entrada do lead
    sub_out_q = (
        select(
            Mensagem.lead_id.label("lead_id"),
            func.min(Mensagem.enviada_em).label("min_out"),
        )
        .where(Mensagem.cliente_id == cliente_id, Mensagem.direcao == "saida")
        .group_by(Mensagem.lead_id)
    )
    if lead_filter_sub is not None:
        sub_out_q = sub_out_q.where(Mensagem.lead_id.in_(lead_filter_sub))
    sub_out = sub_out_q.subquery()

    _CAP_MINS = 24 * 60  # ignora leads onde a 1ª resposta demorou mais de 24h (outliers)
    diff_mins = func.extract("epoch", sub_out.c.min_out - sub_in.c.min_in) / 60
    q = (
        select(func.avg(diff_mins))
        .select_from(sub_in)
        .join(sub_out, sub_out.c.lead_id == sub_in.c.lead_id)
        .where(
            sub_out.c.min_out > sub_in.c.min_in,
            diff_mins <= _CAP_MINS,
        )
    )

    val = (await db.execute(q)).scalar()
    if val is None:
        return "—"
    mins = int(round(float(val)))
    if mins < 60:
        return f"{mins}min"
    return f"{mins // 60}h{mins % 60:02d}min"
