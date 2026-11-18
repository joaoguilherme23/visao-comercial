"""
Avatar service — sincroniza fotos de perfil do WhatsApp.

Fluxo por entidade (lead OU grupo):
  1. Busca metadata via UAZAPI POST /chat/details (usa token do primeiro
     numeros_bot ativo do tenant)
  2. Pega URL da foto (campo `image`, com fallback `imagePreview`)
  3. Baixa o binário (HTTP GET)
  4. Salva no storage local em /app/storage/avatars/<tipo>/<uuid>/<ts>.<ext>
  5. Atualiza coluna foto_url do registro com path relativo (/avatars/...)

URL pública: o nginx do container x9-frontend tem location /avatars/
apontando pro mesmo bind-mount, servindo com cache HTTP de 30d.

Anti-pattern evitado: NÃO salva BLOB no Postgres (mata replicação,
infla pg_dump, perde browser cache).

Rate-limit: 800ms entre chamadas UAZAPI reais. Skips (já tem foto)
não consomem chamada.
"""
from __future__ import annotations

import asyncio
import os
import time
import uuid
from pathlib import Path
from typing import Literal, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lead import Lead
from app.models.grupo import Grupo
from app.models.numero import NumeroBot
from app.services.uazapi import uazapi, UazapiError

# ── Config ──────────────────────────────────────────────────────────────────

# Pasta raiz do storage no container local. Override via env var.
STORAGE_ROOT = Path(os.environ.get("AVATAR_STORAGE_ROOT", "/app/storage")) / "avatars"
# Prefixo da URL pública dos avatares.
# Em dev: backend serve direto via StaticFiles em /avatars (mesma origem do API).
# O frontend monta a URL a partir do mesmo host da API.
PUBLIC_PREFIX = "/avatars"
MAX_BYTES = 5 * 1024 * 1024  # 5 MB hard cap por foto
DELAY_BETWEEN_CALLS_S = 0.8  # rate-limit UAZAPI
MAX_BATCH = 30


# ── Tipos ───────────────────────────────────────────────────────────────────

EntidadeTipo = Literal["leads", "grupos"]


class AvatarSkip(Exception):
    """Levantado quando a sincronização é pulada (sem foto, sem token, etc)."""

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


# ── Helpers ─────────────────────────────────────────────────────────────────


def _ext_from_mime(mime: str | None) -> str:
    """jpg/png/webp/gif a partir do Content-Type."""
    if not mime:
        return "jpg"
    mime = mime.split(";")[0].strip().lower()
    return {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
    }.get(mime, "jpg")


async def _get_token_for_tenant(db: AsyncSession, cliente_id: uuid.UUID) -> str:
    """
    Pega o uazapi_token da primeira instância ATIVA do tenant.
    Levanta AvatarSkip se não houver instância utilizável.
    """
    result = await db.execute(
        select(NumeroBot).where(
            NumeroBot.cliente_id == cliente_id,
            NumeroBot.ativo == True,
        )
    )
    numeros = list(result.scalars().all())
    if not numeros:
        raise AvatarSkip("empresa sem número WhatsApp ativo")
    for n in numeros:
        token = (n.config or {}).get("uazapi_token")
        if token:
            return token
    raise AvatarSkip("número sem uazapi_token configurado")


async def _download_image(url: str) -> tuple[bytes, str]:
    """Baixa a imagem e retorna (bytes, content_type)."""
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        resp = await client.get(url)
        if not resp.is_success:
            raise AvatarSkip(f"download da foto falhou ({resp.status_code})")
        if int(resp.headers.get("content-length", "0") or 0) > MAX_BYTES:
            raise AvatarSkip("foto maior que 5MB — pulando")
        content = resp.content
        if len(content) > MAX_BYTES:
            raise AvatarSkip("foto maior que 5MB — pulando")
        ctype = resp.headers.get("content-type", "image/jpeg")
        return content, ctype


def _save_to_disk(
    tipo: EntidadeTipo,
    entidade_id: uuid.UUID,
    content: bytes,
    ext: str,
) -> str:
    """
    Salva no disco e retorna o path relativo (servido pelo nginx).

    Estrutura: <STORAGE_ROOT>/<tipo>/<id>/<ts>.<ext>
    URL:       /avatars/<tipo>/<id>/<ts>.<ext>
    """
    folder = STORAGE_ROOT / tipo / str(entidade_id)
    folder.mkdir(parents=True, exist_ok=True)
    ts = int(time.time())
    filename = f"{ts}.{ext}"
    full_path = folder / filename
    full_path.write_bytes(content)
    # Retorna URL pública (servida pelo nginx do x9-frontend)
    return f"{PUBLIC_PREFIX}/{tipo}/{entidade_id}/{filename}"


# ── Sync individual ─────────────────────────────────────────────────────────


async def sync_lead(
    db: AsyncSession,
    lead_id: uuid.UUID,
    *,
    force: bool = False,
    token: Optional[str] = None,
) -> dict:
    """
    Sincroniza foto de 1 lead.

    Returns:
        {status: "ok"|"skipped"|"no_avatar"|"failed", url?, reason?}
    """
    lead = (await db.execute(select(Lead).where(Lead.id == lead_id))).scalar_one_or_none()
    if not lead:
        return {"status": "failed", "reason": "lead não encontrado"}
    if not lead.whatsapp:
        return {"status": "skipped", "reason": "sem whatsapp"}
    if lead.foto_url and not force:
        return {"status": "skipped", "reason": "já tem foto"}

    try:
        if not token:
            token = await _get_token_for_tenant(db, lead.cliente_id)
        details = await uazapi.chat_details(token, lead.whatsapp)
        url = details.get("image") or details.get("imagePreview")
        if not url:
            return {"status": "no_avatar", "reason": "WhatsApp sem foto pública"}
        content, mime = await _download_image(url)
        ext = _ext_from_mime(mime)
        public_url = _save_to_disk("leads", lead.id, content, ext)
        lead.foto_url = public_url
        await db.flush()
        return {"status": "ok", "url": public_url}
    except AvatarSkip as e:
        return {"status": "skipped", "reason": e.reason}
    except UazapiError as e:
        return {"status": "failed", "reason": f"uazapi: {e.message}"}
    except Exception as e:
        return {"status": "failed", "reason": str(e)[:200]}


