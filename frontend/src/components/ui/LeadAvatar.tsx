import { useState } from 'react'
import {
  semanticColors,
  semanticColorsSoft,
  normalizeTemperatura,
} from '../../lib/semanticColors'
import { resolveAvatarUrl } from '../../lib/avatarUrl'

interface LeadAvatarProps {
  /** Nome do lead — pra gerar iniciais. Fallback: whatsapp/'?'. */
  name?: string | null
  /** Número de telefone — usado como fallback se nome vier vazio. */
  fallback?: string | null
  /** Temperatura pra pintar o anel. Aceita PT ou EN, case-insensitive. */
  temperatura?: string | null
  /** Tamanho total em px. Default: 32. */
  size?: number
  /**
   * URL de foto absoluta — se passada, prevalece. Mantido por compatibilidade.
   * Em código novo, prefira `fotoUrl` (path relativo do backend).
   */
  src?: string | null
  /** Path relativo retornado pelo backend (ex: "/avatars/leads/<id>/<ts>.jpg"). */
  fotoUrl?: string | null
  className?: string
}

/**
 * Avatar circular com iniciais + anel colorido pela temperatura do lead.
 * Usa `semanticColors.temperatura` como fonte de verdade.
 *
 * Exemplo:
 *   <LeadAvatar name="João Silva" temperatura="quente" />
 *   → anel vermelho + "JS"
 */
export default function LeadAvatar({
  name,
  fallback,
  temperatura,
  size = 32,
  src,
  fotoUrl,
  className,
}: LeadAvatarProps) {
  const [imgError, setImgError] = useState(false)
  const tempKey = normalizeTemperatura(temperatura)
  // Anel + background derivados da paleta semântica; sem temperatura = slate.
  const ring = tempKey ? semanticColors.temperatura[tempKey] : 'var(--border-muted)'
  const bg   = tempKey ? semanticColorsSoft.temperatura[tempKey] : 'var(--bg-elevated)'
  const text = tempKey ? semanticColors.temperatura[tempKey] : 'var(--text-2)'

  const label = (name?.trim() || fallback?.trim() || '').toString()
  const initials = getInitials(label)
  const resolvedUrl = src ?? resolveAvatarUrl(fotoUrl)
  const showImg = !!resolvedUrl && !imgError

  // Ring é um box-shadow inset pra não alterar a caixa do layout.
  // Quando tem foto, o ring vira "outset" (border externa) pra a img preencher
  // o círculo inteiro sem ficar com gap branco no meio.
  const style: React.CSSProperties = {
    width: size,
    height: size,
    background: bg,
    color: text,
    fontSize: Math.max(10, Math.round(size * 0.38)),
    boxShadow: showImg
      ? `0 0 0 2px ${ring}`
      : `inset 0 0 0 2px ${ring}`,
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full font-semibold flex-shrink-0 select-none overflow-hidden ${className ?? ''}`}
      style={style}
      aria-label={name ? `Avatar de ${name}` : 'Avatar do lead'}
    >
      {showImg ? (
        <img
          src={resolvedUrl}
          alt=""
          width={size}
          height={size}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        initials || '?'
      )}
    </div>
  )
}

function getInitials(label: string): string {
  if (!label) return ''
  // Pega primeira letra da primeira palavra + primeira letra da última palavra.
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
