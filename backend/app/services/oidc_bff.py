"""BFF OIDC: PKCE, sessão opaca e governança Central com falha fechada."""
import base64
import hashlib
import math
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx
from asyncpg.exceptions import TooManyConnectionsError
from fastapi import HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.redis_client import get_redis
from app.models.oidc import OidcApplicationSession, OidcIdentityLink, OidcLoginTransaction
from app.models.user import User, UserTenant

_DISCOVERY: dict[str, Any] | None = None
_JWKS: dict[str, Any] | None = None
_CLOCK_SKEW_SECONDS = 60
_LOGIN_TTL = timedelta(minutes=10)


class GovernanceUnavailable(Exception):
    pass


class GovernanceDenied(Exception):
    def __init__(self, status_code: int) -> None:
        self.status_code = status_code


class OidcValidationError(Exception):
    pass


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def session_ttl_seconds(expires_at: datetime) -> int:
    remaining = math.ceil((expires_at - _utcnow()).total_seconds())
    if remaining <= 0:
        raise OidcValidationError("Sessão OIDC já expirou")
    return remaining


def _registered_expires_at(value: Any, requested: datetime) -> datetime:
    if not isinstance(value, str):
        raise OidcValidationError("Central não devolveu expiração de sessão")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError
        expires_at = parsed.astimezone(timezone.utc)
        if not math.isfinite(expires_at.timestamp()):
            raise ValueError
    except (OverflowError, ValueError) as exc:
        raise OidcValidationError("Expiração de sessão Central inválida") from exc
    if expires_at <= _utcnow() or expires_at > requested:
        raise OidcValidationError("Expiração de sessão Central fora do limite")
    return min(requested, expires_at)


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _pkce_challenge(verifier: str) -> str:
    return _b64url(hashlib.sha256(verifier.encode("ascii")).digest())


def _unauthorized(detail: str = "Sessão inválida") -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def _unavailable() -> HTTPException:
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Autorização temporariamente indisponível")


async def _discovery() -> dict[str, Any]:
    global _DISCOVERY
    if _DISCOVERY:
        return _DISCOVERY
    issuer = settings.OIDC_ISSUER.rstrip("/")
    if not issuer:
        raise OidcValidationError("OIDC_ISSUER não configurado")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{issuer}/.well-known/openid-configuration")
            response.raise_for_status()
            metadata = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise OidcValidationError("Descoberta OIDC indisponível") from exc
    if metadata.get("issuer") != issuer or not all(metadata.get(k) for k in ("authorization_endpoint", "token_endpoint", "jwks_uri")):
        raise OidcValidationError("Metadados OIDC inválidos")
    _DISCOVERY = metadata
    return metadata


async def _jwks() -> dict[str, Any]:
    global _JWKS
    if _JWKS:
        return _JWKS
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get((await _discovery())["jwks_uri"])
            response.raise_for_status()
            keys = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise OidcValidationError("JWKS OIDC indisponível") from exc
    if not isinstance(keys.get("keys"), list):
        raise OidcValidationError("JWKS OIDC inválido")
    _JWKS = keys
    return keys


async def start_login(db: AsyncSession, return_to: str) -> tuple[str, str]:
    if not return_to.startswith("/") or return_to.startswith("//"):
        return_to = "/"
    state, binding = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    verifier, nonce = secrets.token_urlsafe(64), secrets.token_urlsafe(32)
    db.add(OidcLoginTransaction(
        state_hash=_digest(state), browser_binding_hash=_digest(binding), nonce=nonce,
        code_verifier=verifier, return_to=return_to, expires_at=_utcnow() + _LOGIN_TTL,
    ))
    try:
        await db.flush()
    except (SQLAlchemyError, TooManyConnectionsError) as exc:
        raise GovernanceUnavailable("Banco de sessão indisponível") from exc
    metadata = await _discovery()
    params = {
        "response_type": "code", "client_id": settings.OIDC_CLIENT_ID,
        "redirect_uri": settings.OIDC_REDIRECT_URI, "scope": "openid", "state": state,
        "nonce": nonce, "code_challenge": _pkce_challenge(verifier),
        "code_challenge_method": "S256", "max_age": str(settings.OIDC_SESSION_TTL_SECONDS),
    }
    return f"{metadata['authorization_endpoint']}?{urlencode(params)}", binding


