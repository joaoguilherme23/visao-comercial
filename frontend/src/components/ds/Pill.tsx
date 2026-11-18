import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Tone, Variant, pillStyle } from './Pill.tokens'

export interface PillProps {
  children: React.ReactNode
  tone?: Tone
  variant?: Variant
  size?: 'xs' | 'sm' | 'md'
  dot?: boolean
  icon?: LucideIcon
  mono?: boolean
  className?: string
  title?: string
  'aria-label'?: string
  onClick?: () => void
}

const SIZE_CLASSES: Record<NonNullable<PillProps['size']>, string> = {
  xs: 'text-[10px] px-1.5 py-0.5 gap-1',
  sm: 'text-xs px-2 py-0.5 gap-1.5',
  md: 'text-sm px-2.5 py-1 gap-1.5',
}

export const Pill = forwardRef<HTMLSpanElement, PillProps>(function Pill(
  { children, tone = 'neutral', variant = 'soft', size = 'sm', dot, icon: Icon, mono, className = '', title, onClick, ...aria },
  ref,
) {
  const s = pillStyle(tone, variant)
  const interactive = !!onClick
  const iconSize = size === 'xs' ? 10 : size === 'sm' ? 12 : 14
  const clickable = interactive ? 'cursor-pointer transition-opacity hover:opacity-80' : ''
  const fontFamily = mono ? 'ui-monospace, monospace' : undefined
  return (
    <span
      ref={ref}
      className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${SIZE_CLASSES[size]} ${clickable} ${className}`}
      style={{
        background: s.bg,
        color: s.color,
        border: s.border,
        fontFamily,
      }}
      title={title}
      onClick={onClick}
      {...aria}
    >
      {dot && (
        <span
          className="rounded-full shrink-0"
          style={{
            width: size === 'xs' ? 5 : 6,
            height: size === 'xs' ? 5 : 6,
            background: 'currentColor',
          }}
        />
      )}
      {Icon && <Icon size={iconSize} className="shrink-0" />}
      {children}
    </span>
  )
})
