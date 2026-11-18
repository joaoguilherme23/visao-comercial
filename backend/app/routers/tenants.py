from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy import select, func, delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_superadmin, get_user_tenant_access
from app.core.config import settings
from app.models.user import User, UserTenant, UserRole
from app.models.tenant import Cliente, TenantConnection
from app.models.lead import Lead
from app.schemas.tenant import (
    ClienteCreate, ClienteUpdate, ClienteOut, ClienteDetailOut,
    ClienteDadosCadastraisUpdate,
    TenantConnectionCreate, TenantConnectionUpdate, TenantConnectionOut,
)
from app.services import tenant_avatar

router = APIRouter(prefix="/tenants", tags=["tenants"])

@router.get("", response_model=List[ClienteOut])
async def list_tenants(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.is_superadmin and not settings.OIDC_ENABLED:
        result = await db.execute(select(Cliente).order_by(Cliente.nome))
        return result.scalars().all()
    # Return only tenants where user has access
    query = (
        select(Cliente)
        .join(UserTenant, UserTenant.cliente_id == Cliente.id)
        .where(UserTenant.user_id == current_user.id, UserTenant.is_active == True)
        .order_by(Cliente.nome)
    )
    if settings.OIDC_ENABLED:
        query = query.where(Cliente.id.in_(getattr(request.state, "oidc_allowed_cliente_ids", set())))
    result = await db.execute(query)
    return result.scalars().all()

@router.post("", response_model=ClienteDetailOut, status_code=201)
async def create_tenant(
    body: ClienteCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superadmin),
):
    existing = await db.execute(select(Cliente).where(Cliente.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slug já existe")
    tenant = Cliente(**body.model_dump())
    db.add(tenant)
    await db.flush()
    await db.commit()
    await db.refresh(tenant)
    return tenant

@router.get("/{cliente_id}", response_model=ClienteDetailOut)
async def get_tenant(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")
    return tenant

@router.patch("/{cliente_id}", response_model=ClienteDetailOut)
async def update_tenant(
    cliente_id: UUID,
    body: ClienteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_superadmin:
        ut = await get_user_tenant_access(str(cliente_id), current_user, db)
        if not ut or ut.role not in [UserRole.admin]:
            raise HTTPException(status_code=403, detail="Apenas admins podem editar tenant")
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Não encontrado")
    payload = body.model_dump(exclude_unset=True)
    # Contatos: lista de Contato → lista de dict (pra JSONB)
    if "contatos" in payload and payload["contatos"] is not None:
        payload["contatos"] = [c if isinstance(c, dict) else c.model_dump() for c in payload["contatos"]]
    for field, val in payload.items():
        setattr(tenant, field, val)
    await db.flush()
    await db.commit()
    await db.refresh(tenant)
    return tenant

@router.delete("/{cliente_id}", status_code=204)
async def delete_tenant(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superadmin),
):
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Não encontrado")
    # Guard: block deletion if tenant has leads (to avoid orphaned data)
    lead_count = await db.execute(
        select(func.count()).select_from(Lead).where(Lead.cliente_id == cliente_id)
    )
    if (lead_count.scalar() or 0) > 0:
        raise HTTPException(
            status_code=400,
            detail="Não é possível remover tenant com leads. Desative-o (ativo=false) ou remova os leads primeiro.",
        )
    # Remove related user-tenant assignments and connections first
    await db.execute(sql_delete(UserTenant).where(UserTenant.cliente_id == cliente_id))
    await db.execute(sql_delete(TenantConnection).where(TenantConnection.cliente_id == cliente_id))
    await db.delete(tenant)
    await db.commit()

# --- Tenant Users ---
@router.get("/{cliente_id}/users")
async def list_tenant_users(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_superadmin:
        ut = await get_user_tenant_access(str(cliente_id), current_user, db)
        if not ut or ut.role not in [UserRole.admin, UserRole.manager]:
            raise HTTPException(status_code=403, detail="Sem permissão")
    result = await db.execute(
        select(UserTenant)
        .options(selectinload(UserTenant.user))
        .where(UserTenant.cliente_id == cliente_id)
    )
    uts = result.scalars().all()
    return [
        {
            "id": str(ut.id),
            "user_id": str(ut.user_id),
            "email": ut.user.email,
            "nome": ut.user.nome,
            "role": ut.role,
            "is_active": ut.is_active,
        }
        for ut in uts
    ]

# --- Connections ---
@router.get("/{cliente_id}/connections", response_model=List[TenantConnectionOut])
async def list_connections(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_user_tenant_access),
):
    result = await db.execute(
        select(TenantConnection).where(TenantConnection.cliente_id == cliente_id)
    )
    return result.scalars().all()

@router.post("/{cliente_id}/connections", response_model=TenantConnectionOut, status_code=201)
async def create_connection(
    cliente_id: UUID,
    body: TenantConnectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_superadmin:
        ut = await get_user_tenant_access(str(cliente_id), current_user, db)
        if not ut or ut.role not in [UserRole.admin]:
            raise HTTPException(status_code=403, detail="Sem permissão")
    conn = TenantConnection(cliente_id=cliente_id, **body.model_dump())
    db.add(conn)
    await db.flush()
    await db.commit()
    await db.refresh(conn)
    return conn

@router.patch("/{cliente_id}/connections/{conn_id}", response_model=TenantConnectionOut)
async def update_connection(
    cliente_id: UUID,
    conn_id: UUID,
    body: TenantConnectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_superadmin:
        ut = await get_user_tenant_access(str(cliente_id), current_user, db)
        if not ut or ut.role not in [UserRole.admin]:
            raise HTTPException(status_code=403, detail="Sem permissão")
    result = await db.execute(
        select(TenantConnection).where(
            TenantConnection.id == conn_id,
            TenantConnection.cliente_id == cliente_id,
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Conexão não encontrada")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(conn, field, val)
    conn.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.commit()
    await db.refresh(conn)
    return conn

@router.delete("/{cliente_id}/connections/{conn_id}", status_code=204)
async def delete_connection(
    cliente_id: UUID,
    conn_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # BUG-06: admin do tenant pode deletar suas próprias conexões (antes só superadmin podia)
    if not current_user.is_superadmin:
        ut = await get_user_tenant_access(str(cliente_id), current_user, db)
        if not ut or ut.role not in [UserRole.admin]:
            raise HTTPException(status_code=403, detail="Sem permissão para remover conexões")
    result = await db.execute(
        select(TenantConnection).where(
            TenantConnection.id == conn_id,
            TenantConnection.cliente_id == cliente_id,
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Não encontrado")
    await db.delete(conn)
    await db.commit()


# ── Avatar / logo da empresa ────────────────────────────────────────────────

@router.post("/{cliente_id}/avatar", response_model=ClienteDetailOut)
async def upload_avatar(
    cliente_id: UUID,
    file: UploadFile = File(..., description="JPG/PNG/WEBP, máx 5MB"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload manual da logo da empresa.

    Permissões: superadmin OU admin do tenant (quem está logado dentro da empresa).
    """
    if not current_user.is_superadmin:
        ut = await get_user_tenant_access(str(cliente_id), current_user, db)
        if not ut or ut.role != UserRole.admin:
            raise HTTPException(status_code=403, detail="Apenas admins podem alterar a logo")

    await tenant_avatar.upload_tenant_avatar(db, cliente_id, file)
    await db.commit()
    # Recarrega o cliente com foto_url atualizada
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    return result.scalar_one()


@router.delete("/{cliente_id}/avatar", response_model=ClienteDetailOut)
async def delete_avatar(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a logo do cliente (foto_url = NULL)."""
    if not current_user.is_superadmin:
        ut = await get_user_tenant_access(str(cliente_id), current_user, db)
        if not ut or ut.role != UserRole.admin:
            raise HTTPException(status_code=403, detail="Apenas admins podem remover a logo")

    await tenant_avatar.delete_tenant_avatar(db, cliente_id)
    await db.commit()
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    return result.scalar_one()


# ── Endpoint específico do admin do cliente (subset) ────────────────────────
# Espelha PATCH /tenants/{id} mas usa schema restrito (sem slug/plano/budget/ativo).
# Idêntico ao PATCH /tenants/{id} pra superadmin — apenas o schema validado é diferente.

@router.patch("/{cliente_id}/dados-cadastrais", response_model=ClienteDetailOut)
async def update_dados_cadastrais(
    cliente_id: UUID,
    body: ClienteDadosCadastraisUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza dados cadastrais da empresa.

    Permissões: superadmin OU admin do tenant. NÃO permite alterar slug,
    plano, budget_brl_diario, ativo (esses ficam só em PATCH /tenants/{id}
    pelo superadmin).
    """
    if not current_user.is_superadmin:
        ut = await get_user_tenant_access(str(cliente_id), current_user, db)
        if not ut or ut.role != UserRole.admin:
            raise HTTPException(status_code=403, detail="Apenas admins podem editar dados cadastrais")

    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    payload = body.model_dump(exclude_unset=True)
    # Contatos: lista de Contato → lista de dict (pra JSONB)
    if "contatos" in payload and payload["contatos"] is not None:
        payload["contatos"] = [c if isinstance(c, dict) else c.model_dump() for c in payload["contatos"]]

    for field, val in payload.items():
        setattr(tenant, field, val)

    await db.flush()
    await db.commit()
    await db.refresh(tenant)
    return tenant
