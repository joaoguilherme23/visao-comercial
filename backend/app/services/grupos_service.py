"""
Serviço de Grupos — leitura de integracao.grupos e integracao.grupos_mensagens.

Regras de negócio:
- Tenant isolation: todo acesso é filtrado por cliente_id.
- Bot filter (X9/AIA): participant_name NOT ILIKE '%X9%' AND NOT ILIKE '%AIA%'
  é aplicado em mensagens e participantes, NÃO na listagem de grupos — um grupo
  cujo último movimento foi do bot ainda deve ser listado.
  TODO(migrar-para-coluna-formal-is_bot): quando o pipeline de ingestão marcar
  mensagens do bot com `is_bot=true`, trocar o filtro por nome por `is_bot = false`.
- Ordenação: grupos por update_at DESC NULLS LAST → ultima_interacao DESC NULLS LAST.
- Paginação de mensagens: offset/limit (limit 1..200).
"""
from __future__ import annotations

from typing import Tuple
from uuid import UUID

from sqlalchemy import and_, asc, desc, func, not_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.grupo import Grupo, GrupoMensagem
from app.schemas.grupos import (
    GrupoListItemOut,
    GrupoMensagemOut,
    GrupoMensagensPageOut,
    GrupoParticipanteOut,
    GrupoParticipantesOut,
)


# ---------------------------------------------------------------------------
# Filtro de bot — compartilhado entre endpoints 2 e 3.
# TODO(is_bot): migrar para flag booleana em grupos_mensagens quando disponível.
# ---------------------------------------------------------------------------

def _bot_filter_clause():
    """
    Cláusula SQL para excluir mensagens do bot (X9/AIA).

    Regra: participant_name NOT ILIKE '%X9%' AND participant_name NOT ILIKE '%AIA%'.
    participant_name NULL também é excluído (maioria desses casos = bot sem nome).

    Uso: .where(_bot_filter_clause())
    """
    name_col = GrupoMensagem.participant_name
    return and_(
        name_col.is_not(None),
        not_(name_col.ilike("%X9%")),
        not_(name_col.ilike("%AIA%")),
    )


# ---------------------------------------------------------------------------
# 1) Listagem de grupos do tenant
# ---------------------------------------------------------------------------

async def listar_grupos(
    session: AsyncSession,
    cliente_id: UUID,
) -> list[GrupoListItemOut]:
    """
    Retorna todos os grupos de um cliente, com totais agregados.

    NÃO aplica filtro de bot — um grupo cuja última mensagem veio do X9 ainda
    deve aparecer. total_mensagens e total_participantes contam TODAS as
    mensagens/participantes do grupo (inclusive bot).

    Ordenação: update_at DESC NULLS LAST, depois ultima_interacao DESC NULLS LAST.
    """
    # Subquery: total de mensagens por grupo (todas — inclui bot).
    total_msgs_sq = (
        select(
            GrupoMensagem.grupo_id.label("grupo_id"),
            func.count(GrupoMensagem.id).label("total"),
        )
        .where(GrupoMensagem.cliente_id == cliente_id)
        .group_by(GrupoMensagem.grupo_id)
        .subquery()
    )

    # Subquery: participantes distintos por grupo (todos — inclui bot).
    total_parts_sq = (
        select(
            GrupoMensagem.grupo_id.label("grupo_id"),
            func.count(func.distinct(GrupoMensagem.participant_number)).label("total"),
        )
        .where(
            GrupoMensagem.cliente_id == cliente_id,
            GrupoMensagem.participant_number.is_not(None),
        )
        .group_by(GrupoMensagem.grupo_id)
        .subquery()
    )

    stmt = (
        select(
            Grupo,
            func.coalesce(total_msgs_sq.c.total, 0).label("total_mensagens"),
            func.coalesce(total_parts_sq.c.total, 0).label("total_participantes"),
        )
        .outerjoin(total_msgs_sq, Grupo.id == total_msgs_sq.c.grupo_id)
        .outerjoin(total_parts_sq, Grupo.id == total_parts_sq.c.grupo_id)
        .where(Grupo.cliente_id == cliente_id)
        .order_by(
            desc(Grupo.update_at).nulls_last(),
            desc(Grupo.ultima_interacao).nulls_last(),
        )
    )

    rows = (await session.execute(stmt)).all()

    return [
        GrupoListItemOut(
            id=g.id,
            cliente_id=g.cliente_id,
            whatsapp=g.whatsapp,
            nome=g.nome,
            temperatura=g.temperatura,
            foto_url=g.foto_url,
            ultima_interacao=g.ultima_interacao,
            created_at=g.created_at,
            update_at=g.update_at,
            total_mensagens=int(total_msgs or 0),
            total_participantes=int(total_parts or 0),
        )
        for (g, total_msgs, total_parts) in rows
    ]


