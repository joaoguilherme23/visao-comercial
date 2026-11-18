"""
Serviço de envio de email transacional via SMTP (aiosmtplib).

Três fluxos suportados:
  1. send_invite       — convite de primeiro acesso (admin criou o usuário)
  2. send_reset        — redefinição de senha solicitada pelo usuário
  3. send_password_changed — confirmação após senha redefinida com sucesso
"""
from __future__ import annotations

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.core.config import settings

logger = logging.getLogger(__name__)

# ─── helpers ────────────────────────────────────────────────────────────────

def _base_html(title: str, body: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#0f0f14;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
               style="background:#1a1a24;border-radius:16px;border:1px solid #2a2a3a;overflow:hidden;">
          <!-- header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6d47f5,#8b5cf6);padding:28px 32px;">
              <span style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">X9 Kanban</span>
            </td>
          </tr>
          <!-- body -->
          <tr>
            <td style="padding:32px;color:#c8c8d8;font-size:15px;line-height:1.6;">
              {body}
            </td>
          </tr>
          <!-- footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #2a2a3a;">
              <p style="margin:0;font-size:12px;color:#555570;">
                X9 Kanban · Análise inteligente de conversas WhatsApp<br/>
                Este email foi enviado automaticamente. Não responda a esta mensagem.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _cta_button(href: str, label: str) -> str:
    return (
        f'<a href="{href}" '
        'style="display:inline-block;margin-top:24px;padding:14px 28px;'
        'background:linear-gradient(135deg,#6d47f5,#8b5cf6);'
        'color:#fff;text-decoration:none;border-radius:10px;'
        'font-size:15px;font-weight:600;">'
        f'{label}</a>'
    )


async def _send(to_email: str, subject: str, html: str, plain: str) -> None:
    if not settings.SMTP_HOST:
        logger.warning("[email_service] SMTP_HOST não configurado — email não enviado")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM}>"
    msg["To"] = to_email
    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        if settings.SMTP_PORT == 25:
            # Relay local Docker — smtplib nativo, zero TLS
            def _relay() -> None:
                with smtplib.SMTP(settings.SMTP_HOST, 25, timeout=20) as s:
                    s.sendmail(msg["From"], [to_email], msg.as_string())

            await asyncio.get_event_loop().run_in_executor(None, _relay)
        else:
            # Porta 465 = SSL implícito | 587 = STARTTLS
            await aiosmtplib.send(
                msg,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USER or None,
                password=settings.SMTP_PASSWORD or None,
                use_tls=(settings.SMTP_PORT == 465),
                start_tls=(settings.SMTP_PORT == 587) or None,
                timeout=20,
            )
        logger.info("[email_service] Email enviado")
    except Exception as exc:
        logger.error("[email_service] Falha ao enviar email: %s", exc)


# ─── templates públicos ─────────────────────────────────────────────────────

async def send_invite(nome: str, to_email: str, token: str) -> None:
    """Email de convite — enviado quando o admin cria um usuário novo."""
    link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    subject = "Seu acesso ao X9 Kanban foi criado"
    body = f"""
      <p>Olá, <strong style="color:#fff;">{nome}</strong>!</p>
      <p>Sua conta no <strong style="color:#fff;">X9 Kanban</strong> foi criada.
         Clique no botão abaixo para definir sua senha e acessar a plataforma.</p>
      <p>O link é válido por <strong style="color:#fff;">2 horas</strong>.</p>
      {_cta_button(link, "Definir minha senha")}
      <p style="margin-top:24px;font-size:13px;color:#777790;">
        Se você não esperava esse email, ignore-o com segurança.
      </p>
    """
    plain = (
        f"Olá, {nome}!\n\n"
        "Sua conta no X9 Kanban foi criada.\n"
        f"Acesse o link abaixo para definir sua senha (válido por 2 horas):\n\n{link}\n\n"
        "Se você não esperava esse email, ignore-o."
    )
    await _send(to_email, subject, _base_html(subject, body), plain)


async def send_reset(nome: str, to_email: str, token: str) -> None:
    """Email de redefinição de senha — solicitado pelo próprio usuário."""
    link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    subject = "Redefinição de senha — X9 Kanban"
    body = f"""
      <p>Olá, <strong style="color:#fff;">{nome}</strong>!</p>
      <p>Recebemos uma solicitação para redefinir a senha da sua conta no
         <strong style="color:#fff;">X9 Kanban</strong>.</p>
      <p>Clique no botão abaixo para criar uma nova senha.
         O link é válido por <strong style="color:#fff;">2 horas</strong>.</p>
      {_cta_button(link, "Redefinir minha senha")}
      <p style="margin-top:24px;font-size:13px;color:#777790;">
        Se você não solicitou a redefinição, ignore este email.
        Sua senha atual permanece inalterada.
      </p>
    """
    plain = (
        f"Olá, {nome}!\n\n"
        "Recebemos uma solicitação para redefinir a senha da sua conta no X9 Kanban.\n"
        f"Acesse o link abaixo (válido por 2 horas):\n\n{link}\n\n"
        "Se você não solicitou isso, ignore este email."
    )
    await _send(to_email, subject, _base_html(subject, body), plain)


async def send_password_changed(nome: str, to_email: str) -> None:
    """Email de confirmação após a senha ser redefinida com sucesso."""
    subject = "Senha alterada com sucesso — X9 Kanban"
    login_link = f"{settings.FRONTEND_URL}/login"
    body = f"""
      <p>Olá, <strong style="color:#fff;">{nome}</strong>!</p>
      <p>Sua senha no <strong style="color:#fff;">X9 Kanban</strong> foi alterada com sucesso.</p>
      <p>Caso você não tenha feito essa alteração, entre em contato imediatamente
         com o administrador do sistema.</p>
      {_cta_button(login_link, "Acessar o X9 Kanban")}
    """
    plain = (
        f"Olá, {nome}!\n\n"
        "Sua senha no X9 Kanban foi alterada com sucesso.\n"
        "Se você não fez essa alteração, contate o administrador do sistema imediatamente.\n\n"
        f"Acesse a plataforma: {login_link}"
    )
    await _send(to_email, subject, _base_html(subject, body), plain)
