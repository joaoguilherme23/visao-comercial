import Skeleton from '../Skeleton'

/**
 * Skeleton que replica a coluna do Kanban enquanto o board carrega.
 * Mantém a mesma largura mínima (260px) e gap interno usados em KanbanColumn,
 * pra evitar layout shift no load inicial.
 */
interface KanbanColumnSkeletonProps {
  /** Quantas colunas renderizar (depende da config de etapas do nicho). */
  columns?: number
  /** Quantos cards de placeholder por coluna. */
  cardsPerColumn?: number
}

export default function KanbanColumnSkeleton({
  columns = 5,
  cardsPerColumn = 3,
}: KanbanColumnSkeletonProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 h-full">
      {Array.from({ length: columns }).map((_, colIdx) => (
        <div
          key={colIdx}
          className="flex-shrink-0 w-64 bg-gray-800/40 rounded-lg p-3 flex flex-col gap-3"
          style={{ minHeight: '60vh' }}
        >
          {/* Header da coluna — título + contador */}
          <div className="flex items-center justify-between mb-1">
            <Skeleton width={96} height={14} />
            <Skeleton width={28} height={18} shape="pill" />
          </div>

          {/* Cards fake */}
          {Array.from({ length: cardsPerColumn }).map((__, cardIdx) => (
            <div
              key={cardIdx}
              className="bg-gray-900/60 border border-gray-700/50 rounded-lg p-3 flex flex-col gap-2"
            >
              {/* Nome + avatar */}
              <div className="flex items-center gap-2">
                <Skeleton width={28} height={28} shape="circle" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <Skeleton width="70%" height={12} />
                  <Skeleton width="45%" height={10} />
                </div>
              </div>
              {/* Linha de infos (tel, data) */}
              <Skeleton width="90%" height={10} />
              {/* Badges temperatura/sentimento */}
              <div className="flex gap-1.5 mt-1">
                <Skeleton width={54} height={18} shape="pill" />
                <Skeleton width={54} height={18} shape="pill" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
