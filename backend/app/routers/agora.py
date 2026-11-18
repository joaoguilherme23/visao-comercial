"""
Router da Fila "Agora" — feed acionável priorizado por tenant.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_user_tenant_access
from app.models.user import User
from app.schemas.agora import AgoraBoardOut
from app.services.agora_service import build_agora_board

router = APIRouter(prefix="/agora", tags=["agora"])


@router.get("/{cliente_id}", response_model=AgoraBoardOut)
async def get_agora_board(
    cliente_id: UUID,
    horas_quente: int = Query(
        2,
        ge=1,
        le=48,
        description="Horas sem resposta para considerar lead quente como alvo prioritário (1-48).",
    ),
    limit_por_bucket: int = Query(
        20,
        ge=1,
        le=50,
        description="Máximo de itens por bucket (1-50).",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
) -> AgoraBoardOut:
    """
    Retorna o feed "Agora" com 4 buckets fixos ordenados por prioridade:

    1. **quente_sem_resposta** — lead quente cuja última msg é de entrada e
       passou mais de `horas_quente` horas sem resposta.
    2. **followup_vencido** — lead com `followup_em` no passado.
    3. **esfriando** — lead morno com última interação entre 24h e 72h.
    4. **sinal_ia** — lead com `extra_json.oportunidade_aberta == 'true'`
       na análise mais recente e última msg de entrada em ≤ 72h.

    Deduplicação: um lead aparece em no máximo um bucket (o de maior
    prioridade). Cache Redis de 20s.
    """
    return await build_agora_board(
        session=db,
        cliente_id=cliente_id,
        horas_quente=horas_quente,
        limit_por_bucket=limit_por_bucket,
    )
