"""
Serviço de integração com a API Uazapi (WhatsApp).
Documentação dos endpoints: .claude/instancia.md
"""
import re

import httpx
from typing import Optional

from app.core.config import settings


class UazapiError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class UazapiService:
    def __init__(
        self,
        base_url: Optional[str] = None,
        admin_token: Optional[str] = None,
    ):
        configured_url = getattr(settings, "UAZAPI_BASE_URL", "") if base_url is None else base_url
        self.base_url = configured_url.rstrip("/")
        self.admin_token = (getattr(settings, "UAZAPI_ADMIN_TOKEN", "") if admin_token is None else admin_token).strip()

    def _headers(self, token: str) -> dict:
        return {"token": token, "Content-Type": "application/json"}

    def _admin_headers(self) -> dict:
        if not self.admin_token:
            raise UazapiError("Serviço Uazapi indisponível", 503)
        return {"admintoken": self.admin_token, "Content-Type": "application/json"}

    # ------------------------------------------------------------------
    # Admin — gerenciamento de instâncias
    # ------------------------------------------------------------------

    async def create_instance(self, name: str) -> dict:
        """
        Cria uma nova instância Uazapi.
        Endpoint correto: POST /instance/create (header admintoken)
        Retorna payload com token em data["token"] e data["instance"]["token"].
        """
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.base_url}/instance/create",
                headers=self._admin_headers(),
                json={"name": name},
            )
            if resp.status_code == 409:
                raise UazapiError("Instância já existe com este nome", 409)
            if resp.status_code == 401:
                raise UazapiError("Token de administrador inválido", 401)
            if not resp.is_success:
                raise UazapiError(
                    "Falha ao criar instância Uazapi", resp.status_code
                )
            return resp.json()

    # ------------------------------------------------------------------
    # Instância — operações de conexão
    # ------------------------------------------------------------------

    async def connect(
        self, token: str, phone: Optional[str] = None, history_days: Optional[int] = None,
    ) -> dict:
        """
        Inicia o processo de conexão com o WhatsApp.
        - Sem phone: gera QR code para escanear com o app
        - Com phone: gera código de pareamento (digitado no WhatsApp)
        """
        body: dict = {}
        if phone:
            body["phone"] = phone
        if history_days is not None:
            body["history_days"] = max(1, min(int(history_days), 90))

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.base_url}/instance/connect",
                headers=self._headers(token),
                json=body,
            )
            if resp.status_code == 401:
                raise UazapiError("Token inválido ou expirado", 401)
            if resp.status_code == 404:
                raise UazapiError("Instância não encontrada na Uazapi", 404)
            if resp.status_code == 429:
                raise UazapiError("Limite de conexões simultâneas atingido", 429)
            if not resp.is_success:
                raise UazapiError(
                    "Falha ao iniciar conexão Uazapi", resp.status_code
                )
            return resp.json()

    async def get_webhooks(self, token: str) -> list[dict]:
        """List destinations before adding ours; no delete/replace operation exists here."""
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{self.base_url}/webhook", headers=self._headers(token))
            if resp.status_code == 401:
                raise UazapiError("Token da instância inválido ou expirado", 401)
            if not resp.is_success:
                raise UazapiError("Falha ao consultar webhooks Uazapi", resp.status_code)
            data = resp.json()
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
        if isinstance(data, dict) and isinstance(data.get("webhooks"), list):
            return [item for item in data["webhooks"] if isinstance(item, dict)]
        return []

    async def add_webhook(self, token: str, url: str) -> dict:
        """Add the X9 destination while preserving all provider-owned destinations."""
        payload = {
            "action": "add",
            "enabled": True,
            "url": url,
            "events": ["connection", "history", "messages", "messages_update"],
            "excludeMessages": ["wasSentByApi"],
        }
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{self.base_url}/webhook", headers=self._headers(token), json=payload,
            )
            if resp.status_code == 401:
                raise UazapiError("Token da instância inválido ou expirado", 401)
            if not resp.is_success:
                raise UazapiError("Falha ao adicionar webhook Uazapi", resp.status_code)
            return resp.json() if resp.content else {}

    async def update_webhook(self, token: str, webhook_id: str, url: str) -> dict:
        """Repair only the X9 destination identified by its own provider id."""
        payload = {
            "action": "update",
            "id": webhook_id,
            "enabled": True,
            "url": url,
            "events": ["connection", "history", "messages", "messages_update"],
            "excludeMessages": ["wasSentByApi"],
        }
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{self.base_url}/webhook", headers=self._headers(token), json=payload,
            )
            if resp.status_code == 401:
                raise UazapiError("Token da instância inválido ou expirado", 401)
            if not resp.is_success:
                raise UazapiError("Falha ao atualizar webhook Uazapi", resp.status_code)
            return resp.json() if resp.content else {}

    async def find_messages(self, token: str, *, limit: int, offset: int) -> dict:
        """Read only the provider's already-stored messages, newest first."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.base_url}/message/find",
                headers=self._headers(token),
                json={"limit": limit, "offset": offset},
            )
            if resp.status_code == 401:
                raise UazapiError("Token da instância inválido ou expirado", 401)
            if not resp.is_success:
                raise UazapiError("Falha ao consultar mensagens Uazapi", resp.status_code)
            data = resp.json()
        if not isinstance(data, dict) or not isinstance(data.get("messages"), list):
            raise UazapiError("Resposta de mensagens Uazapi inválida", 502)
        return data

    async def get_status(self, token: str) -> dict:
        """
        Retorna o estado atual da instância.
        Inclui QR code atualizado quando status = 'connecting'.

        Estados possíveis:
          - disconnected: desconectado
          - connecting:   aguardando QR / código de pareamento
          - connected:    autenticado e pronto
        """
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{self.base_url}/instance/status",
                headers=self._headers(token),
            )
            if resp.status_code == 401:
                raise UazapiError("Token inválido ou expirado", 401)
            if resp.status_code == 404:
                raise UazapiError("Instância não encontrada na Uazapi", 404)
            if not resp.is_success:
                raise UazapiError(
                    "Falha ao consultar status Uazapi", resp.status_code
                )
            return resp.json()

    async def disconnect(self, token: str) -> dict:
        """
        Encerra a sessão WhatsApp da instância.
        Exige novo QR code para reconectar.
        """
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{self.base_url}/instance/disconnect",
                headers=self._headers(token),
            )
            if not resp.is_success:
                raise UazapiError(
                    "Falha ao desconectar instância Uazapi", resp.status_code
                )
            return resp.json() if resp.content else {}

    async def delete_instance(self, token: str) -> dict:
        """Remove completamente a instância da Uazapi."""
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.delete(
                f"{self.base_url}/instance",
                headers=self._headers(token),
            )
            if not resp.is_success:
                raise UazapiError(
                    "Falha ao excluir instância Uazapi", resp.status_code
                )
            return resp.json() if resp.content else {}

    # ------------------------------------------------------------------
    # Helper — extrai QR code de qualquer formato que a Uazapi retornar
    # ------------------------------------------------------------------

    @staticmethod
    def extract_qr(payload: dict) -> Optional[str]:
        """
        Extrai o QR code do payload da Uazapi.
        Estrutura real: payload["instance"]["qrcode"] → "data:image/png;base64,..."
        Tenta posições alternativas para robustez.
        """
        # Posição principal (confirmada por teste real)
        instance = payload.get("instance")
        if isinstance(instance, dict):
            qr = instance.get("qrcode") or instance.get("qr_code")
            if qr and isinstance(qr, str):
                return qr

        # Fallbacks na raiz
        for key in ("qrcode", "qr_code", "qr", "base64"):
            val = payload.get(key)
            if val and isinstance(val, str):
                return val

        return None

    @staticmethod
    def extract_status(payload: dict) -> str:
        """
        Extrai e normaliza o status do payload da Uazapi.

        Estrutura real confirmada por probe:
          GET /instance/status →
            { "instance": {"status": "disconnected|connecting|connected", ...},
              "status": {"connected": bool, "jid": ..., "loggedIn": bool} }

          POST /instance/connect →
            { "connected": false, "loggedIn": false,
              "instance": {"status": "connecting", "qrcode": "data:image/png;..."},
              "status": {"connected": false, ...} }

        Fonte primária: instance.status (string — sempre presente e confiável).
        Fonte secundária: status.connected / status.loggedIn (bools no objeto aninhado).
        """
        # 1. Fonte mais confiável: instance.status
        instance = payload.get("instance")
        if isinstance(instance, dict):
            st = instance.get("status", "")
            if isinstance(st, str) and st:
                return st.lower()

        # 2. Fallback: objeto "status" aninhado ({"connected": bool, "loggedIn": bool})
        nested = payload.get("status")
        if isinstance(nested, dict):
            if nested.get("connected") is True or nested.get("loggedIn") is True:
                return "connected"

        # 3. Campos bool na raiz (payload do /connect)
        if payload.get("loggedIn") is True:
            return "connected"

        return "disconnected"

    @staticmethod
    def extract_phone(payload: dict) -> str | None:
        """
        Extrai o número de telefone conectado.
        Quando logado, jid pode ser "554199999999:device@s.whatsapp.net".
        O sufixo de dispositivo não faz parte do telefone cadastrado.
        """
        def phone_from_personal_jid(value: object, *, allow_bare_phone: bool = False) -> str | None:
            if not isinstance(value, str):
                return None

            local, separator, domain = value.partition("@")
            if not separator:
                return value if allow_bare_phone and re.fullmatch(r"\d{7,15}", value) else None
            if domain not in {"s.whatsapp.net", "c.us"}:
                return None

            phone, device_separator, device = local.partition(":")
            if device_separator and (not device or not device.isdecimal()):
                return None
            return phone if re.fullmatch(r"\d{7,15}", phone) else None

        # status.jid (objeto aninhado)
        nested = payload.get("status")
        if isinstance(nested, dict):
            phone = phone_from_personal_jid(nested.get("jid"))
            if phone:
                return phone

        # raiz
        phone = phone_from_personal_jid(payload.get("jid"))
        if phone:
            return phone

        # instance.owner
        instance = payload.get("instance")
        if isinstance(instance, dict):
            return phone_from_personal_jid(instance.get("owner"), allow_bare_phone=True)

        return None


    async def chat_details(self, token: str, number: str) -> dict:
        """
        POST /chat/details — retorna metadata de um chat (lead ou grupo).
        Resposta inclui campos image (full) e imagePreview (menor).

        Args:
            token: token da instância UAZAPI (não admin)
            number: WhatsApp do contato (lead) ou JID do grupo (com ou sem @g.us)

        Returns:
            dict com pelo menos `image`, `imagePreview`. Pode ser {} se contato
            não tem foto pública.
        """
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{self.base_url}/chat/details",
                headers=self._headers(token),
                json={"number": number, "preview": False},
            )
            if resp.status_code == 401:
                raise UazapiError("Token UAZAPI inválido", 401)
            if resp.status_code == 404:
                # Sem detalhes pra esse número — retorna vazio em vez de erro
                return {}
            if not resp.is_success:
                raise UazapiError(
                    "Falha ao consultar detalhes do chat Uazapi", resp.status_code
                )
            return resp.json()


# Singleton — reutilizado em todos os endpoints
uazapi = UazapiService()
