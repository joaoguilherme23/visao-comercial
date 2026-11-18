"""Rotas BFF OIDC; os tokens do IdP nunca são devolvidos ao browser."""
import logging

from asyncpg.exceptions import TooManyConnectionsError
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import UserOut
from app.services.oidc_bff import (
    GovernanceDenied, GovernanceUnavailable, OidcValidationError, central_contexts,
    central_revoke, complete_login, get_application_session, revoke_application_session,
    session_ttl_seconds, start_login, verify_origin_and_csrf, verify_trusted_origin,
)

router = APIRouter(prefix="/api/auth/oidc", tags=["oidc-auth"])
_TX_COOKIE = "x9_oidc_tx"
_SESSION_COOKIE = "x9_oidc_session"
logger = logging.getLogger(__name__)


def _set_cookie(response: Response, name: str, value: str, max_age: int) -> None:
    response.set_cookie(key=name, value=value, max_age=max_age, httponly=True,
                        secure=settings.OIDC_COOKIE_SECURE, samesite="lax", path="/")


def _clear_cookie(response: Response, name: str) -> None:
    response.delete_cookie(key=name, path="/", secure=settings.OIDC_COOKIE_SECURE,
                           httponly=True, samesite="lax")


def _enabled() -> None:
    if not settings.OIDC_ENABLED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OIDC desabilitado")


@router.get("/login", status_code=status.HTTP_307_TEMPORARY_REDIRECT)
async def login(request: Request, db: AsyncSession = Depends(get_db)) -> RedirectResponse:
    _enabled()
    try:
        target, binding = await start_login(db, request.query_params.get("return_to", "/"))
    except (GovernanceUnavailable, OidcValidationError) as exc:
        raise HTTPException(status_code=503, detail="Login OIDC indisponível") from exc
    response = RedirectResponse(url=target, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
    _set_cookie(response, _TX_COOKIE, binding, 600)
    return response


@router.get("/callback")
async def callback(request: Request, code: str | None = None, state: str | None = None,
                   db: AsyncSession = Depends(get_db)) -> RedirectResponse:
    _enabled()
    binding = request.cookies.get(_TX_COOKIE)
    if not code or not state or not binding:
        raise HTTPException(status_code=401, detail="Retorno OIDC inválido")
    try:
        app_session, _, opaque_token, return_to = await complete_login(db, state, binding, code)
        response = RedirectResponse(url=settings.FRONTEND_URL.rstrip("/") + return_to,
                                    status_code=status.HTTP_303_SEE_OTHER)
        _set_cookie(response, _SESSION_COOKIE, opaque_token, session_ttl_seconds(app_session.expires_at))
        _clear_cookie(response, _TX_COOKIE)
        return response
    except GovernanceUnavailable as exc:
        raise HTTPException(status_code=503, detail="Autorização temporariamente indisponível") from exc
    except (SQLAlchemyError, TooManyConnectionsError) as exc:
        raise HTTPException(status_code=503, detail="Autorização temporariamente indisponível") from exc
    except OidcValidationError as exc:
        logger.warning("oidc_callback_validation_rejected reason=%s", str(exc))
        raise HTTPException(status_code=401, detail="Retorno OIDC inválido") from exc


@router.get("/session", response_model=UserOut)
async def session(request: Request, db: AsyncSession = Depends(get_db)) -> JSONResponse:
    _enabled()
    app_session = await get_application_session(request, db)
    try:
        await central_contexts(app_session.session_ref)
    except GovernanceDenied as exc:
        raise HTTPException(status_code=exc.status_code, detail="Sessão não autorizada pela Central") from exc
    except GovernanceUnavailable as exc:
        raise HTTPException(status_code=503, detail="Autorização temporariamente indisponível") from exc
    user = (await db.execute(select(User).where(User.id == app_session.user_id, User.is_active == True))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Sessão inválida")
    return JSONResponse(content=UserOut.model_validate(user).model_dump(mode="json"),
        headers={"X-CSRF-Token": app_session.csrf_secret, "Access-Control-Expose-Headers": "X-CSRF-Token"})


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, db: AsyncSession = Depends(get_db)) -> Response:
    _enabled()
    try:
        app_session = await get_application_session(request, db)
    except HTTPException as exc:
        if exc.status_code != status.HTTP_401_UNAUTHORIZED:
            raise
        # A sessão pode vencer enquanto a SPA ainda mostra o usuário. Sem
        # segredo CSRF recuperável, a limpeza só ocorre para a origem exata.
        # Não há revogação Central neste caminho e logout cross-origin falha.
        verify_trusted_origin(request)
        response = Response(status_code=status.HTTP_204_NO_CONTENT)
        _clear_cookie(response, _SESSION_COOKIE)
        _clear_cookie(response, _TX_COOKIE)
        return response
    verify_origin_and_csrf(request, app_session)
    await revoke_application_session(app_session)
    try:
        await central_revoke(app_session)
    except GovernanceUnavailable:
        pass
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_cookie(response, _SESSION_COOKIE)
    _clear_cookie(response, _TX_COOKIE)
    return response
