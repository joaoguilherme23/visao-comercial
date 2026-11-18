"""Public route contract for niche configuration and analysis KPI reads."""

import os
import unittest

from fastapi import FastAPI

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("DATABASE_URL_SYNC", "postgresql://test:test@localhost/test")

from app.routers.nicho import router


class NichoRouteContractTests(unittest.TestCase):
    def test_kpi_write_route_is_not_published(self) -> None:
        app = FastAPI()
        app.include_router(router, prefix="/api/v1")
        paths = app.openapi()["paths"]
        self.assertNotIn("/api/v1/nichos/kpi", paths)
        self.assertIn("get", paths["/api/v1/nichos/kpi/{analise_id}"])
