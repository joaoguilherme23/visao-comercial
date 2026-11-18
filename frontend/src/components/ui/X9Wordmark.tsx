/**
 * Assinatura da marca Visão Comercial.
 *
 * Renderiza "Visão Comercial" em Outfit 800.
 * (indigo → violeta). Uso em: login hero, sidebar logo, footer,
 * hero moments institucionais.
 *
 * Regra: "X" em text-1 sólido + "9" como text-gradient-brand.
 * Tamanho ajustável via prop fontSize.
 *
 * Ver /dev/brand seção 4 (Wordmark) pra especificação completa.
 */
interface X9WordmarkProps {
  /** Tamanho em px ou rem. Default '1rem'. */
  fontSize?: string
  /** Letter-spacing. Default '-0.01em' (tight). */
  letterSpacing?: string
  /** Cor do "X". Default 'currentColor'. */
  color?: string
  /**
   * Variante visual:
   * - 'gradient' (default): "X" sólido + "9" em gradient-brand.
   *   Uso em contextos sobre fundo sólido (sidebar, título, footer).
   * - 'solid': marca inteira na `color` prop. Uso quando já está
   *   renderizado sobre um gradient (ex: card quadrado do login).
   */
  variant?: 'gradient' | 'solid'
  className?: string
}

export function X9Wordmark({
  fontSize = '1rem',
  letterSpacing = '-0.01em',
  color = 'currentColor',
  variant = 'gradient',
  className = '',
}: X9WordmarkProps) {
  if (variant === 'solid') {
    return (
      <span
        className={`font-outfit font-black ${className}`}
        style={{ fontSize, letterSpacing, lineHeight: 1, color }}
        aria-label="Visão Comercial"
      >
        Visão Comercial
      </span>
    )
  }
  return (
    <span
      className={`font-outfit font-black ${className}`}
      style={{ fontSize, letterSpacing, lineHeight: 1, color }}
      aria-label="Visão Comercial"
    >
      Visão Comercial
    </span>
  )
}
