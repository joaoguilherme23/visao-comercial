"""Isolamento local: permissões Central não suplantam user_tenants."""
import os
import unittest
from unittest.mock import patch

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("DATABASE_URL_SYNC", "postgresql://test:test@localhost/test")
os.environ.setdefault("SECRET_KEY", "test-only-not-a-production-secret")
os.environ.setdefault("SUPERADMIN_PASSWORD", "test-only-password")

from fastapi import HTTPException
from app.services.oidc_bff import assert_local_tenant_restriction

TENANT_A = "a1111111-1111-4111-8111-111111111111"
TENANT_B = "b2222222-2222-4222-8222-222222222222"


class _Result:
    def __init__(self, value): self.value = value
    def scalar_one_or_none(self): return self.value


class _Db:
    def __init__(self, value): self.value = value
    async def execute(self, *_args, **_kwargs): return _Result(self.value)


class OidcTenantIsolationTests(unittest.IsolatedAsyncioTestCase):
    async def test_membership_in_a_cannot_authorize_b(self) -> None:
        # Simula a query local: A retorna membership; B não. Não há bypass por superadmin.
        await assert_local_tenant_restriction(_Db("membership-a"), "user", TENANT_A)
        with self.assertRaises(HTTPException) as denied:
            await assert_local_tenant_restriction(_Db(None), "user", TENANT_B)
        self.assertEqual(denied.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
