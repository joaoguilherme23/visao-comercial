import secrets
from datetime import timedelta, datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import verify_password, hash_password, create_access_token, create_refresh_token, decode_token
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest, UserOut
from app.schemas.user import ChangePasswordBody, ForgotPasswordBody, ResetPasswordBody
from app.services import email_service

router = APIRouter(prefix="/auth", tags=["auth"])

_RESET_TOKEN_TTL_HOURS = 2


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuário inativo")

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user),
    )

@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token inválido")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expirado ou inválido")

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user),
    )

@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password", response_model=UserOut)
async def change_password(
    body: ChangePasswordBody,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Troca a senha do usuário autenticado e limpa a flag must_change_password.
    Após a troca, envia email de confirmação.
    """
    if not current_user.password_hash or not verify_password(body.senha_atual, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    if body.senha_atual == body.senha_nova:
        raise HTTPException(status_code=400, detail="A nova senha deve ser diferente da atual")
    current_user.password_hash = hash_password(body.senha_nova)
    current_user.must_change_password = False
    await db.flush()
    await db.refresh(current_user)
    background_tasks.add_task(
        email_service.send_password_changed,
        current_user.nome,
        current_user.email,
    )
    return current_user


@router.post("/forgot-password", status_code=204)
async def forgot_password(
    body: ForgotPasswordBody,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Dispara email de redefinição de senha para o email informado.
    Responde sempre 204 (não revela se o email existe ou não).
    """
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        return  # resposta silenciosa — não revela existência do email

    token = secrets.token_urlsafe(64)
    user.reset_token = token
    user.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=_RESET_TOKEN_TTL_HOURS)
    await db.flush()

    background_tasks.add_task(email_service.send_reset, user.nome, user.email, token)


@router.post("/reset-password", status_code=204)
async def reset_password(
    body: ResetPasswordBody,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Define nova senha via token (convite ou forgot-password).
    Token expira em 2 horas após geração.
    """
    result = await db.execute(select(User).where(User.reset_token == body.token))
    user = result.scalar_one_or_none()

    if not user or not user.reset_token_expires_at:
        raise HTTPException(status_code=400, detail="Token inválido ou expirado")

    if datetime.now(timezone.utc) > user.reset_token_expires_at:
        raise HTTPException(status_code=400, detail="Token inválido ou expirado")

    user.password_hash = hash_password(body.senha_nova)
    user.must_change_password = False
    user.reset_token = None
    user.reset_token_expires_at = None
    await db.flush()

    background_tasks.add_task(email_service.send_password_changed, user.nome, user.email)
