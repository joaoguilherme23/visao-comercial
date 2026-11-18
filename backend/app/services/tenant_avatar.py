"""
Upload manual de logo/avatar do tenant (cliente).

Diferente do `avatar_service.py` (que sincroniza fotos do WhatsApp via
UAZAPI), aqui o admin do cliente OU superadmin envia direto um arquivo
do computador. Salva em /app/storage/avatars/tenants/<id>/<ts>.<ext>
e atualiza Cliente.foto_url com o path relativo /avatars/tenants/...

Reusa o mesmo storage root + URL prefix do avatar_service pra ter UMA
única pasta servida pelo nginx/StaticFiles.
"""
from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Cliente

# Storage root igual ao avatar_service — pasta única, servida em /avatars
STORAGE_ROOT = Path(os.environ.get("AVATAR_STORAGE_ROOT", "/app/storage")) / "avatars" / "tenants"
PUBLIC_PREFIX = "/avatars/tenants"

MAX_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_MIMES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
ALLOWED_EXT = {"jpg", "jpeg", "png", "webp"}


def _ext_from_mime(mime: str) -> str:
    return {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }.get(mime.split(";")[0].strip().lower(), "jpg")


async def upload_tenant_avatar(
    db: AsyncSession,
    cliente_id: UUID,
    file: UploadFile,
) -> str:
    """Salva o arquivo enviado e atualiza Cliente.foto_url.

    Retorna a URL pública relativa (ex: '/avatars/tenants/<id>/<ts>.jpg').
    """
    # Valida MIME
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_MIMES:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo inválido: {content_type}. Aceito: jpg, png, webp",
        )

    # Lê bytes (com limite de tamanho)
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Arquivo muito grande ({len(data)} bytes). Máximo: {MAX_BYTES // 1024 // 1024} MB",
        )
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Arquivo vazio")

    # Verifica que o cliente existe
    res = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = res.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    # Cria pasta e escreve arquivo
    ts = int(time.time())
    ext = _ext_from_mime(content_type)
    folder = STORAGE_ROOT / str(cliente_id)
    folder.mkdir(parents=True, exist_ok=True)
    filename = f"{ts}.{ext}"
    full_path = folder / filename
    full_path.write_bytes(data)

    # Atualiza Cliente.foto_url
    rel_url = f"{PUBLIC_PREFIX}/{cliente_id}/{filename}"
    cliente.foto_url = rel_url
    await db.flush()
    await db.refresh(cliente)

    return rel_url


async def delete_tenant_avatar(
    db: AsyncSession,
    cliente_id: UUID,
) -> None:
    """Remove o foto_url do cliente (não deleta arquivo do disco — é barato).

    Idempotente: se já estava NULL, não faz nada.
    """
    res = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = res.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    cliente.foto_url = None
    await db.flush()
    await db.refresh(cliente)
