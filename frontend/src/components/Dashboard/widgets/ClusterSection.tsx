import type { KpiResult, HistoricoPoint } from '../../../api/dashboard'
import KpiCard from '../cards/KpiCard'
import type { ClusterMeta } from '../kpiClusters'

/**
 * Section header narrativo + grid de KPI cards, pro agrupamento COMERCIAL
 * do dashboard (6 clusters: pulso / urgência / inteligência / conversão /
 * perfil / operacional). Substitui o CategorySection técnico em layout,
 * mantendo o mesmo KpiCard.
 */
export default function ClusterSection({
  meta,
  kpis,
  sparkData,
  onDrill,
}: {
  meta: ClusterMeta
  kpis: KpiResult[]
  sparkData?: HistoricoPoint[]
  onDrill?: (kpi: KpiResult) => void
}) {
  if (kpis.length === 0) return null

  return (
    <section>
      {/* Header narrativo: barra lateral colorida + título + subtítulo + contador */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-1 h-5 rounded-full" style={{ background: meta.color }} />
        <div className="flex items-baseline gap-2 min-w-0">
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: meta.color }}
          >
            {meta.label}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            · {meta.subtitle}
          </p>
        </div>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <span className="text-xs" style={{ color: 'var(--text-3)' }}>
          {kpis.length} KPI{kpis.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid de cards — mesmo padrão do CategorySection pra consistência */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <KpiCard
            key={kpi.slug}
            kpi={kpi}
            sparkData={sparkData}
            accentColor={meta.color}
            onDrill={onDrill ? () => onDrill(kpi) : undefined}
          />
        ))}
      </div>
    </section>
  )
}
