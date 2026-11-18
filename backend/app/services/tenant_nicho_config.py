"""Resolution and persistence of per-tenant niche field overrides."""
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.nicho import NichoConfig
from app.models.tenant_nicho_config import TenantNichoConfig


async def get_effective_nicho_fields(
    db: AsyncSession, cliente_id: UUID, nicho: str
) -> dict[str, Any] | None:
    """Use a tenant override when present; otherwise fall back to the global template."""
    override_result = await db.execute(
        select(TenantNichoConfig).where(
            TenantNichoConfig.cliente_id == cliente_id,
            TenantNichoConfig.nicho == nicho,
        )
    )
    override = override_result.scalar_one_or_none()

    template_result = await db.execute(
        select(NichoConfig).where(NichoConfig.nicho == nicho, NichoConfig.ativo.is_(True))
    )
    template = template_result.scalar_one_or_none()
    if template is None:
        return None

    return {
        "nicho": nicho,
        # These fields form part of the prompt contract. Field overrides stay
        # tenant-scoped; editorial instructions remain on the template.
        "label": template.label,
        "prompt_base": template.prompt_base,
        "campos_kpi": override.campos_kpi if override is not None else template.campos_kpi,
        "campos_analise": (
            override.campos_analise if override is not None else template.campos_analise
        ),
    }


async def save_tenant_nicho_fields(
    db: AsyncSession,
    cliente_id: UUID,
    nicho: str,
    campos_kpi: list[dict[str, Any]],
    campos_analise: list[dict[str, Any]],
    updated_by: UUID,
) -> None:
    """Atomically insert or update only this tenant's configuration row."""
    stmt = pg_insert(TenantNichoConfig).values(
        cliente_id=cliente_id,
        nicho=nicho,
        campos_kpi=campos_kpi,
        campos_analise=campos_analise,
        updated_by=updated_by,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[TenantNichoConfig.cliente_id, TenantNichoConfig.nicho],
        set_={
            "campos_kpi": stmt.excluded.campos_kpi,
            "campos_analise": stmt.excluded.campos_analise,
            "updated_by": stmt.excluded.updated_by,
            "updated_at": stmt.excluded.updated_at,
        },
    )
    await db.execute(stmt)
    await db.flush()
