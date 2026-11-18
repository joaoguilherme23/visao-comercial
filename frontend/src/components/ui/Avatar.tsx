import { useState } from 'react'
import { resolveAvatarUrl } from '../../lib/avatarUrl'

interface Props {
  /** foto_url vinda do backend (path relativo ou null). */
  fotoUrl?: string | null
  /** Nome — usado pra fallback (inicial) e alt text. */
  nome?: string | null
  /** Tamanho do avatar em pixels. Default 40. */
  size?: number
  /** Classe extra (ex: borda, ring). */
  className?: string
  /** Cor de fundo do fallback (caso não queira usar var(--brand-glow)). */
  fallbackBg?: string
  /** Cor do texto do fallback. */
  fallbackColor?: string
  /** Fonte de inicial — quando nome vier vazio, usa este caractere. */
  fallbackChar?: string
  /** Estilos adicionais */
  style?: React.CSSProperties
}

/**
 * Avatar com fallback gracioso:
 *   1. Se fotoUrl existe e carrega → mostra <img>
 *   2. Se erro 404/load → fallback com inicial colorida
 *   3. Se nunca teve fotoUrl → fallback direto
 *
 * Centraliza o tratamento de URL relativa (resolveAvatarUrl).
 */
export default function Avatar({
  fotoUrl,
  nome,
  size = 40,
  className = '',
  fallbackBg = 'var(--brand-glow)',
  fallbackColor = 'var(--brand-500)',
  fallbackChar,
  style,
}: Props) {
  const [errored, setErrored] = useState(false)
  const url = resolveAvatarUrl(fotoUrl)
  const showImg = !!url && !errored
  const initial = (
    fallbackChar ??
    (nome ?? '').trim().charAt(0).toUpperCase() ??
    '?'
  ) || '?'

  const baseStyle: React.CSSProperties = {
    width: size,
    height: size,
    fontSize: size * 0.4,
    flexShrink: 0,
    ...style,
  }

  if (showImg) {
    return (
      <img
        src={url}
        alt={nome ?? 'Avatar'}
        className={`rounded-full object-cover ${className}`}
        style={baseStyle}
        onError={() => setErrored(true)}
        loading="lazy"
      />
    )
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold ${className}`}
      style={{
        ...baseStyle,
        background: fallbackBg,
        color: fallbackColor,
      }}
      role="img"
      aria-label={nome ?? 'Avatar'}
    >
      {initial}
    </div>
  )
}
