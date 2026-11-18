import type { KpiResult, HistoricoPoint } from '../../../api/dashboard'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../constants'
import KpiCard from '../cards/KpiCard'

// ── Category section divider ──────────────────────────────────────────────────
export default function CategorySection({
  category,
  kpis,
  sparkData,
  onDrill,
}: {
  category: string
  kpis: KpiResult[]
  sparkData?: HistoricoPoint[]
  onDrill?: (kpi: KpiResult) => void
}) {
  if (kpis.length === 0) return null
  const label = CATEGORY_LABELS[category] ?? category
  const catColor = CATEGORY_COLORS[category] ?? 'var(--brand-500)'
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-1 h-4 rounded-full" style={{ background: catColor }} />
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: catColor }}>{label}</p>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <span className="text-xs text-gray-600">{kpis.length} KPI{kpis.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <KpiCard key={kpi.slug} kpi={kpi} sparkData={sparkData} accentColor={catColor} onDrill={onDrill ? () => onDrill(kpi) : undefined} />
        ))}
      </div>
    </div>
  )
}
