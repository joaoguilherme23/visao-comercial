from pydantic import BaseModel, Field, field_validator
from typing import Optional, Any, Dict, List, Literal
from uuid import UUID
from datetime import datetime
import re


# ── Helpers de validação ─────────────────────────────────────────────────────

def _validate_cnpj_digits(cnpj: str) -> str:
    """Valida CNPJ brasileiro (14 dígitos + 2 verificadores).

    Aceita strings com ou sem máscara. Retorna apenas dígitos. Levanta
    ValueError se inválido. CNPJs com todos dígitos iguais (ex: 11111111111111)
    passam no algoritmo mas não são válidos — bloqueia explicitamente.
    """
    digits = re.sub(r"\D", "", cnpj or "")
    if not digits:
        raise ValueError("CNPJ vazio")
    if len(digits) != 14:
        raise ValueError("CNPJ deve ter 14 dígitos")
    if digits == digits[0] * 14:
        raise ValueError("CNPJ inválido (dígitos repetidos)")

    def _digit(base: str, weights: list[int]) -> int:
        s = sum(int(d) * w for d, w in zip(base, weights))
        rest = s % 11
        return 0 if rest < 2 else 11 - rest

    w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    if _digit(digits[:12], w1) != int(digits[12]):
        raise ValueError("CNPJ inválido (dígito 1)")
    if _digit(digits[:13], w2) != int(digits[13]):
        raise ValueError("CNPJ inválido (dígito 2)")
    return digits


# ── Subtipos cadastrais ──────────────────────────────────────────────────────

class Contato(BaseModel):
    """Item do array `contatos` (JSONB) do Cliente.

    Pelo menos um dos dois (telefone OU email) deve estar preenchido — frontend
    valida ao adicionar.
    """
    tipo: Literal["comercial", "financeiro", "suporte", "outro"] = "comercial"
    telefone: Optional[str] = None
    email: Optional[str] = None


class EnderecoUpdate(BaseModel):
    """Subset usado pelo frontend pra batch-update do endereço (ViaCEP)."""
    cep: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None


# ── Cliente — payloads ──────────────────────────────────────────────────────

class ClienteCreate(BaseModel):
    nome: str
    slug: str
    nicho: Optional[str] = None
    plano: Optional[str] = "basico"
    timezone: str = "America/Sao_Paulo"
    nome_agente: Optional[str] = None
    config: Dict[str, Any] = {}
    budget_brl_diario: Optional[float] = None
    # Cadastrais — opcionais na criação. Cliente preenche depois pelo drawer.
    cnpj: Optional[str] = None
    razao_social: Optional[str] = None

    @field_validator("cnpj", mode="before")
    @classmethod
    def _v_cnpj(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        return _validate_cnpj_digits(str(v))


class ClienteUpdate(BaseModel):
    """Update completo (superadmin). Aceita TODOS os campos cadastrais.

    `slug`, `plano`, `budget_brl_diario`, `ativo` só superadmin altera —
    o admin do cliente usa o `ClienteDadosCadastraisUpdate` que tem subset.
    """
    nome: Optional[str] = None
    nicho: Optional[str] = None
    plano: Optional[str] = None
    timezone: Optional[str] = None
    nome_agente: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    ativo: Optional[bool] = None
    budget_brl_diario: Optional[float] = None
    # Cadastrais
    cnpj: Optional[str] = None
    razao_social: Optional[str] = None
    endereco_cep: Optional[str] = None
    endereco_logradouro: Optional[str] = None
    endereco_numero: Optional[str] = None
    endereco_complemento: Optional[str] = None
    endereco_bairro: Optional[str] = None
    endereco_cidade: Optional[str] = None
    endereco_uf: Optional[str] = None
    contatos: Optional[List[Contato]] = None
    responsavel_nome: Optional[str] = None
    responsavel_cargo: Optional[str] = None
    responsavel_email: Optional[str] = None
    responsavel_telefone: Optional[str] = None
    # foto_url NÃO é editado aqui — endpoint dedicado /tenants/{id}/avatar

    @field_validator("cnpj", mode="before")
    @classmethod
    def _v_cnpj(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        return _validate_cnpj_digits(str(v))


class ClienteDadosCadastraisUpdate(BaseModel):
    """Subset usado pelo admin do cliente pra editar a própria empresa.

    NÃO permite mudar slug, plano, budget, ativo — esses são responsabilidade
    do superadmin (controle comercial / técnico).
    """
    nome: Optional[str] = None
    cnpj: Optional[str] = None
    razao_social: Optional[str] = None
    timezone: Optional[str] = None
    nome_agente: Optional[str] = None
    endereco_cep: Optional[str] = None
    endereco_logradouro: Optional[str] = None
    endereco_numero: Optional[str] = None
    endereco_complemento: Optional[str] = None
    endereco_bairro: Optional[str] = None
    endereco_cidade: Optional[str] = None
    endereco_uf: Optional[str] = None
    contatos: Optional[List[Contato]] = None
    responsavel_nome: Optional[str] = None
    responsavel_cargo: Optional[str] = None
    responsavel_email: Optional[str] = None
    responsavel_telefone: Optional[str] = None

    @field_validator("cnpj", mode="before")
    @classmethod
    def _v_cnpj(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        return _validate_cnpj_digits(str(v))


# ── Cliente — outputs ───────────────────────────────────────────────────────

class ClienteOut(BaseModel):
    id: UUID
    nome: str
    slug: str
    nicho: Optional[str] = None
    plano: Optional[str] = None
    timezone: str
    nome_agente: Optional[str] = None
    ativo: bool
    budget_brl_diario: Optional[float] = None
    # Cadastrais
    cnpj: Optional[str] = None
    razao_social: Optional[str] = None
    endereco_cep: Optional[str] = None
    endereco_logradouro: Optional[str] = None
    endereco_numero: Optional[str] = None
    endereco_complemento: Optional[str] = None
    endereco_bairro: Optional[str] = None
    endereco_cidade: Optional[str] = None
    endereco_uf: Optional[str] = None
    contatos: List[Contato] = Field(default_factory=list)
    responsavel_nome: Optional[str] = None
    responsavel_cargo: Optional[str] = None
    responsavel_email: Optional[str] = None
    responsavel_telefone: Optional[str] = None
    foto_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClienteDetailOut(ClienteOut):
    config: Optional[Dict[str, Any]] = None


# ── TenantConnection (sem mudanças) ─────────────────────────────────────────

class TenantConnectionCreate(BaseModel):
    tipo: str
    nome: str
    config: Dict[str, Any] = {}


class TenantConnectionUpdate(BaseModel):
    nome: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    ativo: Optional[bool] = None


class TenantConnectionOut(BaseModel):
    id: UUID
    cliente_id: UUID
    tipo: str
    nome: str
    config: Dict[str, Any]
    ativo: bool
    status: str
    ultimo_ping: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
