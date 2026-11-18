"""Unit tests for phone normalization in Uazapi status payloads."""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("DATABASE_URL_SYNC", "postgresql://test:test@localhost/test")

from app.services.uazapi import UazapiService


class ExtractPhoneTests(unittest.TestCase):
    def test_status_jid_discards_device_suffix(self) -> None:
        payload = {"status": {"jid": "5511999999999:17@s.whatsapp.net"}}

        self.assertEqual(UazapiService.extract_phone(payload), "5511999999999")

    def test_standard_personal_jid_is_returned(self) -> None:
        payload = {"jid": "5511999999999@s.whatsapp.net"}

        self.assertEqual(UazapiService.extract_phone(payload), "5511999999999")

    def test_instance_owner_is_used_as_a_fallback(self) -> None:
        payload = {"instance": {"owner": "5511999999999"}}

        self.assertEqual(UazapiService.extract_phone(payload), "5511999999999")

    def test_invalid_or_lid_values_are_not_treated_as_phones(self) -> None:
        invalid_payloads = (
            {"status": {"jid": "5511999999999@lid"}},
            {"status": {"jid": "5511999999999:desktop@s.whatsapp.net"}},
            {"status": {"jid": "5511999999999@g.us"}},
            {"status": {"jid": "not-a-phone@s.whatsapp.net"}},
            {"instance": {"owner": "5511999999999@lid"}},
        )

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                self.assertIsNone(UazapiService.extract_phone(payload))
