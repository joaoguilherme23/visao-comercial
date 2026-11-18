import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

def _utcnow(): return datetime.now(timezone.utc)


class Grupo(Base):
    """schema: integracao.grupos"""
    __tablename__ = "grupos"
    __table_args__ = {"schema": "integracao"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    # JID number sem @g.us — pode ter 15+ dígitos
    whatsapp: Mapped[str] = mapped_column(String(60), nullable=False)
    nome: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ultima_interacao: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow)
    # Colunas já existentes no banco (mapeamento tardio):
    temperatura: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # update_at é TIMESTAMP WITHOUT TIME ZONE no schema real (sic — divergência histórica).
    update_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True)
    # Avatar do grupo — caminho relativo servido pelo nginx
    # (ex: "/avatars/grupos/<uuid>/<ts>.jpg"). Veja services/avatar_service.py.
    foto_url: Mapped[str | None] = mapped_column(String(500), nullable=True)


class GrupoMensagem(Base):
    """schema: integracao.grupos_mensagens"""
    __tablename__ = "grupos_mensagens"
    __table_args__ = {"schema": "integracao"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grupo_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    cliente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    conteudo: Mapped[str | None] = mapped_column(Text, nullable=True)
    participant_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    participant_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    direcao: Mapped[str] = mapped_column(String(10), nullable=False)  # 'entrada' / 'saida'
    tipo: Mapped[str] = mapped_column(String(30), nullable=False)
    provider_msg_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    enviada_em: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
