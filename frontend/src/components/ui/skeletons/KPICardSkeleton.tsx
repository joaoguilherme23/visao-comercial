import Skeleton from '../Skeleton'

/**
 * Skeleton para KPIs do strip Top-8. Mantém o mesmo footprint (altura/width)
 * pra não causar jump quando os dados reais chegarem.
 *
 * Layout final alvo (Fase 4):
 *   [icon 32x32]           [+12% pill]
 *   [NÚMERO GRANDE]
 *   [label]
 *   [sparkline 28px]
 */
export default function KPICardSkeleton() {
  return (
    <div className="card-surface rounded-xl p-5">
      {/* Top row — icon + variação pill */}
      <div className="flex items-center justify-between mb-3">
        <Skeleton width={32} height={32} />
        <Skeleton width={56} height={22} shape="pill" />
      </div>
      {/* Número grande */}
      <Skeleton width="60%" height={28} className="mb-2" />
      {/* Label */}
      <Skeleton width="80%" height={11} className="mb-3" />
      {/* Sparkline */}
      <Skeleton width="100%" height={28} />
    </div>
  )
}
