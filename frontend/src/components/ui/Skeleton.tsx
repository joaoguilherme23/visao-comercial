import { CSSProperties } from 'react'
import { cn } from '../../lib/cn'

interface SkeletonProps {
  className?: string
  /** Altura — aceita qualquer valor CSS (px, rem, %). Default: 1rem. */
  height?: number | string
  /** Largura — aceita qualquer valor CSS. Default: 100%. */
  width?: number | string
  /** Forma do shimmer. */
  shape?: 'rect' | 'circle' | 'pill'
  style?: CSSProperties
}

/**
 * Primitiva de loading. Respeita `prefers-reduced-motion` (classe
 * `animate-shimmer` é desligada no media query, mas mantém o bg).
 *
 * Regra de ouro: skeleton deve ocupar a MESMA altura que o conteúdo final
 * pra evitar layout shift quando os dados chegarem.
 */
export default function Skeleton({
  className,
  height = '1rem',
  width = '100%',
  shape = 'rect',
  style,
}: SkeletonProps) {
  const radius =
    shape === 'circle' ? '9999px' : shape === 'pill' ? '9999px' : '6px'
  return (
    <div
      aria-hidden
      className={cn('animate-shimmer', className)}
      style={{
        height,
        width,
        borderRadius: radius,
        background: 'var(--skeleton-base)',
        ...style,
      }}
    />
  )
}
