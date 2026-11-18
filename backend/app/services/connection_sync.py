"""Reusable remote reconciliation for Uazapi connections and periodic workers."""
from __future__ import annotations

import re
import uuid

from app.core.config import settings
from app.models.numero import NumeroBot
from app.services.connection_credentials import get_connection_token
from app.services.connection_backfill import schedule_backfill
from app.services.uazapi import UazapiError, uazapi


def registered_phone_matches(numero: NumeroBot, phone: str | None) -> bool:
    return bool(phone) and re.sub(r"\D", "", numero.numero) == re.sub(r"\D", "", phone or "")


async def reconcile_remote_webhook(numero: NumeroBot) -> None:
    """Ensure only this app's URL has required events; preserve all other URLs."""
    url = getattr(settings, "UAZAPI_WEBHOOK_URL", "")
    if not isinstance(url, str) or not url.strip():
        raise UazapiError("Webhook Uazapi não configurado no servidor", 503)
    token = get_connection_token(numero)
    items = await uazapi.get_webhooks(token)
    own = next((item for item in items if item.get("url") == url), None)
    required = {"connection", "history", "messages", "messages_update"}
    if own is not None:
        events = own.get("events")
        healthy = own.get("enabled", True) and (not isinstance(events, list) or required.issubset(set(events)))
        if healthy:
            return
        webhook_id = own.get("id")
        if not isinstance(webhook_id, (str, int)):
            raise UazapiError("Webhook X9 remoto sem identificador", 502)
        await uazapi.update_webhook(token, str(webhook_id), url)
    else:
        await uazapi.add_webhook(token, url)
    confirmed = await uazapi.get_webhooks(token)
    if not any(
        item.get("url") == url
        and item.get("enabled", True)
        and (
            not isinstance(item.get("events"), list)
            or required.issubset(set(item["events"]))
        )
        for item in confirmed
    ):
        raise UazapiError("Uazapi não confirmou o webhook", 502)


async def reconcile_connected_number(numero: NumeroBot) -> str:
    """Worker-safe status/reconciliation hook for connections with sync enabled.

    A caller persists the changed model in its surrounding transaction.  It does
    not reconnect or rotate any token, so closing the UI cannot lose a setup.
    """
    token = get_connection_token(numero)
    payload = await uazapi.get_status(token)
    state = uazapi.extract_status(payload)
    if state != "connected":
        numero.sync_state = state
        return state
    if not registered_phone_matches(numero, uazapi.extract_phone(payload)):
        numero.sync_enabled = False
        numero.analysis_enabled = False
        numero.connection_generation = uuid.uuid4()
        numero.sync_state = "connection_mismatch"
        return numero.sync_state
    await reconcile_remote_webhook(numero)
    if numero.sync_enabled:
        numero.sync_state = "sync_enabled"
        schedule_backfill(numero)
    else:
        numero.sync_state = "connected_unmanaged"
    return numero.sync_state
