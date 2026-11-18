import { useEffect, useRef } from 'react'
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react'

type ConfirmVariant = 'danger' | 'warning' | 'info'

export interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  variant?: ConfirmVariant
  title: string
  description?: string | React.ReactNode
  bullets?: string[]
  confirmLabel?: string
  cancelLabel?: string
  isLoading?: boolean
}

const VARIANT_CONFIG: Record<ConfirmVariant, { icon: typeof AlertTriangle; color: string; confirmBg: string; confirmBgHover: string }> = {
  danger:  { icon: AlertTriangle, color: '#ef4444', confirmBg: '#ef4444', confirmBgHover: '#dc2626' },
  warning: { icon: AlertCircle,   color: '#facc15', confirmBg: '#ca8a04', confirmBgHover: '#a16207' },
  info:    { icon: Info,          color: '#25c8bd', confirmBg: 'var(--brand-500)', confirmBgHover: 'var(--brand-600)' },
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  variant = 'danger',
  title,
  description,
  bullets,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isLoading = false,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const cfg = VARIANT_CONFIG[variant]
  const Icon = cfg.icon

  useEffect(() => {
    if (!open) return
    // focus no Cancel ao abrir
    cancelRef.current?.focus()
    // ESC fecha
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isLoading, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
        onClick={() => !isLoading && onClose()}
      />
      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-2xl p-6"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
          animation: 'slideUp 150ms ease-out',
        }}
      >
        {/* Header com ícone */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${cfg.color}20`, border: `1px solid ${cfg.color}40` }}
          >
            <Icon size={20} style={{ color: cfg.color }} />
          </div>
          <div className="flex-1 pt-1">
            <h2 id="confirm-title" className="text-base font-semibold" style={{ color: 'var(--text-1)' }}>
              {title}
            </h2>
          </div>
          {!isLoading && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-white/5 transition-colors"
              aria-label="Fechar"
            >
              <X size={16} style={{ color: 'var(--text-3)' }} />
            </button>
          )}
        </div>

        {/* Description */}
        {description && (
          <div className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>
            {description}
          </div>
        )}

        {/* Bullets */}
        {bullets && bullets.length > 0 && (
          <ul className="space-y-1.5 mb-4">
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
                <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full" style={{ background: cfg.color }} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Destructive hint */}
        {variant === 'danger' && (
          <p className="text-xs italic mb-4" style={{ color: 'var(--text-4)' }}>
            Esta ação não pode ser desfeita.
          </p>
        )}

        {/* Footer */}
        <div className="flex gap-2 justify-end mt-2">
          <button
            ref={cancelRef}
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              background: 'transparent',
              color: 'var(--text-2)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: cfg.confirmBg }}
            onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = cfg.confirmBgHover }}
            onMouseLeave={e => { e.currentTarget.style.background = cfg.confirmBg }}
          >
            {isLoading ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
