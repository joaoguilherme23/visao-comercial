import { Link } from 'react-router-dom'
import { MessageSquare, Kanban, BarChart3, LucideIcon } from 'lucide-react'
import { linkToConversa, linkToKanban, linkToDashboard } from '../../lib/leadLinks'

type ActionTarget = 'conversa' | 'kanban' | 'dashboard'

interface OpenActionsProps {
  /** UUID do lead (obrigatório pros chips de Conversa e Kanban). */
  leadId: string
  /** Mostra chip "Abrir conversa" (default true). */
  showConversa?: boolean
  /** Mostra chip "Ver no Kanban" (default true). */
  showKanban?: boolean
  /** Mostra chip "Ver no Dashboard" (default false). */
  showDashboard?: boolean
  /** Oculta o chip da tela atual — evita auto-link. */
  excludeCurrent?: ActionTarget
  /** Classes extras pro container flex. */
  className?: string
}

interface ChipSpec {
  target: ActionTarget
  to: string
  label: string
  icon: LucideIcon
}

/**
 * Chips horizontais pra navegação entre as 3 telas do lead (Conversa / Kanban /
 * Dashboard). Usa `<Link>` → permite Ctrl+click pra abrir em nova aba.
 *
 * Design: 22px de altura, ícone 10px, fontes 11px. Estilo "quiet":
 * bg neutro + border sutil, aplica glow indigo no hover.
 */
export default function OpenActions({
  leadId,
  showConversa = true,
  showKanban = true,
  showDashboard = false,
  excludeCurrent,
  className,
}: OpenActionsProps) {
  const all: ChipSpec[] = [
    showConversa && {
      target: 'conversa' as const,
      to: linkToConversa(leadId, { highlight: true }),
      label: 'Abrir conversa',
      icon: MessageSquare,
    },
    showKanban && {
      target: 'kanban' as const,
      to: linkToKanban(leadId, { highlight: true }),
      label: 'Ver no Kanban',
      icon: Kanban,
    },
    showDashboard && {
      target: 'dashboard' as const,
      to: linkToDashboard(),
      label: 'Ver no Dashboard',
      icon: BarChart3,
    },
  ].filter((c): c is ChipSpec => Boolean(c))

  const chips = all.filter((c) => c.target !== excludeCurrent)
  if (chips.length === 0) return null

  const wrapperClassName = ['flex items-center gap-1.5 flex-wrap', className ?? '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={wrapperClassName}>
      {chips.map((chip) => {
        const Icon = chip.icon
        return (
          <Link
            key={chip.target}
            to={chip.to}
            aria-label={chip.label}
            title={chip.label}
            className="inline-flex items-center gap-1 font-medium transition-all"
            style={{
              height: 22,
              padding: '0 8px',
              borderRadius: 6,
              fontSize: 11,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-2)',
              textDecoration: 'none',
              lineHeight: 1,
            }}
            onClick={(e) => {
              e.stopPropagation()
            }}
            onPointerDown={(e) => {
              e.stopPropagation()
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget
              el.style.background = 'rgba(11,150,146,0.08)'
              el.style.borderColor = 'rgba(11,150,146,0.35)'
              el.style.color = '#25c8bd'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              el.style.background = 'var(--bg-card)'
              el.style.borderColor = 'var(--border-subtle)'
              el.style.color = 'var(--text-2)'
            }}
          >
            <Icon size={10} />
            {chip.label}
          </Link>
        )
      })}
    </div>
  )
}
