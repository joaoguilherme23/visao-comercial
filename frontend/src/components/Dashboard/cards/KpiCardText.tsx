// ── KpiCardText — layout alinhado ao MockKpiCard da /dev/brand ───────────
// KPI em formato text (categoria predominante — string curta).
import { Hash } from 'lucide-react'
import type { KpiResult } from '../../../api/dashboard'
import { ICON_MAP } from '../constants'

interface KpiCardTextProps {
  kpi: KpiResult
  accentColor?: string
  onDrill?: () => void
}

export default function KpiCardText({ kpi, onDrill }: KpiCardTextProps) {
  const Icon = ICON_MAP[kpi.icone ?? ''] ?? Hash
  const cor = 'var(--brand-500)'
  const displayValue = typeof kpi.valor === 'string' ? kpi.valor : String(kpi.valor)
  const fontSize = displayValue.length > 14 ? '1.25rem' : displayValue.length > 8 ? '1.5rem' : '2rem'

  return (
    <div
      className={`rounded-2xl p-5${onDrill ? ' cursor-pointer' : ''}`}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
      onClick={onDrill}
    >
      <div className="flex items-center justify-between mb-3">
        <p
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-3)' }}
          title={kpi.descricao}
        >
          {kpi.nome}
        </p>
        <Icon size={16} style={{ color: 'var(--text-3)' }} />
      </div>
      <p
        className="font-outfit font-bold break-words"
        style={{ fontSize, color: cor, lineHeight: 1.1 }}
      >
        {displayValue || '—'}
      </p>
    </div>
  )
}
