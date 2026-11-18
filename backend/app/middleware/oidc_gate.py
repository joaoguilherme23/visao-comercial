"""Gate de autorização OIDC; rotas novas são negadas até mapeamento explícito."""
import re
from typing import Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services.oidc_bff import (
    GovernanceDenied, GovernanceUnavailable, assert_local_tenant_restriction,
    central_allowed_tenants, central_check, get_application_session, verify_origin_and_csrf,
)

_UUID = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}$")
_TENANT_ROOTS = {"kanban", "dashboard", "feed", "grupos", "agora", "notificacoes"}


def _operation(path: str, method: str) -> tuple[str, str | None] | None:
    parts = [part for part in path.split("/") if part]
    if len(parts) < 3 or parts[:2] != ["api", "v1"]:
        return None
    root, write = parts[2], method in {"POST", "PUT", "PATCH", "DELETE"}
    if root in _TENANT_ROOTS and len(parts) >= 4 and _UUID.match(parts[3]):
        return f"x9.{root}.{'write' if write else 'read'}", parts[3]
    if root in {"tenants", "numeros"} and len(parts) >= 4 and _UUID.match(parts[3]):
        action = "number" if root == "numeros" or (len(parts) >= 5 and parts[4] == "numeros") else "tenant"
        # O contrato da Central nomeia alteração de tenant como manage; number
        # permanece read/write. Não aceitar um escopo alternativo silencioso.
        permission = "manage" if action == "tenant" and write else ("write" if write else "read")
        return f"x9.{action}.{permission}", parts[3]
    if root == "tenants" and len(parts) == 3 and method == "GET":
        return "x9.tenant.list", None
    if root == "users" and parts[3:] == ["me", "tenants"] and method == "GET":
        return "x9.profile.read", None
    if root == "portfolio" and not write:
        return "x9.portfolio.read", None
    if root == "empresas" and len(parts) >= 4 and _UUID.match(parts[3]) and not write:
        return "x9.team.read", parts[3]
    return None


class OidcGovernanceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if settings.DISABLE_EXTERNAL_INTEGRATIONS and (
            path.startswith("/api/v1/webhooks/")
            or (path.startswith("/api/v1/tenants/") and ("/connections" in path or "/numeros" in path))
            or path.startswith("/api/v1/numeros/")
        ):
            return JSONResponse(
                {"detail": "Integração externa desabilitada nesta cópia local"},
                status_code=404,
            )
        if not settings.OIDC_ENABLED:
            return await call_next(request)
        if request.method == "OPTIONS" or path in {"/health", "/openapi.json", "/docs", "/redoc"} or path.startswith("/api/auth/oidc/"):
            return await call_next(request)
        if path.startswith("/avatars/"):
            return JSONResponse({"detail": "Recurso exige sessão"}, status_code=401)
        if path.startswith("/api/v1/auth/"):
            return JSONResponse({"detail": "Autenticação legada desabilitada"}, status_code=410)
        if not path.startswith("/api/v1/"):
            return await call_next(request)
        operation = _operation(path, request.method)
        if operation is None:
            return JSONResponse({"detail": "Rota sem mapeamento de autorização"}, status_code=403)
        action, cliente_id = operation
        try:
            async with AsyncSessionLocal() as db:
                session = await get_application_session(request, db)
                verify_origin_and_csrf(request, session)
                if cliente_id:
                    await assert_local_tenant_restriction(db, session.user_id, cliente_id)
                    allowed = await central_check(session, action, cliente_id)
                else:
                    allowed_tenants = await central_allowed_tenants(session, action)
                    request.state.oidc_allowed_cliente_ids = allowed_tenants
                    allowed = bool(allowed_tenants)
                if not allowed:
                    return JSONResponse({"detail": "Não autorizado"}, status_code=403)
                request.state.oidc_session_id = str(session.id)
                request.state.oidc_user_id = str(session.user_id)
        except GovernanceDenied as exc:
            return JSONResponse({"detail": "Não autorizado"}, status_code=exc.status_code)
        except GovernanceUnavailable:
            return JSONResponse({"detail": "Autorização temporariamente indisponível"}, status_code=503)
        except Exception as exc:
            code = getattr(exc, "status_code", 500)
            return JSONResponse({"detail": getattr(exc, "detail", "Sessão inválida")}, status_code=code if code != 500 else 503)
        return await call_next(request)
