"""Focused unit tests for credential safety and webhook replay behavior."""
from __future__ import annotations

import sys
import os
import unittest
import uuid
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from cryptography.fernet import Fernet
from fastapi import HTTPException
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("DATABASE_URL_SYNC", "postgresql://test:test@localhost/test")

from app.core.config import settings
from app.schemas.numero import NumeroBotCreate, NumeroBotUpdate
from app.services import connection_credentials
from app.services.uazapi_webhook import MAX_HISTORY_MESSAGES, process_uazapi_event, validate_event_shape
from app.services.uazapi_webhook import _lead_identity_filter
from app.models.lead import Lead
from sqlalchemy import select
from app.routers.webhooks import _payload_identity_matches
from app.routers.webhooks import receive_uazapi_webhook


class CredentialTests(unittest.TestCase):
    def test_ciphertext_roundtrip_and_digest_are_not_token(self) -> None:
        key = Fernet.generate_key().decode("ascii")
        with patch.object(settings, "UAZAPI_CREDENTIAL_KEY", key, create=True):
            encrypted = connection_credentials.encrypt_token("synthetic-instance-token")
            self.assertNotIn("synthetic-instance-token", encrypted)
            self.assertEqual(connection_credentials.decrypt_token(encrypted), "synthetic-instance-token")
            self.assertNotEqual(connection_credentials.token_digest("synthetic-instance-token"), "synthetic-instance-token")

    def test_mass_assignment_is_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            NumeroBotCreate.model_validate({"numero": "+5511999999999", "config": {"uazapi_token": "x"}})
        with self.assertRaises(ValidationError):
            NumeroBotUpdate.model_validate({"token_encrypted": "attempt"})


class WebhookShapeTests(unittest.TestCase):
    def test_lid_and_pn_queries_have_disjoint_namespaces(self) -> None:
        pn_query = str(select(Lead).where(_lead_identity_filter("5511999999999")).compile(compile_kwargs={"literal_binds": True}))
        lid_query = str(select(Lead).where(_lead_identity_filter("lid:5511999999999")).compile(compile_kwargs={"literal_binds": True}))
        self.assertIn("NOT LIKE", pn_query)
        self.assertIn("lid:", lid_query)
    def test_oversized_history_is_rejected_not_truncated(self) -> None:
        with self.assertRaises(ValueError):
            validate_event_shape({"EventType": "history", "event": "messages", "messages": [{}] * (MAX_HISTORY_MESSAGES + 1)})

    def test_instance_or_owner_mismatch_is_rejected(self) -> None:
        numero = SimpleNamespace(numero="5511999999999", provider_instance_id="x9_instance")
        self.assertFalse(_payload_identity_matches(numero, {"instanceName": "other"}))
        self.assertFalse(_payload_identity_matches(numero, {"owner": "5511888888888"}))
        self.assertTrue(_payload_identity_matches(numero, {"instanceName": "x9_instance", "owner": "5511999999999@s.whatsapp.net"}))


class ReplayTests(unittest.IsolatedAsyncioTestCase):
    async def test_unknown_token_is_rejected_before_processing(self) -> None:
        request = SimpleNamespace(headers={}, body=AsyncMock(return_value=b'{"token":"invalid"}'))
        result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))
        db = SimpleNamespace(execute=AsyncMock(return_value=result))
        with self.assertRaises(HTTPException) as raised:
            await receive_uazapi_webhook(request, db)
        self.assertEqual(raised.exception.status_code, 401)

    async def test_replay_does_not_enqueue_analysis(self) -> None:
        numero = SimpleNamespace(
            id=uuid.uuid4(), cliente_id=uuid.uuid4(), analysis_enabled=True,
            connection_generation=uuid.uuid4(), last_message_at=None, sync_state=None,
        )
        db = SimpleNamespace(flush=AsyncMock())
        timestamp = datetime.now(timezone.utc)
        with patch(
            "app.services.uazapi_webhook._upsert_message",
            new=AsyncMock(return_value=(uuid.uuid4(), uuid.uuid4(), False, True, timestamp)),
        ), patch("app.services.analysis_queue.enqueue_analysis", new=AsyncMock()) as enqueue:
            accepted = await process_uazapi_event(
                db, numero,
                {"EventType": "messages", "message": {"chatid": "5511999999999@s.whatsapp.net"}},
            )
        self.assertEqual(accepted, 0)
        enqueue.assert_not_awaited()

    async def test_new_inbound_message_enqueues_once(self) -> None:
        numero = SimpleNamespace(
            id=uuid.uuid4(), cliente_id=uuid.uuid4(), analysis_enabled=True,
            connection_generation=uuid.uuid4(), last_message_at=None, sync_state=None,
        )
        db = SimpleNamespace(flush=AsyncMock())
        message_id, lead_id = uuid.uuid4(), uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        with patch(
            "app.services.uazapi_webhook._upsert_message",
            new=AsyncMock(return_value=(message_id, lead_id, True, True, timestamp)),
        ), patch("app.services.analysis_queue.enqueue_analysis", new=AsyncMock()) as enqueue:
            accepted = await process_uazapi_event(
                db, numero,
                {"EventType": "messages", "message": {"chatid": "5511999999999@s.whatsapp.net"}},
            )
        self.assertEqual(accepted, 1)
        enqueue.assert_awaited_once_with(
            db, cliente_id=numero.cliente_id, numero_bot_id=numero.id, lead_id=lead_id,
            message_id=message_id, connection_generation=numero.connection_generation,
        )

    async def test_delivery_update_never_enqueues_analysis(self) -> None:
        numero = SimpleNamespace(
            id=uuid.uuid4(), cliente_id=uuid.uuid4(), analysis_enabled=True,
            connection_generation=uuid.uuid4(), last_message_at=None, sync_state=None,
        )
        db = SimpleNamespace(flush=AsyncMock(), execute=AsyncMock())
        with patch("app.services.analysis_queue.enqueue_analysis", new=AsyncMock()) as enqueue:
            accepted = await process_uazapi_event(
                db, numero,
                {"EventType": "messages_update", "message": {"messageid": "provider-1", "status": "read"}},
            )
        self.assertEqual(accepted, 0)
        enqueue.assert_not_awaited()

    async def test_group_in_history_is_ignored_without_aborting_batch(self) -> None:
        numero = SimpleNamespace(
            id=uuid.uuid4(), cliente_id=uuid.uuid4(), analysis_enabled=True,
            connection_generation=uuid.uuid4(), last_message_at=None, sync_state=None,
        )
        db = SimpleNamespace(flush=AsyncMock())
        accepted = await process_uazapi_event(
            db, numero,
            {"EventType": "history", "event": "messages", "messages": [{
                "isGroup": True, "chatid": "123@g.us", "messageid": "g-1", "messageTimestamp": 1700000000000,
            }]},
        )
        self.assertEqual(accepted, 0)
        db.flush.assert_awaited()
