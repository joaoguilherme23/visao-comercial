"""Schemas de ComentarioLead — comentários internos do time sobre um lead."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime


class ComentarioOut(BaseModel):
    id: UUID
    lead_id: UUID
    user_id: UUID
    autor_nome: str
    texto: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ComentarioCreate(BaseModel):
    """Body do POST /feed/{cliente_id}/leads/{lead_id}/comentarios"""
    texto: str = Field(..., min_length=1, max_length=2000)
