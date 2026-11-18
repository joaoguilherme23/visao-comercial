"""
Router /feed — listagem vertical de leads com urgência + comentários internos.

GET    /feed/{cliente_id}                                   → lista (filtros)
GET    /feed/{cliente_id}/leads/{lead_id}/comentarios       → histórico
POST   /feed/{cliente_id}/leads/{lead_id}/comentarios       → criar
"""
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_user_tenant_access
from app.models.user import User
from app.schemas.feed import FeedListOut, SnoozeRequest
from app.schemas.comentario import ComentarioOut, ComentarioCreate
from app.schemas.lead import LeadOut
from app.services import feed_service


router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("/{cliente_id}", response_model=FeedListOut)
async def get_feed(
    cliente_id: UUID,
    search: Optional[str] = Query(None),
    temperatura: Optional[str] = Query(None),
    etapa_funil: Optional[str] = Query(None),
    so_acao_requerida: bool = Query(False, description="Filtra somente leads com próximo_passo preenchido"),
    telefone_bot: Optional[str] = Query(None),
    offset: int = Query(0, ge=0, description="Paginação: a partir de qual posição retornar."),
    limit: int = Query(50, ge=1, le=200, description="Quantos cards retornar (default 50, máx 200)."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Retorna a lista paginada do feed, ordenada por urgência (calculada no SQL)."""
    return await feed_service.listar_feed(
        db,
        cliente_id,
        search=search,
        temperatura=temperatura,
        etapa_funil=etapa_funil,
        so_acao_requerida=so_acao_requerida,
        telefone_bot=telefone_bot,
        offset=offset,
        limit=limit,
    )


@router.get(
    "/{cliente_id}/leads/{lead_id}/comentarios",
    response_model=List[ComentarioOut],
)
async def get_comentarios(
    cliente_id: UUID,
    lead_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Histórico de comentários internos do lead, mais recente primeiro."""
    return await feed_service.listar_comentarios(db, cliente_id, lead_id)


@router.post(
    "/{cliente_id}/leads/{lead_id}/comentarios",
    response_model=ComentarioOut,
    status_code=201,
)
async def post_comentario(
    cliente_id: UUID,
    lead_id: UUID,
    body: ComentarioCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Cria comentário interno do time. NÃO envia mensagem ao WhatsApp do lead."""
    return await feed_service.criar_comentario(
        db,
        cliente_id=cliente_id,
        lead_id=lead_id,
        user_id=current_user.id,
        autor_nome=current_user.nome or current_user.email,
        texto=body.texto,
    )


# ── Concluir / desfazer / snooze ─────────────────────────────────────────────

@router.post("/{cliente_id}/leads/{lead_id}/concluir", response_model=LeadOut)
async def post_concluir(
    cliente_id: UUID,
    lead_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Marca lead como concluído no feed — some da listagem."""
    return await feed_service.marcar_concluido(db, cliente_id, lead_id)


@router.post("/{cliente_id}/leads/{lead_id}/desfazer-conclusao", response_model=LeadOut)
async def post_desfazer_conclusao(
    cliente_id: UUID,
    lead_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Reverte concluído_no_feed — card volta ao feed."""
    return await feed_service.desfazer_conclusao(db, cliente_id, lead_id)


@router.post("/{cliente_id}/leads/{lead_id}/snooze", response_model=LeadOut)
async def post_snooze(
    cliente_id: UUID,
    lead_id: UUID,
    body: SnoozeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Soneca temporária — card oculto até `ate` ou pelo período do `preset`."""
    return await feed_service.snooze_lead(
        db, cliente_id, lead_id, preset=body.preset, ate=body.ate
    )


@router.post("/{cliente_id}/leads/{lead_id}/unsnooze", response_model=LeadOut)
async def post_unsnooze(
    cliente_id: UUID,
    lead_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    """Limpa snooze — card volta ao feed imediatamente."""
    return await feed_service.unsnooze_lead(db, cliente_id, lead_id)
