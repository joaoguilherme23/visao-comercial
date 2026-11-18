// ── KpiCardCount — layout idêntico ao MockKpiCard da /dev/brand seção 15.1 ──
import { Gauge } from 'lucide-react'
import type { HistoricoPoint, KpiResult } from '../../../api/dashboard'
import { ICON_MAP } from '../constants'
import { splitValue } from '../utils'
import { isTier1 } from '../kpiTiers'

interface KpiCardCountProps {
  kpi: KpiResult
  sparkData?: HistoricoPoint[]
  accentColor?: string
  onDrill?: () => void
}

function formatDelta(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1).replace('.', ',')}%`
}

/** Sparkline SVG manual — mesma implementação do MockSparkline da BrandPage. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 220
  const h = 40
  if (values.length === 0) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = w / (values.length - 1 || 1)
  const points = values
    .map((v, i) => `${(i * step).toFixed(2)},${(h - ((v - min) / range) * h).toFixed(2)}`)
    .join(' ')
  const areaPoints = `0,${h} ${points} ${w},${h}`
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polygon points={areaPoints} fill={color} opacity={0.12} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function KpiCardCount({ kpi, sparkData, onDrill }: KpiCardCountProps) {
  const Icon = ICON_MAP[kpi.icone ?? ''] ?? Gauge
  const { number } = splitValue(kpi.valor, kpi.formato)

  const hasVariacao = kpi.variacao_pct != null
  const positivo = (kpi.variacao_pct ?? 0) >= 0
  const tier1 = isTier1(kpi.slug)
  const deltaColor = tier1 ? '#10E088' : positivo ? '#10E088' : '#ef4444'
  const sparkColor = tier1 ? '#10E088' : positivo ? '#0b9692' : '#ef4444'

  // Slugs que se derivam honestamente do histórico de `novos_leads` (fluxo
  // diário → cumulative sum = curva de crescimento do total). São contagens
  // cumulativas de leads. Outros KPIs (score médio, percentuais, etc) não
  // derivam de novos_leads — nesses, escondemos sparkline pra não inventar.
  const CUMULATIVE_FROM_NOVOS_LEADS = new Set([
    'total_leads',
    'leads_ativos',
    'leads_identificados',
    'leads_sem_etapa',
    'leads_com_cidade',
    'leads_recorrentes',
    'leads_com_followup',
  ])
  const cumulative = CUMULATIVE_FROM_NOVOS_LEADS.has(kpi.slug)
  const rawValues = (sparkData ?? []).map(p => Number(p.novos_leads ?? 0))
  const sparkValues = cumulative
    ? rawValues.reduce<number[]>((acc, v) => {
        acc.push((acc[acc.length - 1] ?? 0) + v)
        return acc
      }, [])
    : rawValues
  const hasSpark = cumulative && sparkValues.length > 1

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
        className="font-outfit font-bold mb-1"
        style={{ fontSize: '2rem', color: 'var(--text-1)', lineHeight: 1 }}
      >
        {number}
      </p>
      {hasVariacao && (
        <p className="text-xs" style={{ color: deltaColor }}>
          <span className="font-semibold">{formatDelta(kpi.variacao_pct ?? 0)}</span>
          <span className="ml-1.5 font-mono-data" style={{ color: 'var(--text-3)' }}>
            vs. anterior
          </span>
        </p>
      )}
      {hasSpark && (
        <div className="mt-4">
          <Sparkline values={sparkValues} color={sparkColor} />
        </div>
      )}
    </div>
  )
}
