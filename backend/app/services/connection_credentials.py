"""Storage helpers for Uazapi instance credentials.

Tokens are encrypted at rest and are only compared through their SHA-256 digest
when a provider webhook arrives.  This module deliberately has no logging.
"""
from __future__ import annotations

import hashlib
from typing import TYPE_CHECKING

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.numero import NumeroBot

if TYPE_CHECKING:
    from uuid import UUID


class CredentialError(ValueError):
    """A configured credential cannot safely be used."""


class DuplicateCredentialError(CredentialError):
    """The same provider credential is already bound to another number."""


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _fernet() -> Fernet:
    key = getattr(settings, "UAZAPI_CREDENTIAL_KEY", "")
    if not isinstance(key, str) or not key.strip():
        raise CredentialError("Credencial Uazapi indisponível no servidor")
    try:
        return Fernet(key.encode("ascii"))
    except (ValueError, TypeError) as exc:
        raise CredentialError("Chave de credenciais Uazapi inválida no servidor") from exc


def encrypt_token(token: str) -> str:
    if not isinstance(token, str) or not token:
        raise CredentialError("Credencial Uazapi inválida")
    return _fernet().encrypt(token.encode("utf-8")).decode("ascii")


def decrypt_token(encrypted: str) -> str:
    if not isinstance(encrypted, str) or not encrypted:
        raise CredentialError("Credencial Uazapi ausente")
    try:
        return _fernet().decrypt(encrypted.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeDecodeError) as exc:
        raise CredentialError("Credencial Uazapi não pode ser lida") from exc


async def save_connection_credentials(
    db: AsyncSession,
    numero: NumeroBot,
    *,
    provider_instance_id: str,
    token: str,
) -> None:
    """Bind a freshly provisioned credential, rejecting ambiguous ownership."""
    digest = token_digest(token)
    owner = await db.scalar(
        select(NumeroBot.id).where(
            NumeroBot.token_digest == digest,
            NumeroBot.id != numero.id,
        )
    )
    if owner is not None:
        raise DuplicateCredentialError("Credencial Uazapi já está vinculada a outro número")
    numero.provider_instance_id = provider_instance_id[:120]
    numero.token_digest = digest
    numero.token_encrypted = encrypt_token(token)


def get_connection_token(numero: NumeroBot) -> str:
    """Return a current encrypted credential. Production routes use only this."""
    return decrypt_token(numero.token_encrypted or "")


def get_legacy_token_for_migration(numero: NumeroBot) -> str | None:
    """Explicit migration-only escape hatch; never use it in request handlers.

    It exists solely so a separately reviewed migration command can transfer
    legacy JSON credentials without printing them.  It does not mutate data.
    """
    candidate = (numero.config or {}).get("uazapi_token")
    return candidate if isinstance(candidate, str) and candidate else None
