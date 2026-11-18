import { useState } from 'react'
import { Clock, ChevronDown } from 'lucide-react'
import { Popover } from '../ds'
import type { SnoozePreset } from '../../types'

interface Props {
  onSelect: (preset: SnoozePreset) => void
  disabled?: boolean
}

const OPTIONS: Array<{ preset: SnoozePreset; label: string; subtitle?: string }> = [
  { preset: '1h', label: '1 hora' },
  { preset: '3h', label: '3 horas' },
  { preset: '6h', label: '6 horas' },
  { preset: '1d', label: 'Amanhã', subtitle: '24h' },
  { preset: '3d', label: '3 dias' },
]

/**
 * Botão "Soneca" — popover com 5 presets de tempo. Após escolha, dispara
 * `onSelect(preset)` e fecha. A página chama o backend e remove o card
 * com animação de saída.
 */
export default function SnoozeMenu({ onSelect, disabled }: Props) {
  const [open, setOpen] = useState(false)

  function pick(p: SnoozePreset) {
    onSelect(p)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      side="top"
      align="start"
      width={180}
      trigger={
        <button
          type="button"
          disabled={disabled}
          aria-label="Sonecar este card"
          title="Adormecer card temporariamente"
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors disabled:opacity-40"
          style={{
            background: open ? 'rgba(11,150,146,0.08)' : 'transparent',
            color: open ? '#25c8bd' : 'var(--text-3)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Clock size={11} />
          Soneca
          <ChevronDown size={10} />
        </button>
      }
    >
      <div className="py-1">
        <p
          className="px-3 py-1.5 text-[10px] uppercase tracking-wider"
          style={{ color: 'var(--text-3)' }}
        >
          Ocultar por
        </p>
        {OPTIONS.map((opt) => (
          <button
            key={opt.preset}
            type="button"
            onClick={() => pick(opt.preset)}
            className="w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors"
            style={{ color: 'var(--text-1)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(11,150,146,0.06)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span>{opt.label}</span>
            {opt.subtitle && (
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                {opt.subtitle}
              </span>
            )}
          </button>
        ))}
      </div>
    </Popover>
  )
}
