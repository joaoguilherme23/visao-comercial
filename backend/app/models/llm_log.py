"""
Model do log de uso da LLM (consumo de tokens + custo).

Tabela recebe metadados de uso do worker Python e dos fluxos legados.
O worker não persiste prompts nem respostas nesse log.
"""
from datetime import datetime
from sqlalchemy import String, Integer, Numeric, BigInteger, Text
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class LlmUsageLog(Base):
    """schema: logs.log_llm_usage — consumo de IA sem conteúdo de conversas."""
    __tablename__ = "log_llm_usage"
    __table_args__ = {"schema": "logs"}

    # Schema legacy: id é BIGINT, usuario é TEXT (não UUID).
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)

    # Identificação do modelo
    model: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Payload bruto vindo do OpenAI/Anthropic (campo `usage`)
    usage: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Tokens decompostos extraídos da resposta do provedor.
    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cached_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    audio_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reasoning_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Identificador do processamento de análise (rastreabilidade).
    workflow: Mapped[str | None] = mapped_column(String(120), nullable=True)
    workflow_timestamp: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    workflow_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Gasto pré-calculado (NÃO usado hoje — todos NULL).
    # Backend recalcula on-the-fly em llm_pricing.py.
    gasto: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    gasto_reais: Mapped[float | None] = mapped_column(Numeric, nullable=True)

    # `usuario` na verdade armazena o cliente_id (string com UUID textual).
    # Schema legacy é text — convertemos pra UUID na camada de service.
    usuario: Mapped[str | None] = mapped_column(Text, nullable=True)

    response: Mapped[str | None] = mapped_column(String, nullable=True)
    nicho: Mapped[str | None] = mapped_column(String(100), nullable=True)
    qtd_msg: Mapped[int | None] = mapped_column(Integer, nullable=True)
