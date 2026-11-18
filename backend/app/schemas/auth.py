from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserOut"

class RefreshRequest(BaseModel):
    refresh_token: str

class UserOut(BaseModel):
    id: UUID
    email: str
    nome: str
    is_superadmin: bool
    is_manager_multi: bool = False
    must_change_password: bool = False
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True

TokenResponse.model_rebuild()
