"""Schemas para o router /avatares."""
from __future__ import annotations

from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


EntidadeTipo = Literal["leads", "grupos"]


class SyncBatchBody(BaseModel):
    """POST /avatares/<cliente_id>/<tipo>/sync — sync com IDs explícitos."""
    ids: list[UUID] = Field(..., min_length=1, max_length=30)
    force: bool = False


class SyncPendingBody(BaseModel):
    """
    POST /avatares/<cliente_id>/<tipo>/sync-pendentes — pega os primeiros
    N sem foto_url e sincroniza. Sem `ids` no body.
    """
    limit: int = Field(default=30, ge=1, le=30)


class SyncResultItem(BaseModel):
    id: str
    status: Literal["ok", "skipped", "no_avatar", "failed"]
    url: Optional[str] = None
    reason: Optional[str] = None


class SyncSummary(BaseModel):
    total: int
    ok: int
    skipped: int
    no_avatar: int
    failed: int


class SyncResponse(BaseModel):
    summary: SyncSummary
    results: list[SyncResultItem]
