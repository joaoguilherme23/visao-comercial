import Skeleton from '../Skeleton'

/**
 * Skeleton que replica a linha de `LeadRow` (usada em drawers do dashboard).
 * Importante manter o 40px de altura aproximada do badge de score pra não
 * causar layout shift quando a lista real chegar.
 */
export default function LeadRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg p-3 flex items-center gap-3"
          style={{ border: '1px solid var(--border)' }}
        >
          <Skeleton width={36} height={36} shape="circle" />
          <div className="flex-1 flex flex-col gap-1.5">
            <Skeleton width="65%" height={12} />
            <div className="flex gap-2">
              <Skeleton width={60} height={10} />
              <Skeleton width={40} height={10} />
            </div>
          </div>
          <Skeleton width={18} height={18} />
        </div>
      ))}
    </div>
  )
}