async def _exchange_and_validate(code: str, tx: OidcLoginTransaction) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post((await _discovery())["token_endpoint"], data={
                "grant_type": "authorization_code", "code": code, "redirect_uri": settings.OIDC_REDIRECT_URI,
                "client_id": settings.OIDC_CLIENT_ID, "client_secret": settings.oidc_client_secret,
                "code_verifier": tx.code_verifier,
            }, headers={"Accept": "application/json"})
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise OidcValidationError("Troca de código OIDC falhou") from exc
    id_token, access_token = payload.get("id_token"), payload.get("access_token")
    if not isinstance(id_token, str) or (access_token is not None and not isinstance(access_token, str)):
        raise OidcValidationError("Resposta OIDC inválida")
    try:
        header = jwt.get_unverified_header(id_token)
        algorithm, kid = header.get("alg"), header.get("kid")
        if algorithm not in {"RS256", "RS384", "RS512", "ES256", "ES384", "ES512"}:
            raise OidcValidationError("Algoritmo OIDC não permitido")
        keys = (await _jwks())["keys"]
        jwk = next((item for item in keys if item.get("kid") == kid), None)
        if not jwk:
            global _JWKS
            _JWKS = None
            jwk = next((item for item in (await _jwks())["keys"] if item.get("kid") == kid), None)
        if not jwk:
            raise OidcValidationError("Chave OIDC desconhecida")
        claims = jwt.decode(id_token, jwk, algorithms=[algorithm], audience=settings.OIDC_CLIENT_ID,
                            issuer=settings.OIDC_ISSUER.rstrip("/"), access_token=access_token,
                            options={"leeway": _CLOCK_SKEW_SECONDS})
    except (JWTError, ValueError) as exc:
        raise OidcValidationError("id_token OIDC inválido") from exc
    now, auth_time = _utcnow().timestamp(), claims.get("auth_time")
    if (claims.get("nonce") != tx.nonce or not isinstance(claims.get("sub"), str)
            or claims.get("azp") != settings.OIDC_CLIENT_ID or isinstance(auth_time, bool)
            or not isinstance(auth_time, (int, float)) or auth_time > now + _CLOCK_SKEW_SECONDS
            or now - auth_time > settings.OIDC_SESSION_TTL_SECONDS + _CLOCK_SKEW_SECONDS):
        raise OidcValidationError("Claims OIDC inválidas ou expiradas")
    return claims


async def complete_login(db: AsyncSession, state: str, binding: str, code: str) -> tuple[OidcApplicationSession, User, str, str]:
    result = await db.execute(select(OidcLoginTransaction).where(OidcLoginTransaction.state_hash == _digest(state)).with_for_update())
    tx = result.scalar_one_or_none()
    if not tx or tx.consumed_at or tx.expires_at < _utcnow() or not secrets.compare_digest(tx.browser_binding_hash, _digest(binding)):
        raise OidcValidationError("Transação OIDC inválida")
    tx.consumed_at = _utcnow()
    await db.commit()
    claims = await _exchange_and_validate(code, tx)
    now = _utcnow()
    # Limita clock future-skew: o prazo nunca pode começar após o callback.
    auth_time = min(claims["auth_time"], int(now.timestamp()))
    claims = {**claims, "auth_time": auth_time}
    requested_expires_at = datetime.fromtimestamp(
        auth_time + settings.OIDC_SESSION_TTL_SECONDS,
        tz=timezone.utc,
    )
    session_ttl_seconds(requested_expires_at)
    registered = await register_central_session(claims, str(uuid.uuid4()), requested_expires_at)
    local_user_id, session_ref = registered.get("localUserId"), registered.get("sessionRef")
    if not isinstance(local_user_id, str) or not isinstance(session_ref, str):
        raise OidcValidationError("Central não devolveu vínculo de usuário")
    expires_at = _registered_expires_at(registered.get("expiresAt"), requested_expires_at)
    contexts = await central_contexts(session_ref)
    if not isinstance(contexts.get("contexts"), list):
        raise OidcValidationError("Contexts da Central inválidos")
    link = (await db.execute(select(OidcIdentityLink).where(
        OidcIdentityLink.issuer == settings.OIDC_ISSUER.rstrip("/"), OidcIdentityLink.subject == claims["sub"],
        OidcIdentityLink.central_local_user_id == local_user_id, OidcIdentityLink.is_active == True,
    ))).scalar_one_or_none()
    if not link:
        raise OidcValidationError("Vínculo local OIDC inexistente ou inativo")
    user = (await db.execute(select(User).where(User.id == link.user_id, User.is_active == True))).scalar_one_or_none()
    if not user:
        raise OidcValidationError("Usuário local OIDC indisponível")
    opaque_token = secrets.token_urlsafe(48)
    app_session = OidcApplicationSession(token_hash=_digest(opaque_token), csrf_secret=secrets.token_urlsafe(32),
        user_id=user.id, central_local_user_id=local_user_id, session_ref=session_ref, expires_at=expires_at)
    db.add(app_session)
    await db.flush()
    try:
        await _put_session_cache(app_session)
    except GovernanceUnavailable:
        try:
            await central_revoke(app_session)
        except GovernanceUnavailable:
            pass
        raise
    return app_session, user, opaque_token, tx.return_to


