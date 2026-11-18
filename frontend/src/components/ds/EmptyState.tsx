import { Link } from 'react-router-dom'
import { CheckCircle2, Info, Inbox, AlertCircle, LucideIcon } from 'lucide-react'

type EmptyVariant = 'success' | 'info' | 'empty' | 'error'

interface EmptyStateAction {
  label: string
  onClick?: () => void
  href?: string
  variant?: 'primary' | 'secondary'
}

export interface EmptyStateProps {
  variant?: EmptyVariant
  icon?: LucideIcon
  title: string
  description?: string
  action?: EmptyStateAction
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const DEFAULTS: Record<EmptyVariant, { icon: LucideIcon; color: string }> = {
  // `success` é Tier 1 (momento de marca / confirmação) → usa signal-success-500
  // da Fase 2 (#10E088). Não confundir com KPI/sentimento positivo (Tier 2, #22c55e).
  success: { icon: CheckCircle2, color: '#10E088' },
  info:    { icon: Info,         color: '#25c8bd' },
  empty:   { icon: Inbox,        color: 'var(--text-4)' },
  error:   { icon: AlertCircle,  color: '#ef4444' },
}

const SIZE_PADDING: Record<NonNullable<EmptyStateProps['size']>, { pad: string; iconSize: number; titleSize: string; descSize: string }> = {
  sm: { pad: 'py-6 px-4', iconSize: 20, titleSize: 'text-sm',  descSize: 'text-xs'  },
  md: { pad: 'py-12 px-6', iconSize: 28, titleSize: 'text-base', descSize: 'text-sm' },
  lg: { pad: 'py-24 px-8', iconSize: 40, titleSize: 'text-xl',  descSize: 'text-sm' },
}

export function EmptyState({
  variant = 'empty',
  icon,
  title,
  description,
  action,
  size = 'md',
  className = '',
}: EmptyStateProps) {
  const def = DEFAULTS[variant]
  const Icon = icon ?? def.icon
  const sz = SIZE_PADDING[size]
  const isLarge = size === 'lg'

  return (
    <div className={`flex flex-col items-center text-center ${sz.pad} ${className}`}>
      {/* ícone com halo para variantes success/error em size lg */}
      <div
        className="flex items-center justify-center rounded-full mb-3"
        style={{
          width: sz.iconSize * 2,
          height: sz.iconSize * 2,
          background: isLarge && (variant === 'success' || variant === 'error') ? `${def.color}15` : 'transparent',
        }}
      >
        <Icon size={sz.iconSize} style={{ color: def.color }} />
      </div>
      <h3 className={`${sz.titleSize} font-semibold`} style={{ color: 'var(--text-1)' }}>
        {title}
      </h3>
      {description && (
        <p className={`${sz.descSize} mt-1 max-w-md`} style={{ color: 'var(--text-3)' }}>
          {description}
        </p>
      )}
      {action && (
        <div className="mt-4">
          {action.href ? (
            <Link
              to={action.href}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: action.variant === 'primary' ? 'var(--brand-500)' : 'transparent',
                color: action.variant === 'primary' ? '#fff' : 'var(--text-2)',
                border: action.variant === 'primary' ? 'none' : '1px solid var(--border-subtle)',
              }}
            >
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: action.variant === 'primary' ? 'var(--brand-500)' : 'transparent',
                color: action.variant === 'primary' ? '#fff' : 'var(--text-2)',
                border: action.variant === 'primary' ? 'none' : '1px solid var(--border-subtle)',
              }}
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
