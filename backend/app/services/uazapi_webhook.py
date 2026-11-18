"""Idempotent, tenant-isolated ingestion of Uazapi messages and history."""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, desc, func, select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lead import Lead
from app.models.message import Mensagem
from app.models.numero import NumeroBot

MAX_HISTORY_MESSAGES = 2_000


class UazapiPayloadError(ValueError):
    pass


def _chat_identity(jid: Any) -> str | None:
    """PN and LID are distinct identity namespaces; groups/status are ignored."""
    if not isinstance(jid, str):
        raise UazapiPayloadError("Mensagem sem chat válido")
    local, separator, domain = jid.partition("@")
    if domain in {"g.us", "broadcast", "newsletter"} or jid == "status@broadcast":
        return None
    if domain == "lid":
        return f"lid:{local}" if local and len(local) <= 25 else None
    if separator and domain not in {"s.whatsapp.net", "c.us"}:
        raise UazapiPayloadError("Mensagem com domínio de chat inválido")
    digits = re.sub(r"\D", "", local)
    if not 7 <= len(digits) <= 15:
        raise UazapiPayloadError("Mensagem sem chat válido")
    return digits


def _message_time(value: Any) -> datetime | None:
    try:
        stamp = int(value)
        if stamp > 10**12:
            stamp /= 1000
        return datetime.fromtimestamp(stamp, tz=timezone.utc) if stamp > 0 else None
    except (TypeError, ValueError, OverflowError, OSError):
        return None


def _message_type(value: Any) -> str:
    aliases = {"conversation": "texto", "extendedtextmessage": "texto", "imagemessage": "imagem", "videomessage": "video", "audiomessage": "audio", "documentmessage": "documento", "stickermessage": "figurinha", "locationmessage": "localizacao", "contactmessage": "contato", "reactionmessage": "reacao"}
    raw = str(value or "unknown")
    return aliases.get(raw.lower(), raw[:30])


def _message_text(message: dict[str, Any]) -> str | None:
    value = message.get("text")
    if isinstance(value, str) and value.strip():
        return value
    content = message.get("content")
    if isinstance(content, dict):
        for key in ("text", "caption", "conversation"):
            value = content.get(key)
            if isinstance(value, str) and value.strip():
                return value
    placeholders = {"imagemessage": "[Imagem]", "videomessage": "[Vídeo]", "audiomessage": "[Áudio]", "documentmessage": "[Documento]", "stickermessage": "[Figurinha]", "locationmessage": "[Localização]"}
    return placeholders.get(str(message.get("messageType") or "").lower(), "[Mensagem sem texto]")


async def _lead_for_chat(db: AsyncSession, numero: NumeroBot, chat_phone: str, display_name: str | None) -> Lead:
    identity_filter = _lead_identity_filter(chat_phone)
    lead = (await db.execute(select(Lead).where(Lead.cliente_id == numero.cliente_id, Lead.numero_bot_id == numero.id, identity_filter, Lead.ativo.is_(True)).order_by(desc(Lead.updated_at)).limit(1))).scalar_one_or_none()
    if lead:
        if not lead.nome and display_name:
            lead.nome = display_name[:255]
        return lead
    statement = pg_insert(Lead).values(id=uuid.uuid4(), cliente_id=numero.cliente_id, numero_bot_id=numero.id, whatsapp=chat_phone, nome=display_name[:255] if display_name else None, telefone_bot=re.sub(r"\D", "", numero.numero)[:30], origem="WhatsApp")
    statement = statement.on_conflict_do_update(index_elements=[Lead.cliente_id, Lead.numero_bot_id, Lead.whatsapp], index_where=text("ativo = true AND numero_bot_id IS NOT NULL"), set_={"nome": func.coalesce(Lead.nome, statement.excluded.nome)}).returning(Lead.id)
    lead_id = (await db.execute(statement)).scalar_one()
    return (await db.execute(select(Lead).where(Lead.id == lead_id))).scalar_one()


def _lead_identity_filter(identity: str) -> Any:
    """Keep LID and PN identity namespaces disjoint even when digits match."""
    if identity.startswith("lid:"):
        return Lead.whatsapp == identity
    return and_(
        ~Lead.whatsapp.startswith("lid:"),
        func.regexp_replace(Lead.whatsapp, r"\D", "", "g") == identity,
    )