async def _put_session_cache(app_session: OidcApplicationSession) -> None:
    try:
        await get_redis().setex(
            f"x9:oidc:session:{app_session.token_hash}",
            session_ttl_seconds(app_session.expires_at),
            str(app_session.id),
        )
    except Exception as exc:
        raise GovernanceUnavailable("Redis de sessão indisponível") from exc


async def get_application_session(request: Request, db: AsyncSession) -> OidcApplicationSession:
    raw = request.cookies.get("x9_oidc_session")
    if not raw:
        raise _unauthorized()
    token_hash = _digest(raw)
    try:
        cached = await get_redis().get(f"x9:oidc:session:{token_hash}")
    except Exception as exc:
        raise _unavailable() from exc
    if not cached:
        raise _unauthorized()
    try:
        session = (await db.execute(
            select(OidcApplicationSession).where(OidcApplicationSession.token_hash == token_hash)
        )).scalar_one_or_none()
    except (SQLAlchemyError, TooManyConnectionsError) as exc:
        raise _unavailable() from exc
    if not session or session.revoked_at or session.expires_at < _utcnow() or str(session.id) != cached:
        raise _unauthorized()
    return session


async def revoke_application_session(app_session: OidcApplicationSession) -> None:
    app_session.revoked_at = _utcnow()
    try:
        await get_redis().delete(f"x9:oidc:session:{app_session.token_hash}")
    except Exception:
        pass


async def _m2m_token() -> str:
    if not settings.central_m2m_client_secret:
        raise GovernanceUnavailable("Secret M2M ausente")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post((await _discovery())["token_endpoint"], data={
                "grant_type": "client_credentials", "client_id": settings.CENTRAL_M2M_CLIENT_ID,
                "client_secret": settings.central_m2m_client_secret, "audience": settings.CENTRAL_M2M_AUDIENCE,
                "scope": settings.CENTRAL_M2M_SCOPE,
            })
            response.raise_for_status()
            token = response.json().get("access_token")
    except (httpx.HTTPError, ValueError) as exc:
        raise GovernanceUnavailable("Credencial M2M indisponível") from exc
    if not isinstance(token, str):
        raise GovernanceUnavailable("Resposta M2M inválida")
    return token


async def _central_post(path: str, payload: dict[str, Any], *, headers: dict[str, str] | None = None) -> dict[str, Any]:
    if not settings.CENTRAL_BASE_URL:
        raise GovernanceUnavailable("Central não configurada")
    try:
        request_headers = {"Authorization": f"Bearer {await _m2m_token()}", "Content-Type": "application/json"}
        if headers:
            request_headers.update(headers)
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(f"{settings.CENTRAL_BASE_URL.rstrip('/')}{path}", json=payload, headers=request_headers)
            response.raise_for_status()
            data = response.json() if response.content else {}
        if not isinstance(data, dict):
            raise ValueError("JSON não é objeto")
        return data
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in {401, 403}:
            raise GovernanceDenied(exc.response.status_code) from exc
        raise GovernanceUnavailable("Central indisponível") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise GovernanceUnavailable("Central indisponível") from exc


async def register_central_session(claims: dict[str, Any], callback_id: str, expires_at: datetime) -> dict[str, Any]:
    auth_time, issued_at, token_expires_at, sid = (claims.get(k) for k in ("auth_time", "iat", "exp", "sid"))
    if not all(type(value) is int and value >= 0 for value in (auth_time, issued_at, token_expires_at)) or not isinstance(sid, str) or not sid:
        raise OidcValidationError("Claims obrigatórias para registro central ausentes")
    return await _central_post("/api/integrations/v1/sessions", {
        "callbackId": callback_id, "authentication": {"issuer": settings.OIDC_ISSUER.rstrip("/"), "subject": claims["sub"],
        "oidcClientId": settings.OIDC_CLIENT_ID, "sid": sid, "authTime": auth_time,
        "idTokenIssuedAt": issued_at, "idTokenExpiresAt": token_expires_at}, "localExpiresAt": expires_at.isoformat(),
    }, headers={"Idempotency-Key": secrets.token_urlsafe(24)})


