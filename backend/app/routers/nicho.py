from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_superadmin, get_user_tenant_access
from app.models.nicho import NichoConfig
from app.models.analysis import Analise
from app.models.user import User
from app.schemas.nicho import (
    NichoConfigCreate, NichoConfigUpdate, NichoConfigOut,
    KpiGenericoOut,
)

router = APIRouter(prefix="/nichos", tags=["nichos"])


# ── KpiGenerico (BEFORE /{nicho} to avoid route conflict) ───────────────────

@router.get("/kpi/{analise_id}", response_model=List[KpiGenericoOut])
async def get_kpi_por_analise(
    analise_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Resolve the tenant that owns this analysis, then verify access
    analise_result = await db.execute(
        select(Analise).where(Analise.id == analise_id)
    )
    analise = analise_result.scalar_one_or_none()
    if not analise:
        raise HTTPException(status_code=404, detail="Análise não encontrada")

    await get_user_tenant_access(str(analise.cliente_id), current_user, db)

    return [{
        "id": analise.id,
        "cliente_id": analise.cliente_id,
        "analise_id": analise.id,
        "nicho": analise.extra_json.get("nicho") if analise.extra_json else None,
        "dados": analise.kpi_dados,
        "score_fechamento": analise.kpi_score_fechamento,
        "proximo_contato": analise.kpi_proximo_contato,
        "urgencia": analise.kpi_urgencia,
        "created_at": analise.created_at,
    }]


# ── NichoConfig ─────────────────────────────────────────────────────────────

@router.get("", response_model=List[NichoConfigOut])
async def list_nichos(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(NichoConfig).order_by(NichoConfig.nicho)
    )
    return result.scalars().all()


@router.get("/{nicho}", response_model=NichoConfigOut)
async def get_nicho(
    nicho: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(NichoConfig).where(NichoConfig.nicho == nicho))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(404, f"Nicho '{nicho}' não configurado")
    return config


@router.post("", response_model=NichoConfigOut, status_code=201)
async def create_nicho(
    body: NichoConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superadmin),
):
    existing = await db.execute(select(NichoConfig).where(NichoConfig.nicho == body.nicho))
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Nicho '{body.nicho}' já existe")

    config = NichoConfig(**body.model_dump())
    db.add(config)
    await db.flush()
    await db.refresh(config)
    return config


@router.patch("/{nicho}", response_model=NichoConfigOut)
async def update_nicho(
    nicho: str,
    body: NichoConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superadmin),
):
    result = await db.execute(select(NichoConfig).where(NichoConfig.nicho == nicho))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(404, f"Nicho '{nicho}' não encontrado")

    JSONB_FIELDS = {"campos_kpi", "campos_analise", "etapas_kanban"}
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(config, field, value)
        if field in JSONB_FIELDS:
            flag_modified(config, field)

    await db.flush()
    await db.refresh(config)
    return config


@router.delete("/{nicho}", status_code=204)
async def delete_nicho(
    nicho: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superadmin),
):
    result = await db.execute(select(NichoConfig).where(NichoConfig.nicho == nicho))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(404, f"Nicho '{nicho}' não encontrado")

    await db.delete(config)
