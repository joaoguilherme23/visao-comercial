"""
/portfolio — visão agregada das N empresas que um gestor multi-empresa tem
acesso. Reservada pra superadmin OU usuário com is_manager_multi=True.

Endpoints:
  GET /portfolio/empresas         → lista compacta com mini-stats
  GET /portfolio/kpis-agregados   → 4 KPIs do subset (somatório + por-empresa)
  GET /portfolio/leads-quentes    → top N leads por score, de todas as empresas
"""
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_manager_multi_or_superadmin
from app.models.user import User
from app.schemas.portfolio import (
    EmpresaPortfolioOut,
    KpisAgregadosOut,
    LeadQuenteOut,
)
from app.services import portfolio_service

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("/empresas", response_model=list[EmpresaPortfolioOut])
async def listar_empresas(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_manager_multi_or_superadmin),
):
    """Lista compacta das empresas do gestor com mini-stats por empresa."""
    return await portfolio_service.listar_empresas(db, current_user, getattr(request.state, "oidc_allowed_cliente_ids", None))


@router.get("/kpis-agregados", response_model=KpisAgregadosOut)
async def kpis_agregados(
    request: Request,
    date_from: Optional[date] = Query(None, alias="data_inicio"),
    date_to: Optional[date] = Query(None, alias="data_fim"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_manager_multi_or_superadmin),
):
    """
    KPIs agregados (subset do portfolio: novos_leads, oportunidades,
    urgência alta, tempo 1ª resposta) com somatório/média entre as N
    empresas do gestor + breakdown por empresa.
    """
    return await portfolio_service.kpis_agregados(db, current_user, date_from, date_to, getattr(request.state, "oidc_allowed_cliente_ids", None))


@router.get("/leads-quentes", response_model=list[LeadQuenteOut])
async def leads_quentes(
    request: Request,
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_manager_multi_or_superadmin),
):
    """Top N leads por score (desc) de TODAS as empresas do gestor."""
    return await portfolio_service.top_leads_quentes(db, current_user, limit, getattr(request.state, "oidc_allowed_cliente_ids", None))