# ---------------------------------------------------------------------------
# 2) Mensagens paginadas de um grupo (COM filtro de bot)
# ---------------------------------------------------------------------------

async def _verificar_grupo_pertence(
    session: AsyncSession,
    grupo_id: UUID,
    cliente_id: UUID,
) -> bool:
    """Check de isolamento: grupo_id precisa existir E pertencer ao cliente_id."""
    stmt = select(Grupo.id).where(
        Grupo.id == grupo_id,
        Grupo.cliente_id == cliente_id,
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none() is not None


async def listar_mensagens(
    session: AsyncSession,
    cliente_id: UUID,
    grupo_id: UUID,
    limit: int = 50,
    offset: int = 0,
) -> GrupoMensagensPageOut:
    """
    Mensagens de um grupo, paginadas, com filtro de bot aplicado.

    Ordem: enviada_em DESC (mais recente primeiro).
    Assume que `grupo_id` já foi validado como pertencente ao cliente_id no router.
    """
    base_where = and_(
        GrupoMensagem.cliente_id == cliente_id,
        GrupoMensagem.grupo_id == grupo_id,
        _bot_filter_clause(),
    )

    total_stmt = select(func.count(GrupoMensagem.id)).where(base_where)
    total = (await session.execute(total_stmt)).scalar_one()

    items_stmt = (
        select(GrupoMensagem)
        .where(base_where)
        .order_by(desc(GrupoMensagem.enviada_em))
        .offset(offset)
        .limit(limit)
    )
    items = (await session.execute(items_stmt)).scalars().all()

    return GrupoMensagensPageOut(
        total=int(total or 0),
        limit=limit,
        offset=offset,
        items=[GrupoMensagemOut.model_validate(m) for m in items],
    )


# ---------------------------------------------------------------------------
# 3) Participantes agregados de um grupo (COM filtro de bot)
# ---------------------------------------------------------------------------

async def listar_participantes(
    session: AsyncSession,
    cliente_id: UUID,
    grupo_id: UUID,
) -> GrupoParticipantesOut:
    """
    Agrega participantes de um grupo por participant_number.

    Filtro de bot aplicado (X9/AIA fora). Para cada número, retorna o último
    participant_name conhecido (via função agregada MAX — pragmático, pois
    nomes tendem a ser estáveis no WhatsApp).

    Ordenação: total_mensagens DESC, ultima_msg_em DESC.
    Assume que `grupo_id` já foi validado como pertencente ao cliente_id no router.
    """
    base_where = and_(
        GrupoMensagem.cliente_id == cliente_id,
        GrupoMensagem.grupo_id == grupo_id,
        GrupoMensagem.participant_number.is_not(None),
        _bot_filter_clause(),
    )

    stmt = (
        select(
            GrupoMensagem.participant_number.label("participant_number"),
            func.max(GrupoMensagem.participant_name).label("participant_name"),
            func.count(GrupoMensagem.id).label("total_mensagens"),
            func.min(GrupoMensagem.enviada_em).label("primeira_msg_em"),
            func.max(GrupoMensagem.enviada_em).label("ultima_msg_em"),
        )
        .where(base_where)
        .group_by(GrupoMensagem.participant_number)
        .order_by(desc("total_mensagens"), desc("ultima_msg_em"))
    )

    rows = (await session.execute(stmt)).all()

    items = [
        GrupoParticipanteOut(
            participant_number=r.participant_number,
            participant_name=r.participant_name,
            total_mensagens=int(r.total_mensagens),
            primeira_msg_em=r.primeira_msg_em,
            ultima_msg_em=r.ultima_msg_em,
        )
        for r in rows
    ]

    return GrupoParticipantesOut(
        grupo_id=grupo_id,
        total=len(items),
        items=items,
    )
