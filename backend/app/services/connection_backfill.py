"""Bounded import of messages already retained by Uazapi.

This is deliberately not WhatsApp history-sync: it cannot promise messages the
provider does not retain. One page is imported per worker cycle.
"""
from __future__ import annotations

import re
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.numero import NumeroBot
from app.models.tenant import Cliente
from app.services.connection_credentials import get_connection_token
from app.services.uazapi import UazapiError, uazapi
from app.services.uazapi_webhook import _message_time, process_uazapi_event

PAGE_SIZE = 500
MAX_PAGES = 200
MAX_ATTEMPTS = 5


def _digits(value: Any) -> str:
    return re.sub(r"\D", "", value.split("@", 1)[0]) if isinstance(value, str) else ""


def schedule_backfill(numero: NumeroBot) -> None:
    """Create private, resumable progress metadata without storing credentials."""
    config = deepcopy(numero.config or {})
    current = config.get("x9_backfill")
    if isinstance(current, dict):
        return
    days = getattr(settings, "UAZAPI_HISTORY_DAYS", 30)
    cutoff = datetime.now(timezone.utc) - timedelta(days=max(0, min(int(days), 30)))
    config["x9_backfill"] = {
        "status": "pending", "offset": 0, "pages": 0, "attempts": 0,
        "cutoff": cutoff.isoformat(),
    }
    numero.config = config


async def backfill_step(db: AsyncSession, numero: NumeroBot) -> int:
    """Import at most one page; caller owns the transaction and worker cadence."""
    if not await db.scalar(select(Cliente.ativo).where(Cliente.id == numero.cliente_id)):
        return 0
    if not numero.ativo or not numero.sync_enabled or numero.sync_state not in {"sync_enabled", "receiving"}:
        return 0
    config = deepcopy(numero.config or {})
    state = config.get("x9_backfill")
    if not isinstance(state, dict):
        schedule_backfill(numero)
        config, state = deepcopy(numero.config or {}), numero.config["x9_backfill"]
    if state.get("status") in {"completed", "limited", "failed"}:
        return 0
    if int(state.get("attempts", 0)) >= MAX_ATTEMPTS:
        state["status"] = "failed"
        config["x9_backfill"] = state
        numero.config = config
        return 0
    offset, pages = int(state.get("offset", 0)), int(state.get("pages", 0))
    if pages >= MAX_PAGES:
        state["status"] = "limited"
        config["x9_backfill"] = state
        numero.config = config
        return 0
    try:
        response = await uazapi.find_messages(get_connection_token(numero), limit=PAGE_SIZE, offset=offset)
    except (UazapiError, ValueError):
        state["attempts"] = int(state.get("attempts", 0)) + 1
        state["status"] = "failed" if state["attempts"] >= MAX_ATTEMPTS else "pending"
        config["x9_backfill"] = state
        numero.config = config
        return 0
    try:
        cutoff = datetime.fromisoformat(str(state["cutoff"]))
    except (KeyError, ValueError):
        schedule_backfill(numero)
        return 0
    messages = response["messages"]
    owner = _digits(numero.numero)
    if any(message.get("owner") is not None and _digits(message.get("owner")) != owner for message in messages if isinstance(message, dict)):
        state["status"] = "failed"
        config["x9_backfill"] = state
        numero.config = config
        raise ValueError("Mensagem Uazapi com owner incompatível")
    eligible = [
        message for message in messages
        if isinstance(message, dict)
        and (timestamp := _message_time(message.get("messageTimestamp"))) is not None
        and timestamp >= cutoff
    ]
    accepted = await process_uazapi_event(db, numero, {"EventType": "history", "event": "messages", "messages": eligible}) if eligible else 0
    pagination = response.get("pagination") if isinstance(response.get("pagination"), dict) else response
    has_more, next_offset = pagination.get("hasMore"), pagination.get("nextOffset")
    state.update({"status": "running", "pages": pages + 1, "attempts": 0})
    timestamps = [_message_time(item.get("messageTimestamp")) for item in messages if isinstance(item, dict)]
    oldest = min((stamp for stamp in timestamps if stamp is not None), default=None)
    if has_more is False or (oldest is not None and oldest < cutoff):
        state["status"] = "completed"
    elif has_more is not True or not isinstance(next_offset, int) or next_offset <= offset:
        state["status"] = "limited"
    elif state["pages"] >= MAX_PAGES:
        state["status"] = "limited"
    else:
        state["offset"] = next_offset
    config["x9_backfill"] = state
    numero.config = config
    await db.flush()
    return accepted
