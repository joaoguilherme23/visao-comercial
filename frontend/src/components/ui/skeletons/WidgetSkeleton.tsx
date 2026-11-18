import Skeleton from '../Skeleton'

type TipoGrafico =
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'metric'
  | 'table'
  | 'funnel'
  | 'treemap'

interface WidgetSkeletonProps {
  /** Tipo do gráfico — escolhe a forma visual do placeholder. Default: 'bar'. */
  tipo?: TipoGrafico
  /** Altura do skeleton — mesma regra do WidgetRenderer (160px em metric/table, 200+ em charts). */
  height?: number
}

/**
 * Skeleton que replica o layout visual do WidgetRenderer por tipo_grafico.
 * A ideia é que a "silhueta" do loader pareça com o gráfico final — reduz
 * ansiedade e dá contexto do que está carregando.
 */
export default function WidgetSkeleton({ tipo = 'bar', height = 200 }: WidgetSkeletonProps) {
  if (tipo === 'metric') {
    return (
      <div className="flex flex-col items-center justify-center gap-2" style={{ height: 160 }}>
        <Skeleton width={120} height={40} />
        <Skeleton width={80} height={10} />
      </div>
    )
  }

  if (tipo === 'table') {
    return (
      <div className="space-y-2 py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton width={16} height={10} />
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex justify-between">
                <Skeleton width="50%" height={10} />
                <Skeleton width={32} height={10} />
              </div>
              <Skeleton width={`${90 - i * 12}%`} height={4} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (tipo === 'pie' || tipo === 'donut') {
    return (
      <div className="flex items-center gap-4" style={{ height }}>
        {/* Lista lateral */}
        <div className="flex-1 space-y-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton width={10} height={10} shape="circle" />
              <Skeleton width={`${60 + ((i * 7) % 30)}%`} height={10} />
              <Skeleton width={28} height={10} />
            </div>
          ))}
        </div>
        {/* Círculo central */}
        <Skeleton width={Math.min(height - 20, 140)} height={Math.min(height - 20, 140)} shape="circle" />
      </div>
    )
  }

  if (tipo === 'funnel') {
    // 4 barras em largura decrescente
    return (
      <div className="flex flex-col items-center justify-center gap-2" style={{ height }}>
        {[100, 78, 56, 34].map((w, i) => (
          <Skeleton key={i} width={`${w}%`} height={22} />
        ))}
      </div>
    )
  }

  if (tipo === 'treemap') {
    return (
      <div className="grid grid-cols-4 gap-1" style={{ height }}>
        <div className="col-span-2 row-span-2"><Skeleton width="100%" height="100%" /></div>
        <div><Skeleton width="100%" height="100%" /></div>
        <div><Skeleton width="100%" height="100%" /></div>
        <div className="col-span-2"><Skeleton width="100%" height="100%" /></div>
      </div>
    )
  }

  if (tipo === 'line' || tipo === 'area') {
    // Silhueta de linha: 6 barras irregulares com gradiente simulando curva
    const alturas = [40, 62, 48, 76, 58, 82]
    return (
      <div className="flex items-end gap-3" style={{ height }}>
        {alturas.map((h, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end gap-1">
            <Skeleton width="100%" height={`${h}%`} />
            <Skeleton width="100%" height={8} />
          </div>
        ))}
      </div>
    )
  }

  // Default: bar chart — 6 barras de alturas variadas
  const alturas = [55, 78, 42, 91, 64, 70]
  return (
    <div className="flex items-end gap-3" style={{ height }}>
      {alturas.map((h, i) => (
        <div key={i} className="flex-1 flex flex-col justify-end gap-1">
          <Skeleton width="100%" height={`${h}%`} />
          <Skeleton width="100%" height={8} />
        </div>
      ))}
    </div>
  )
}
