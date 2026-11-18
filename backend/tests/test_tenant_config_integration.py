"""Exercise tenant settings on a disposable PostgreSQL database only."""
import os
import unittest
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.models
from app.core.database import Base
from app.models.nicho import NichoConfig
from app.models.tenant import Cliente
from app.models.user import User
from app.services.tenant_nicho_config import get_effective_nicho_fields, save_tenant_nicho_fields


@unittest.skipUnless(os.getenv('X9_TEST_DATABASE_URL'), 'Disposable PostgreSQL required')
class TenantConfigurationIsolation(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        url = os.environ['X9_TEST_DATABASE_URL']
        if not url.rsplit('/', 1)[-1].startswith('x9_sync_test'):
            raise RuntimeError('Refusing to run integration tests on a non-test database')
        self.engine = create_async_engine(url, poolclass=NullPool, hide_parameters=True)
        async with self.engine.begin() as conn:
            for schema in ('integracao', 'analise', 'logs'):
                await conn.execute(text('CREATE SCHEMA IF NOT EXISTS ' + schema))
            await conn.run_sync(Base.metadata.create_all)
        self.db = async_sessionmaker(self.engine, expire_on_commit=False)()
        await self.db.begin()

    async def asyncTearDown(self):
        await self.db.rollback()
        await self.db.close()
        await self.engine.dispose()

    async def test_editing_one_company_does_not_change_other_or_template(self):
        suffix = uuid.uuid4().hex
        niche = 'test_' + suffix
        user = User(email=suffix+'@example.invalid', nome='Synthetic', password_hash='not-a-real-password')
        first = Cliente(nome='Synthetic A', slug='a_'+suffix, nicho=niche, plano='basico')
        second = Cliente(nome='Synthetic B', slug='b_'+suffix, nicho=niche, plano='basico')
        template = NichoConfig(
            nicho=niche, label='Synthetic', prompt_base='Synthetic prompt',
            campos_kpi=[{'nome':'original'}], campos_analise=[],
        )
        self.db.add_all([user, first, second, template])
        await self.db.flush()
        await save_tenant_nicho_fields(self.db, first.id, niche,
            [{'nome':'only_a'}], [{'nome':'question_a'}], user.id)
        a = await get_effective_nicho_fields(self.db, first.id, niche)
        b = await get_effective_nicho_fields(self.db, second.id, niche)
        self.assertEqual(a['campos_kpi'], [{'nome':'only_a'}])
        self.assertEqual(b['campos_kpi'], [{'nome':'original'}])
        self.assertEqual(a['label'], 'Synthetic')
        self.assertEqual(a['prompt_base'], 'Synthetic prompt')
        await self.db.refresh(template)
        self.assertEqual(template.campos_kpi, [{'nome':'original'}])
        await save_tenant_nicho_fields(self.db, second.id, niche,
            [{'nome':'only_b'}], [], user.id)
        a = await get_effective_nicho_fields(self.db, first.id, niche)
        self.assertEqual(a['campos_kpi'], [{'nome':'only_a'}])
