from pydantic import BaseModel, ConfigDict, field_validator
from typing import Literal, Optional
from uuid import UUID
from datetime import datetime


class NumeroBotCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    numero: str
    nome: Optional[str] = None

    @field_validator("numero")
    @classmethod
    def strip_plus(cls, v: str) -> str:
        normalized = "".join(character for character in v if character.isdigit())
        if not 7 <= len(normalized) <= 15:
            raise ValueError("Número deve conter entre 7 e 15 dígitos")
        return normalized


class NumeroBotUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nome: Optional[str] = None
    ativo: Optional[bool] = None


class NumeroBotOut(BaseModel):
    """Public allowlist: credentials and free-form internal config never leave API."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    cliente_id: UUID
    numero: str
    nome: Optional[str] = None
    ativo: bool
    provider_instance_id: Optional[str] = None
    sync_enabled: bool
    analysis_enabled: bool
    sync_state: Optional[str] = None
    last_message_at: Optional[datetime] = None
    last_analysis_at: Optional[datetime] = None
    connection_generation: UUID
    created_at: datetime
    updated_at: datetime

class UazapiStatusOut(BaseModel):
    status: Literal["connected", "connecting", "disconnected"]
    qr_code: Optional[str] = None
    pairing_code: Optional[str] = None
    phone: Optional[str] = None
    phone_matches_registered: Optional[bool] = None
    sync_enabled: bool = False
    sync_state: Optional[str] = None
