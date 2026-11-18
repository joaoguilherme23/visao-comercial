import Skeleton from '../Skeleton'

interface ChartPanelSkeletonProps {
  /** Altura do placeholder do gráfico. Default: 240 (mesma do EvolucaoAnualPanel). */
  chartHeight?: number
  /** Se true, desenha seletores fake no topo. */
  withControls?: boolean
}

/**
 * Skeleton para painéis grandes do Dashboard (Evolução, Histórico, Horário).
 * Replica: header (título + controles) + área de chart com barras/linhas.
 */
export default function ChartPanelSkeleton({
  chartHeight = 240,
  withControls = true,
}: ChartPanelSkeletonProps) {
  const alturas = [44, 62, 56, 78, 66, 84, 72, 58, 70, 86, 64, 78]
  return (
    <div className="card-surface p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Skeleton width={180} height={14} />
        {withControls && (
          <div className="flex gap-2">
            <Skeleton width={80} height={28} />
            <Skeleton width={140} height={28} />
          </div>
        )}
      </div>
      {/* Chart area — barras irregulares */}
      <div className="flex items-end gap-2" style={{ height: chartHeight }}>
        {alturas.map((h, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end gap-1">
            <Skeleton width="100%" height={`${h}%`} />
            <Skeleton width="100%" height={7} />
          </div>
        ))}
      </div>
    </div>
  )
}