async def central_contexts(session_ref: str) -> dict[str, Any]:
    contexts: list[dict[str, Any]] = []
    cursor: str | None = None
    seen: set[str] = set()
    for _ in range(settings.CENTRAL_CONTEXTS_MAX_PAGES):
        payload: dict[str, Any] = {"sessionRef": session_ref, "limit": 100}
        if cursor:
            payload["cursor"] = cursor
        page = await _central_post("/api/integrations/v1/contexts", payload)
        page_contexts, next_cursor = page.get("contexts"), page.get("nextCursor")
        if not isinstance(page_contexts, list) or (next_cursor is not None and not isinstance(next_cursor, str)):
            raise GovernanceUnavailable("Contexts da Central inválidos")
        contexts.extend(page_contexts)
        if next_cursor is None:
            return {"contexts": contexts, "nextCursor": None}
        if next_cursor in seen:
            raise GovernanceUnavailable("Paginação de contexts repetiu cursor")
        seen.add(next_cursor)
        cursor = next_cursor
    raise GovernanceUnavailable("Contexts excederam limite de páginas")


def organization_for_tenant(contexts: dict[str, Any], cliente_id: str) -> str:
    candidates = [item.get("organizationId") for item in contexts.get("contexts", []) if isinstance(item, dict)
        and isinstance(item.get("organizationId"), str) and any(isinstance(tenant, dict)
        and tenant.get("namespace") == "cliente_id" and tenant.get("id") == cliente_id
        for tenant in item.get("localTenants", []))]
    if len(candidates) != 1:
        raise GovernanceUnavailable("Tenant sem contexto Central unívoco")
    return candidates[0]


async def _central_check_for_tenant(session_ref: str, action: str, organization_id: str, cliente_id: str) -> bool:
    result = await _central_post("/api/integrations/v1/authorization/check", {
        "sessionRef": session_ref, "organizationId": organization_id,
        "localTenant": {"namespace": "cliente_id", "id": cliente_id}, "actions": [action],
    })
    return result.get("allowed") is True


async def central_check(app_session: OidcApplicationSession, action: str, cliente_id: str | None) -> bool:
    if not cliente_id:
        return False
    return await _central_check_for_tenant(app_session.session_ref, action,
        organization_for_tenant(await central_contexts(app_session.session_ref), cliente_id), cliente_id)


async def central_allowed_tenants(app_session: OidcApplicationSession, action: str) -> set[str]:
    organizations: dict[str, str] = {}
    for item in (await central_contexts(app_session.session_ref)).get("contexts", []):
        if not isinstance(item, dict) or not isinstance(item.get("organizationId"), str) or not isinstance(item.get("localTenants"), list):
            raise GovernanceUnavailable("Contexts da Central inválidos")
        for tenant in item["localTenants"]:
            if isinstance(tenant, dict) and tenant.get("namespace") == "cliente_id" and isinstance(tenant.get("id"), str):
                old = organizations.setdefault(tenant["id"], item["organizationId"])
                if old != item["organizationId"]:
                    raise GovernanceUnavailable("Tenant em organizações ambíguas")
    allowed: set[str] = set()
    for cliente_id, organization_id in organizations.items():
        if await _central_check_for_tenant(app_session.session_ref, action, organization_id, cliente_id):
            allowed.add(cliente_id)
    return allowed


async def central_revoke(app_session: OidcApplicationSession) -> None:
    await _central_post(f"/api/integrations/v1/sessions/{app_session.session_ref}/revoke", {})


async def assert_local_tenant_restriction(db: AsyncSession, user_id: Any, cliente_id: str) -> None:
    result = await db.execute(select(UserTenant.id).where(UserTenant.user_id == user_id,
        UserTenant.cliente_id == cliente_id, UserTenant.is_active == True))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Sem acesso local ao tenant")


def verify_origin_and_csrf(request: Request, app_session: OidcApplicationSession) -> None:
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    verify_trusted_origin(request)
    token = request.headers.get("x-csrf-token")
    if not token or not secrets.compare_digest(token, app_session.csrf_secret):
        raise HTTPException(status_code=403, detail="CSRF inválido")


def verify_trusted_origin(request: Request) -> None:
    if request.headers.get("origin") != settings.FRONTEND_URL.rstrip("/"):
        raise HTTPException(status_code=403, detail="Origin inválida")