async def sync_grupo(
    db: AsyncSession,
    grupo_id: uuid.UUID,
    *,
    force: bool = False,
    token: Optional[str] = None,
) -> dict:
    """Mesma lógica de sync_lead, pra grupos. JID com ou sem @g.us."""
    grupo = (await db.execute(select(Grupo).where(Grupo.id == grupo_id))).scalar_one_or_none()
    if not grupo:
        return {"status": "failed", "reason": "grupo não encontrado"}
    if not grupo.whatsapp:
        return {"status": "skipped", "reason": "sem whatsapp"}
    if grupo.foto_url and not force:
        return {"status": "skipped", "reason": "já tem foto"}

    # JID de grupo precisa do sufixo @g.us pra UAZAPI reconhecer
    jid = grupo.whatsapp
    if "@" not in jid:
        jid = f"{jid}@g.us"

    try:
        if not token:
            token = await _get_token_for_tenant(db, grupo.cliente_id)
        details = await uazapi.chat_details(token, jid)
        url = details.get("image") or details.get("imagePreview")
        if not url:
            return {"status": "no_avatar", "reason": "grupo sem foto pública"}
        content, mime = await _download_image(url)
        ext = _ext_from_mime(mime)
        public_url = _save_to_disk("grupos", grupo.id, content, ext)
        grupo.foto_url = public_url
        await db.flush()
        return {"status": "ok", "url": public_url}
    except AvatarSkip as e:
        return {"status": "skipped", "reason": e.reason}
    except UazapiError as e:
        return {"status": "failed", "reason": f"uazapi: {e.message}"}
    except Exception as e:
        return {"status": "failed", "reason": str(e)[:200]}


# ── Sync em batch ───────────────────────────────────────────────────────────


async def sync_batch(
    db: AsyncSession,
    cliente_id: uuid.UUID,
    tipo: EntidadeTipo,
    ids: list[uuid.UUID],
    *,
    force: bool = False,
) -> dict:
    """
    Sincroniza N entidades do mesmo tenant em batch.
    Aplica rate-limit de 800ms entre chamadas reais à UAZAPI.

    Returns:
        {summary: {total, ok, skipped, no_avatar, failed}, results: [...]}
    """
    if not ids:
        return {
            "summary": {"total": 0, "ok": 0, "skipped": 0, "no_avatar": 0, "failed": 0},
            "results": [],
        }
    if len(ids) > MAX_BATCH:
        raise ValueError(f"batch máximo é {MAX_BATCH}")

    # Token resolvido 1x — todos os ids são do mesmo cliente_id
    try:
        token = await _get_token_for_tenant(db, cliente_id)
    except AvatarSkip as e:
        # Sem token, todos viram skip — não chama UAZAPI
        return {
            "summary": {
                "total": len(ids),
                "ok": 0,
                "skipped": len(ids),
                "no_avatar": 0,
                "failed": 0,
            },
            "results": [
                {"id": str(i), "status": "skipped", "reason": e.reason} for i in ids
            ],
        }

    syncer = sync_lead if tipo == "leads" else sync_grupo
    results: list[dict] = []
    counts = {"ok": 0, "skipped": 0, "no_avatar": 0, "failed": 0}
    last_call_ms = 0.0

    for entity_id in ids:
        # Rate-limit: 800ms entre chamadas reais. Skips não consomem delay.
        # Pra saber se vai consumir, fazemos pré-check: se já tem foto,
        # processOne retorna skipped sem bater na UAZAPI.
        result = await syncer(db, entity_id, force=force, token=token)
        results.append({"id": str(entity_id), **result})
        counts[result["status"]] = counts.get(result["status"], 0) + 1
        # Aguarda só se foi uma chamada real (ok / no_avatar / failed)
        if result["status"] in ("ok", "no_avatar", "failed"):
            await asyncio.sleep(DELAY_BETWEEN_CALLS_S)

    return {
        "summary": {"total": len(ids), **counts},
        "results": results,
    }


# ── Sync de TODOS os leads/grupos do tenant (ação "Sincronizar tudo") ───────


async def sync_all_pending(
    db: AsyncSession,
    cliente_id: uuid.UUID,
    tipo: EntidadeTipo,
    *,
    limit: int = MAX_BATCH,
) -> dict:
    """
    Pega os primeiros N registros do tenant SEM foto_url e sincroniza.
    Usado pelo botão "Sincronizar fotos pendentes" no admin.
    """
    if tipo == "leads":
        q = (
            select(Lead.id)
            .where(
                Lead.cliente_id == cliente_id,
                Lead.foto_url.is_(None),
                Lead.whatsapp.isnot(None),
                Lead.ativo == True,
            )
            .order_by(Lead.created_at.desc())
            .limit(limit)
        )
    else:
        q = (
            select(Grupo.id)
            .where(
                Grupo.cliente_id == cliente_id,
                Grupo.foto_url.is_(None),
            )
            .order_by(Grupo.ultima_interacao.desc().nullslast())
            .limit(limit)
        )
    rows = (await db.execute(q)).all()
    ids = [r[0] for r in rows]
    return await sync_batch(db, cliente_id, tipo, ids, force=False)
