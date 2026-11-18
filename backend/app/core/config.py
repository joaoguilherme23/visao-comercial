from pydantic_settings import BaseSettings
from pydantic import Field, model_validator
from typing import List
import warnings
from pathlib import Path


def _resolve_env_file() -> Path:
    """Encontra o `.env` em ambos os layouts (dev local + container prod).

    - Dev local fora de Docker: backend/.env  → 3 levels up
    - Dev local com docker-compose.yml: x9_dev/.env → 4 levels up
    - Prod container Swarm: /app/.env (montado via volume) → 3 levels up

    Retorna o primeiro path que existe; se nenhum existir, retorna o "padrão
    container" pra que pydantic-settings caia no `os.environ` do Docker.
    """
    here = Path(__file__).resolve()
    candidates = [
        here.parent.parent.parent / ".env",         # backend/.env  ou  /app/.env (container)
        here.parent.parent.parent.parent / ".env",  # raiz do repo (dev local fora Docker)
    ]
    for c in candidates:
        if c.exists():
            return c
    return candidates[0]


ENV_FILE = _resolve_env_file()

_INSECURE_SECRETS = {"changeme", "secret", ""}
_INSECURE_PASSWORDS = {"admin123", "password", "123456", "admin", ""}


class Settings(BaseSettings):
    DATABASE_URL: str
    DATABASE_URL_SYNC: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    APP_ENV: str = "local"
    CORS_ORIGINS: str = "http://127.0.0.1:8310,http://localhost:8310"
    SUPERADMIN_EMAIL: str = "admin@example.com"
    SUPERADMIN_PASSWORD: str
    SUPERADMIN_NOME: str = "Super Admin"
    REDIS_URL: str = "redis://localhost:6379"
    # O orçamento é por processo. A soma dos processos que
    # usam este usuário deve ficar abaixo do limite do role
    # PostgreSQL; não use overflow como atalho para esse limite.
    DATABASE_POOL_SIZE: int = Field(default=4, ge=1, le=20)
    DATABASE_MAX_OVERFLOW: int = Field(default=0, ge=0, le=20)
    DATABASE_POOL_TIMEOUT_SECONDS: int = Field(default=5, ge=1, le=60)
    DATABASE_POOL_RECYCLE_SECONDS: int = Field(default=1800, ge=60, le=86400)

    # BFF OIDC. Segredos devem ser providos pelo ambiente ou por arquivos de
    # secret; nunca são persistidos no banco nem enviados ao navegador.
    OIDC_ENABLED: bool = False
    OIDC_ISSUER: str = ""
    OIDC_CLIENT_ID: str = "x9-web"
    OIDC_CLIENT_SECRET: str = ""
    OIDC_CLIENT_SECRET_FILE: str = ""
    OIDC_REDIRECT_URI: str = ""
    OIDC_COOKIE_SECURE: bool = True
    OIDC_SESSION_TTL_SECONDS: int = 86_400
    CENTRAL_BASE_URL: str = ""
    CENTRAL_M2M_CLIENT_ID: str = "x9-governance"
    CENTRAL_M2M_CLIENT_SECRET: str = ""
    CENTRAL_M2M_CLIENT_SECRET_FILE: str = ""
    CENTRAL_M2M_AUDIENCE: str = "central-governance"
    CENTRAL_M2M_SCOPE: str = "sessions:register authorization:check sessions:revoke"
    CENTRAL_CONTEXTS_MAX_PAGES: int = 10
    DISABLE_EXTERNAL_INTEGRATIONS: bool = True
    # Startup não modifica estrutura ou usuários sem estas permissões explícitas.
    DATABASE_BOOTSTRAP_SCHEMA: bool = False
    BOOTSTRAP_LEGACY_ADMIN: bool = False

    UAZAPI_BASE_URL: str = ""
    UAZAPI_ADMIN_TOKEN: str = Field(default="", repr=False)
    UAZAPI_CREDENTIAL_KEY: str = Field(default="", repr=False)
    UAZAPI_WEBHOOK_URL: str = ""
    UAZAPI_HISTORY_DAYS: int = Field(default=30, ge=0, le=30)
    OPENAI_API_KEY: str = Field(default="", repr=False)
    X9_ANALYSIS_MODEL: str = "gpt-4o"
    X9_ANALYSIS_TIMEOUT_SECONDS: float = Field(default=90, ge=10, le=180)
    X9_ANALYSIS_TOKEN_TTL_SECONDS: int = Field(default=900, ge=60, le=3600)
    X9_ANALYSIS_LEASE_SECONDS: int = Field(default=300, ge=30, le=1800)
    X9_ANALYSIS_MAX_ATTEMPTS: int = Field(default=5, ge=1, le=10)
    X9_ANALYSIS_CONTEXT_MESSAGE_LIMIT: int = Field(default=40, ge=1, le=100)
    X9_ANALYSIS_CONTEXT_CHAR_LIMIT: int = Field(default=12000, ge=1000, le=50000)
    X9_ANALYSIS_WORKER_POLL_SECONDS: float = Field(default=2, ge=0.1, le=60)
    X9_ANALYSIS_BACKLOG_INTERVAL_SECONDS: int = Field(default=300, ge=60, le=3600)
    X9_ANALYSIS_BACKLOG_PER_NUMBER_LIMIT: int = Field(default=10, ge=1, le=100)
    X9_ANALYSIS_BACKLOG_CYCLE_BUDGET: int = Field(default=50, ge=1, le=500)

    # Email (SMTP)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@example.test"
    SMTP_FROM_NAME: str = "Visão Comercial"
    SMTP_USE_TLS: bool = True

    # Frontend URL (para links nos emails)
    FRONTEND_URL: str = "http://127.0.0.1:8310"

    @model_validator(mode="after")
    def _check_security(self):
        is_prod = self.APP_ENV.lower() in ("production", "prod")
        if self.SECRET_KEY in _INSECURE_SECRETS:
            if is_prod:
                raise ValueError(
                    "SECRET_KEY insegura em produção! Defina uma chave forte via .env"
                )
            # BUG-14: aviso mais visível em dev com instrução clara
            warnings.warn(
                "\n"
                "╔══════════════════════════════════════════════════════════╗\n"
                "║  [x9 SECURITY] SECRET_KEY com valor padrão inseguro!     ║\n"
                "║  Tokens JWT podem ser forjados por qualquer pessoa.       ║\n"
                "║  Adicione SECRET_KEY=<chave-forte> ao seu arquivo .env    ║\n"
                "║  Gere uma chave: python -c \"import secrets; print(secrets.token_hex(32))\"  ║\n"
                "╚══════════════════════════════════════════════════════════╝",
                stacklevel=2,
            )
        if self.SUPERADMIN_PASSWORD in _INSECURE_PASSWORDS:
            if is_prod:
                raise ValueError(
                    "SUPERADMIN_PASSWORD insegura em produção! Defina uma senha forte via .env"
                )
            warnings.warn(
                "\n"
                "╔══════════════════════════════════════════════════════════╗\n"
                "║  [x9 SECURITY] SUPERADMIN_PASSWORD com valor padrão!     ║\n"
                "║  Adicione SUPERADMIN_PASSWORD=<senha-forte> ao .env       ║\n"
                "╚══════════════════════════════════════════════════════════╝",
                stacklevel=2,
            )
        return self

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    @staticmethod
    def _read_secret(value: str, file_name: str) -> str:
        if file_name:
            try:
                return Path(file_name).read_text(encoding="utf-8").strip()
            except OSError as exc:
                raise ValueError("Arquivo de secret OIDC indisponível") from exc
        return value

    @property
    def oidc_client_secret(self) -> str:
        return self._read_secret(self.OIDC_CLIENT_SECRET, self.OIDC_CLIENT_SECRET_FILE)

    @property
    def central_m2m_client_secret(self) -> str:
        return self._read_secret(
            self.CENTRAL_M2M_CLIENT_SECRET,
            self.CENTRAL_M2M_CLIENT_SECRET_FILE,
        )

    class Config:
        env_file = str(ENV_FILE)
        extra = "ignore"

settings = Settings()
