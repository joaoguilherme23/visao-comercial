"""
/llm-logs — visão admin do consumo de tokens e custo das chamadas LLM.

Acesso: SUPERADMIN ONLY (logs.log_llm_usage é dado sensível, transversal a
todos os tenants).

Endpoints:
  GET /llm-logs/summary       — agregações + breakdowns + série diária
  GET /llm-logs/items         — lista paginada detalhada
  GET /llm-logs/filtros       — opções pra dropdowns (modelos/workflows distintos)
"""
from __future__ import annotations

import csv
import io
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, cast
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_superadmin
from app.models.user import User
from app.models.llm_log import LlmUsageLog
from app.models.tenant import Cliente
from app.schemas.llm_logs import (
    LlmLogsSummary,
    LlmLogsItemsPage,
)
from app.services import llm_logs_service

router = APIRouter(prefix="/llm-logs", tags=["llm-logs"])


@router.get("/summary", response_model=LlmLogsSummary)
async def summary(
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    cliente_id: Optional[UUID] = Query(None),
    modelo: Optional[str] = Query(None),
    workflow: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superadmin),
):
    """Cards + breakdowns por modelo/tenant/workflow + série diária."""
    return await llm_logs_service.gerar_summary(
        db,
        data_inicio=data_inicio,
        data_fim=data_fim,
        cliente_id=cliente_id,
        modelo=modelo,
        workflow=workflow,
    )


@router.get("/items", response_model=LlmLogsItemsPage)
async def items(
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    cliente_id: Optional[UUID] = Query(None),
    modelo: Optional[str] = Query(None),
    workflow: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superadmin),
):
    """Listagem paginada com custo calculado por linha."""
    return await llm_logs_service.listar_items(
        db,
        data_inicio=data_inicio,
        data_fim=data_fim,
        cliente_id=cliente_id,
        modelo=modelo,
        workflow=workflow,
        limit=limit,
        offset=offset,
    )


@router.get("/filtros")
async def filtros(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superadmin),
):
    """
    Retorna opções pra popular dropdowns:
      - modelos distintos (com contagem)
      - workflows distintos (com contagem)
      - tenants que aparecem nos logs (com nome)
    """
    # Modelos
    models_q = await db.execute(
        select(LlmUsageLog.model, func.count().label("c"))
        .where(LlmUsageLog.model.isnot(None))
        .group_by(LlmUsageLog.model)
        .order_by(func.count().desc())
    )
    modelos = [{"value": r.model, "count": int(r.c)} for r in models_q.all()]

    # Workflows
    wf_q = await db.execute(
        select(LlmUsageLog.workflow_name, func.count().label("c"))
        .where(LlmUsageLog.workflow_name.isnot(None))
        .group_by(LlmUsageLog.workflow_name)
        .order_by(func.count().desc())
    )
    workflows = [{"value": r.workflow_name, "count": int(r.c)} for r in wf_q.all()]

    # Tenants que aparecem nos logs (cast text -> uuid pra join)
    usuario_uuid = cast(LlmUsageLog.usuario, PG_UUID(as_uuid=True))
    tenants_q = await db.execute(
        select(LlmUsageLog.usuario, Cliente.nome, func.count().label("c"))
        .outerjoin(Cliente, Cliente.id == usuario_uuid)
        .where(LlmUsageLog.usuario.isnot(None))
        .group_by(LlmUsageLog.usuario, Cliente.nome)
        .order_by(func.count().desc())
    )
    tenants = [
        {"cliente_id": str(r.usuario), "nome": r.nome or "(sem nome)", "count": int(r.c)}
        for r in tenants_q.all()
    ]

    return {"modelos": modelos, "workflows": workflows, "tenants": tenants}


@router.get("/export.csv")
async def export_csv(
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    cliente_id: Optional[UUID] = Query(None),
    modelo: Optional[str] = Query(None),
    workflow: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superadmin),
):
    """
    Exporta os logs filtrados em CSV (sem paginação).

    Retorna text/csv com Content-Disposition pra download direto. Inclui custo
    USD/BRL calculado on-the-fly. Útil pra fechar billing mensal.
    """
    # Reusa o service em modo "items todos" — limit alto pra trazer tudo do filtro
    page = await llm_logs_service.listar_items(
        db,
        data_inicio=data_inicio, data_fim=data_fim,
        cliente_id=cliente_id, modelo=modelo, workflow=workflow,
        limit=10_000, offset=0,
    )

    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow([
        "data_hora_utc", "empresa", "workflow", "modelo",
        "prompt_tokens", "completion_tokens", "cached_tokens", "total_tokens",
        "qtd_msg", "cost_usd", "cost_brl", "pricing_missing",
    ])
    for it in page["items"]:
        ts = it["created_at"]
        if isinstance(ts, datetime):
            ts_str = ts.strftime("%Y-%m-%d %H:%M:%S")
        else:
            ts_str = str(ts)
        writer.writerow([
            ts_str,
            it.get("cliente_nome") or "",
            it.get("workflow_name") or "",
            it.get("model") or "",
            it.get("prompt_tokens") or 0,
            it.get("completion_tokens") or 0,
            it.get("cached_tokens") or 0,
            it.get("total_tokens") or 0,
            it.get("qtd_msg") or "",
            it.get("cost_usd") if it.get("cost_usd") is not None else "",
            it.get("cost_brl") if it.get("cost_brl") is not None else "",
            "true" if it.get("pricing_missing") else "false",
        ])

    today = date.today().isoformat()
    filename = f"x9-llm-logs-{today}.csv"
    buf.seek(0)
    return StreamingResponse(
        iter([buf.read()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
