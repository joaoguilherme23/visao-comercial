// ── KpiCard do TopStrip — layout idêntico ao MockKpiCard ──────────────────
import { LucideIcon, Gauge } from 'lucide-react'
import type { HistoricoPoint, KpiResult } from '../../api/dashboard'
import VariationPill from './VariationPill'
import { isTier1 } from './kpiTiers'

interface KpiCardProps {
  kpi: KpiResult
  iconMap?: Record<string, LucideIcon>
  sparkData?: HistoricoPoint[]
  onDrill?: (kpi: KpiResult) => void
  inverseVariation?: boolean
}

function formatDelta(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1).replace('.', ',')}%`
}

/** Sparkline SVG manual — mesma implementação do MockSparkline da BrandPage. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 220
  const h = 32
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

export default function KpiCard({
  kpi,
  iconMap = {},
  sparkData,
  onDrill,
  inverseVariation = false,
}: KpiCardProps) {
  const Icon: LucideIcon = iconMap[kpi.icone ?? ''] ?? Gauge
  const isPercent = kpi.formato === 'percent'
  const isText = kpi.formato === 'text'
  const numericVal = typeof kpi.valor === 'number' ? kpi.valor : parseFloat(String(kpi.valor)) || 0

  let displayValue: string
  if (isText) {
    displayValue = typeof kpi.valor === 'string' ? kpi.valor : String(kpi.valor)
  } else if (isPercent) {
    displayValue = `${numericVal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  } else {
    displayValue = numericVal.toLocaleString('pt-BR')
  }

  const tier1 = isTier1(kpi.slug)
  const positivo = (kpi.variacao_pct ?? 0) >= 0
  const deltaColor = tier1 ? '#10E088' : positivo ? '#10E088' : '#ef4444'
  const sparkColor = tier1 ? '#10E088' : positivo ? 'var(--brand-500)' : '#ef4444'

  // Sparkline é honesto apenas em slugs que derivam de novos_leads via
  // cumulative sum (curva de crescimento). Outros KPIs (score, urgência,
  // predominante, etc) não se derivam desse histórico — escondemos.
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
  const showSparkline = cumulative && sparkValues.length > 1

  return (
    <div
      className="rounded-2xl p-4 cursor-pointer"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
      onClick={() => onDrill?.(kpi)}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center justify-between mb-2">
        <p
          className="text-[10px] font-semibold uppercase tracking-wider truncate min-w-0"
          style={{ color: 'var(--text-3)' }}
          title={kpi.descricao}
        >
          {kpi.nome}
        </p>
        <Icon size={14} style={{ color: 'var(--text-3)' }} className="shrink-0" />
      </div>
      <p
        className="font-outfit font-bold mb-1"
        style={{ fontSize: '1.5rem', color: 'var(--text-1)', lineHeight: 1 }}
      >
        {displayValue || '—'}
      </p>
      {kpi.variacao_pct != null && (
        <p className="text-[11px]" style={{ color: deltaColor }}>
          <span className="font-semibold">{formatDelta(kpi.variacao_pct ?? 0)}</span>
          <span className="ml-1.5 font-mono-data" style={{ color: 'var(--text-3)' }}>
            vs. anterior
          </span>
        </p>
      )}
      {showSparkline ? (
        <div className="mt-3">
          <Sparkline values={sparkValues} color={sparkColor} />
        </div>
      ) : (
        inverseVariation && <VariationPill value={kpi.variacao_pct} inverse={inverseVariation} />
      )}
    </div>
  )
}
