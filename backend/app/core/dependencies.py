from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserTenant, UserRole
from app.core.config import settings
from app.services.oidc_bff import get_application_session

bearer_scheme = HTTPBearer(auto_error=False)

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if settings.OIDC_ENABLED:
        app_session = await get_application_session(request, db)
        result = await db.execute(select(User).where(User.id == app_session.user_id))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise credentials_exception
        return user
    if not credentials:
        raise credentials_exception
    try:
        payload = decode_token(credentials.credentials)
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if not user_id or token_type != "access":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise credentials_exception
    return user

async def get_current_superadmin(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Acesso restrito a superadmins")
    return current_user


async def get_manager_multi_or_superadmin(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Acesso ao portfolio multi-empresa: liberado pra superadmin OU usuário
    com flag is_manager_multi=True. Demais retornam 403.
    """
    if current_user.is_superadmin or current_user.is_manager_multi:
        return current_user
    raise HTTPException(
        status_code=403,
        detail="Acesso ao portfolio restrito a gestores multi-empresa",
    )


def require_admin_in_tenant():
    """
    Dependency que valida que o usuário pode ADMINISTRAR a empresa
    (gerenciar consultores, números, KPIs custom). Liberado pra:

    1. Superadmin (sempre)
    2. Manager_multi com UserTenant.role=admin ATIVO naquela empresa

    NÃO libera pra usuário comum com role=admin no tenant — esse cenário
    é coberto por require_tenant_role(UserRole.admin), que é mais permissivo.
    A diferença: aqui exigimos a combinação (manager_multi + admin) pra
    isolar quem é "dono da empresa" vs quem só recebeu role admin pontual.
    """
    async def _checker(
        cliente_id: str,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        if current_user.is_superadmin and not settings.OIDC_ENABLED:
            return current_user
        if not current_user.is_manager_multi:
            raise HTTPException(
                status_code=403,
                detail="Apenas gestor multi-empresa ou superadmin pode administrar a empresa",
            )
        result = await db.execute(
            select(UserTenant).where(
                UserTenant.user_id == current_user.id,
                UserTenant.cliente_id == UUID(cliente_id),
                UserTenant.is_active == True,
                UserTenant.role == UserRole.admin,
            )
        )
        ut = result.scalar_one_or_none()
        if not ut:
            raise HTTPException(
                status_code=403,
                detail="Você não administra esta empresa",
            )
        return current_user
    return _checker

def require_tenant_role(*roles: UserRole):
    async def _checker(
        cliente_id: str,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> UserTenant:
        if current_user.is_superadmin and not settings.OIDC_ENABLED:
            return None  # superadmin bypasses tenant check

        result = await db.execute(
            select(UserTenant).where(
                UserTenant.user_id == current_user.id,
                UserTenant.cliente_id == UUID(cliente_id),
                UserTenant.is_active == True,
            )
        )
        ut = result.scalar_one_or_none()
        if not ut:
            raise HTTPException(status_code=403, detail="Sem acesso a este tenant")
        if roles and ut.role not in roles:
            raise HTTPException(status_code=403, detail="Permissão insuficiente")
        return ut
    return _checker

async def get_user_tenant_access(
    cliente_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Optional[UserTenant]:
    """Returns UserTenant or None for superadmin."""
    if current_user.is_superadmin and not settings.OIDC_ENABLED:
        return None
    result = await db.execute(
        select(UserTenant).where(
            UserTenant.user_id == current_user.id,
            UserTenant.cliente_id == UUID(cliente_id),
            UserTenant.is_active == True,
        )
    )
    ut = result.scalar_one_or_none()
    if not ut:
        raise HTTPException(status_code=403, detail="Sem acesso a este tenant")
    return ut