async def _upsert_message(db: AsyncSession, numero: NumeroBot, message: dict[str, Any], chat_name: str | None) -> tuple[uuid.UUID | None, uuid.UUID | None, bool, bool, datetime | None]:
    if message.get("isGroup") is True:
        return None, None, False, False, None
    chat_phone = _chat_identity(message.get("chatid"))
    provider_id = message.get("messageid") or message.get("id")
    sent_at = _message_time(message.get("messageTimestamp"))
    if chat_phone is None:
        return None, None, False, False, None
    if not isinstance(provider_id, str) or not provider_id or len(provider_id) > 200 or not sent_at:
        raise UazapiPayloadError("Mensagem sem identificadores válidos")
    from_me = bool(message.get("fromMe"))
    display_name = chat_name or (message.get("senderName") if not from_me else None)
    lead = await _lead_for_chat(db, numero, chat_phone, display_name if isinstance(display_name, str) else None)
    status = message.get("status")
    status_value = str(status)[:30] if status is not None else None
    statement = pg_insert(Mensagem).values(id=uuid.uuid4(), cliente_id=numero.cliente_id, numero_bot_id=numero.id, lead_id=lead.id, direcao="saida" if from_me else "entrada", tipo=_message_type(message.get("messageType")), conteudo=_message_text(message), provider_msg_id=provider_id, status_entrega=status_value, enviada_em=sent_at, enviado_por="api" if message.get("wasSentByApi") else "whatsapp")
    statement = statement.on_conflict_do_nothing(index_elements=[Mensagem.numero_bot_id, Mensagem.provider_msg_id], index_where=text("numero_bot_id IS NOT NULL AND provider_msg_id IS NOT NULL")).returning(Mensagem.id)
    message_id = (await db.execute(statement)).scalar_one_or_none()
    if message_id is not None:
        return message_id, lead.id, True, not from_me, sent_at
    if status_value is not None:
        await db.execute(update(Mensagem).where(Mensagem.numero_bot_id == numero.id, Mensagem.provider_msg_id == provider_id).values(status_entrega=status_value))
    existing = (await db.execute(select(Mensagem.id, Mensagem.lead_id).where(Mensagem.numero_bot_id == numero.id, Mensagem.provider_msg_id == provider_id))).one_or_none()
    return (existing[0], existing[1], False, not from_me, sent_at) if existing else (None, None, False, not from_me, sent_at)


def validate_event_shape(payload: dict[str, Any]) -> None:
    if payload.get("EventType") == "messages" and not isinstance(payload.get("message"), dict):
        raise UazapiPayloadError("Evento de mensagem inválido")
    if payload.get("EventType") == "history" and payload.get("event") == "messages":
        messages = payload.get("messages")
        if not isinstance(messages, list):
            raise UazapiPayloadError("Lote de histórico inválido")
        if len(messages) > MAX_HISTORY_MESSAGES:
            raise UazapiPayloadError("Lote de histórico excede o limite")
        if any(not isinstance(item, dict) for item in messages):
            raise UazapiPayloadError("Lote de histórico contém mensagem inválida")


async def process_uazapi_event(db: AsyncSession, numero: NumeroBot, payload: dict[str, Any]) -> int:
    validate_event_shape(payload)
    event_type = payload.get("EventType")
    if event_type == "connection":
        # A provider connection callback makes QR completion durable even if the
        # user has closed the polling UI.  It never reconnects or rotates tokens.
        from app.services.connection_sync import reconcile_connected_number
        await reconcile_connected_number(numero)
        await db.flush()
        return 0
    if event_type == "messages_update":
        # Delivery/read updates must never create a conversation or an AI job.
        updates = payload.get("messages") if isinstance(payload.get("messages"), list) else [payload.get("message")]
        for message in updates:
            if not isinstance(message, dict):
                continue
            provider_id, status = message.get("messageid") or message.get("id"), message.get("status")
            if isinstance(provider_id, str) and provider_id and status is not None:
                await db.execute(update(Mensagem).where(Mensagem.numero_bot_id == numero.id, Mensagem.provider_msg_id == provider_id).values(status_entrega=str(status)[:30]))
        await db.flush()
        return 0
    if event_type == "history" and payload.get("event") == "status":
        # Provider progress is telemetry, not an authorization state.
        numero.sync_state = "sync_enabled"
        await db.flush()
        return 0
    if event_type == "messages":
        messages = [payload["message"]]
    elif event_type == "history" and payload.get("event") == "messages":
        messages = payload["messages"]
    else:
        return 0
    chat = payload.get("chat") if isinstance(payload.get("chat"), dict) else {}
    chat_name = chat.get("name") if isinstance(chat.get("name"), str) else None
    saved = 0
    for message in messages:
        message_id, lead_id, inserted, inbound, sent_at = await _upsert_message(db, numero, message, chat_name)
        if not inserted:
            continue
        saved += 1
        if sent_at and (numero.last_message_at is None or sent_at > numero.last_message_at):
            numero.last_message_at = sent_at
        if inbound and numero.analysis_enabled and message_id and lead_id:
            from app.services.analysis_queue import enqueue_analysis
            await enqueue_analysis(db, cliente_id=numero.cliente_id, numero_bot_id=numero.id, lead_id=lead_id, message_id=message_id, connection_generation=numero.connection_generation)
    if saved:
        numero.sync_state = "receiving"
    await db.flush()
    return saved
