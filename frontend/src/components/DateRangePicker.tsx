import { useState, useEffect } from 'react'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  subDays,
  isAfter,
  isValid,
  parseISO,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar, ChevronDown, X } from 'lucide-react'
import { Popover } from './ds'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface DateRange {
  inicio: Date
  fim: Date
}

interface DateRangePickerProps {
  value: DateRange | null
  onChange: (range: DateRange | null) => void
  className?: string
  /** Compact mode: renders as a button-with-popover, ideal for narrow sidebars */
  compact?: boolean
  /** When true, shows a clear (×) button in compact mode. `onChange(null)` will fire on clear. */
  clearable?: boolean
  /** Placeholder text shown in compact mode when value is null. */
  placeholder?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toInputValue(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

function fromInputValue(s: string): Date | null {
  if (!s) return null
  const d = parseISO(s)
  return isValid(d) ? d : null
}

function displayDate(d: Date): string {
  return format(d, 'dd/MM/yyyy', { locale: ptBR })
}

function shortDate(d: Date): string {
  return format(d, 'dd/MM', { locale: ptBR })
}

// ── Presets ───────────────────────────────────────────────────────────────────
function buildPresets(): { label: string; range: () => DateRange }[] {
  const now = new Date()
  return [
    {
      label: 'Hoje',
      range: () => ({ inicio: startOfDay(now), fim: endOfDay(now) }),
    },
    {
      label: 'Ontem',
      range: () => {
        const y = subDays(now, 1)
        return { inicio: startOfDay(y), fim: endOfDay(y) }
      },
    },
    {
      label: 'Últimos 7 dias',
      range: () => ({ inicio: startOfDay(subDays(now, 6)), fim: endOfDay(now) }),
    },
    {
      label: 'Últimos 30 dias',
      range: () => ({ inicio: startOfDay(subDays(now, 29)), fim: endOfDay(now) }),
    },
    {
      label: 'Este mês',
      range: () => ({ inicio: startOfMonth(now), fim: endOfMonth(now) }),
    },
    {
      label: 'Mês anterior',
      range: () => {
        const prev = subMonths(now, 1)
        return { inicio: startOfMonth(prev), fim: endOfMonth(prev) }
      },
    },
  ]
}

export function DateRangePicker({
  value,
  onChange,
  className = '',
  compact = false,
  clearable = false,
  placeholder = 'Selecionar período',
}: DateRangePickerProps) {
  const today = new Date()
  // Fallback apenas para inicializar os inputs quando value é null — não é aplicado ao parent.
  const fallback: DateRange = value ?? { inicio: startOfDay(today), fim: endOfDay(today) }
  const [startInput, setStartInput] = useState(toInputValue(fallback.inicio))
  const [endInput, setEndInput]     = useState(toInputValue(fallback.fim))
  const [open, setOpen]             = useState(false)

  // Sync inputs when parent value changes externally
  useEffect(() => {
    if (value) {
      setStartInput(toInputValue(value.inicio))
      setEndInput(toInputValue(value.fim))
    }
  }, [value])

  const applied = value ? `${displayDate(value.inicio)} — ${displayDate(value.fim)}` : placeholder
  const shortApplied = value ? `${shortDate(value.inicio)} — ${shortDate(value.fim)}` : placeholder

  function shiftMonth(delta: number) {
    // Referência: início do mês da data FIM (representa o mês visível atual).
    // Usar value.inicio causava navegação errada — ex: de "semana abril 7–11",
    // < dava março e > dava maio, sem caminho para "abril completo".
    const ref   = value ? startOfMonth(value.fim) : startOfMonth(today)
    const base  = delta < 0 ? subMonths(ref, 1) : addMonths(ref, 1)
    const inicio = startOfMonth(base)
    const fim    = endOfMonth(base)
    setStartInput(toInputValue(inicio))
    setEndInput(toInputValue(fim))
    onChange({ inicio, fim })
  }

  function handleApply() {
    const start = fromInputValue(startInput)
    const end   = fromInputValue(endInput)
    if (!start || !end || isAfter(start, end)) return
    onChange({ inicio: start, fim: end })
    if (compact) setOpen(false)
  }

  function applyPreset(range: DateRange) {
    setStartInput(toInputValue(range.inicio))
    setEndInput(toInputValue(range.fim))
    onChange(range)
    if (compact) setOpen(false)
  }

  const isLightTheme =
    typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme') === 'light'
      : false

  // ── Compact mode: button + popover ──────────────────────────────────────────
  if (compact) {
    const presets = buildPresets()
    const hasValue = value !== null
    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange(null)
      setOpen(false)
    }
    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <Popover
          open={open}
          onOpenChange={setOpen}
          side="bottom"
          align="start"
          width={288}
          aria-label="Selecionar período"
          trigger={
            <button
              className="flex items-center gap-1.5 h-7 px-2 rounded-lg text-[10px] font-medium transition-all"
              style={{
                background: open ? 'var(--bg-elevated)' : 'var(--bg-card)',
                border: `1px solid ${open ? '#4c6ef5' : 'var(--border-subtle)'}`,
                color: hasValue ? 'var(--text-1)' : 'var(--text-3)',
              }}
              title={hasValue ? 'Alterar período' : placeholder}
            >
              <Calendar size={11} style={{ color: '#25c8bd' }} />
              <span className="leading-none">{shortApplied}</span>
              <ChevronDown
                size={11}
                style={{
                  color: 'var(--text-3)',
                  transform: open ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform 150ms',
                }}
              />
            </button>
          }
        >
          <div className="overflow-hidden rounded-xl">
            {/* Popover header */}
            <div
              className="flex items-center justify-between px-3 py-2"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                Período
              </span>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-white/5 transition-colors"
                style={{ color: 'var(--text-3)' }}
              >
                <X size={12} />
              </button>
            </div>

            {/* Presets */}
            <div className="p-2 grid grid-cols-2 gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p.range())}
                  className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all text-left"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-1)',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(11,150,146,0.12)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(11,150,146,0.35)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-subtle)'
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid var(--border-subtle)' }} />

            {/* Custom range */}
            <div className="p-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                Personalizado
              </p>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  className="flex-1 h-8 rounded-lg border px-2 text-xs outline-none transition-colors"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-1)',
                    colorScheme: isLightTheme ? 'light' : 'dark',
                  }}
                />
                <span style={{ color: 'var(--text-4)' }}>—</span>
                <input
                  type="date"
                  value={endInput}
                  min={startInput || undefined}
                  onChange={(e) => setEndInput(e.target.value)}
                  className="flex-1 h-8 rounded-lg border px-2 text-xs outline-none transition-colors"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-1)',
                    colorScheme: isLightTheme ? 'light' : 'dark',
                  }}
                />
              </div>
              <button
                onClick={handleApply}
                className="w-full h-8 rounded-lg text-xs font-semibold transition-all"
                style={{ background: '#3b5bdb', color: '#fff' }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.background = '#4c6ef5'
                  el.style.boxShadow = 'var(--glow-brand-sm)'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.background = '#3b5bdb'
                  el.style.boxShadow = 'none'
                }}
              >
                Aplicar intervalo
              </button>
            </div>
          </div>
        </Popover>

        {clearable && hasValue && (
          <button
            onClick={handleClear}
            className="p-1 rounded-md transition-colors"
            style={{ color: 'var(--text-3)' }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elevated)'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#f87171'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)'
            }}
            title="Remover filtro de período"
            aria-label="Remover filtro de período"
          >
            <X size={11} />
          </button>
        )}
      </div>
    )
  }

  // ── Default: inline horizontal layout ───────────────────────────────────────
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-3)' }}
      >
        Período
      </span>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Prev month */}
        <button
          onClick={() => shiftMonth(-1)}
          className="flex items-center justify-center w-7 h-8 rounded-lg border transition-colors duration-150"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-3)',
          }}
          title="Mês anterior"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Start date input */}
        <input
          type="date"
          value={startInput}
          onChange={e => setStartInput(e.target.value)}
          className="h-8 rounded-lg border px-2 text-sm outline-none transition-colors duration-150"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-1)',
            colorScheme: isLightTheme ? 'light' : 'dark',
          }}
        />

        <span style={{ color: 'var(--text-4)' }}>—</span>

        {/* End date input */}
        <input
          type="date"
          value={endInput}
          min={startInput || undefined}
          onChange={e => setEndInput(e.target.value)}
          className="h-8 rounded-lg border px-2 text-sm outline-none transition-colors duration-150"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-1)',
            colorScheme: isLightTheme ? 'light' : 'dark',
          }}
        />

        {/* Next month */}
        <button
          onClick={() => shiftMonth(1)}
          className="flex items-center justify-center w-7 h-8 rounded-lg border transition-colors duration-150"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-3)',
          }}
          title="Próximo mês"
        >
          <ChevronRight size={14} />
        </button>

        {/* Apply */}
        <button
          onClick={handleApply}
          className="h-8 px-4 rounded-lg text-sm font-semibold transition-all duration-150"
          style={{ background: '#3b5bdb', color: '#fff' }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLButtonElement
            el.style.background = '#4c6ef5'
            el.style.boxShadow = 'var(--glow-brand-sm)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLButtonElement
            el.style.background = '#3b5bdb'
            el.style.boxShadow = 'none'
          }}
        >
          Aplicar
        </button>

        {/* Applied range display */}
        <span className="text-sm" style={{ color: 'var(--text-3)' }}>
          {applied}
        </span>
      </div>
    </div>
  )
}
