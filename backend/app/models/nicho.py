import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, Text, text
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

def _utcnow(): return datetime.now(timezone.utc)


class NichoConfig(Base):
    """
    schema: analise.nicho_config

    Define o schema de KPIs e campos de análise específicos de cada nicho.
    campos_kpi: lista de definições de campo — cada item:
      {"nome": "tipo_imovel", "tipo": "string", "label": "Tipo de Imóvel", "obrigatorio": false}
    campos_analise: idem, para campos extras da analise (além dos padrão)
    prompt_base: instrução de sistema usada pelo worker Python nesse nicho
    """
    __tablename__ = "nicho_config"
    __table_args__ = {"schema": "analise"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nicho: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    campos_kpi: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    campos_analise: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    etapas_kanban: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb"))
    prompt_base: Mapped[str | None] = mapped_column(Text, nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, onupdate=_utcnow)

