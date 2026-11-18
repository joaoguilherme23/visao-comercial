// ── KpiCardPercent — layout idêntico ao MockKpiCard da /dev/brand ──────────
// KPIs em formato percent. Sem sparkline (valores 0-100 são pontuais).
import { Gauge } from 'lucide-react'
import type { KpiResult } from '../../../api/dashboard'
import { ICON_MAP } from '../constants'
import RadialGauge from '../charts/RadialGauge'
import { isTier1 } from '../kpiTiers'

interface KpiCardPercentProps {
  kpi: KpiResult
  accentColor?: string
  onDrill?: () => void
}

function formatDelta(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1).replace('.', ',')}%`
}

export default function KpiCardPercent({ kpi, onDrill }: KpiCardPercentProps) {
  const Icon = ICON_MAP[kpi.icone ?? ''] ?? Gauge
  const cor = 'var(--brand-500)'
  const numericVal = typeof kpi.valor === 'number' ? kpi.valor : parseFloat(String(kpi.valor)) || 0
  const gaugeColor = numericVal >= 70 ? '#10E088' : numericVal >= 40 ? '#fb923c' : cor

  const hasVariacao = kpi.variacao_pct != null
  const positivo = (kpi.variacao_pct ?? 0) >= 0
  const tier1 = isTier1(kpi.slug)
  const deltaColor = tier1 ? '#10E088' : positivo ? '#10E088' : '#ef4444'

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
      <div className="flex items-baseline gap-1 mb-1">
        <p
          className="font-outfit font-bold"
          style={{ fontSize: '2rem', color: 'var(--text-1)', lineHeight: 1 }}
        >
          {numericVal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
        </p>
        <span className="text-base" style={{ color: 'var(--text-3)' }}>%</span>
      </div>
      {hasVariacao && (
        <p className="text-xs" style={{ color: deltaColor }}>
          <span className="font-semibold">{formatDelta(kpi.variacao_pct ?? 0)}</span>
          <span className="ml-1.5 font-mono-data" style={{ color: 'var(--text-3)' }}>
            vs. anterior
          </span>
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <RadialGauge value={numericVal} color={gaugeColor} />
      </div>
    </div>
  )
}
