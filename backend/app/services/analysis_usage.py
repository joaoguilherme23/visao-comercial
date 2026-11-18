"""Usage metadata for the existing dashboard; no prompt or generated text."""
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.llm_log import LlmUsageLog
from app.schemas.internal_analysis import AnalysisContextOut
from app.services.analysis_provider import ProviderAnalysis


async def record_analysis_usage(db: AsyncSession, context: AnalysisContextOut, result: ProviderAnalysis):
    now = datetime.now(timezone.utc)
    db.add(LlmUsageLog(
        created_at=now,
        model=result.model,
        usage=result.usage,
        prompt_tokens=result.usage.get('prompt_tokens'),
        completion_tokens=result.usage.get('completion_tokens'),
        total_tokens=result.total_tokens,
        workflow='x9-python',
        workflow_timestamp=int(now.timestamp()),
        workflow_name='X9 / análise de conversas',
        usuario=context.tenant['id'],
        nicho=context.tenant.get('nicho'),
        qtd_msg=len(context.messages),
        response=None,
    ))
    await db.flush()
