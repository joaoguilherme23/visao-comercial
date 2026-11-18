import Skeleton from '../Skeleton'

/**
 * Bolhas alternadas (entrada/saída) pra placeholder de lista de mensagens.
 */
export default function MessageSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="px-3 py-2 space-y-2">
      {Array.from({ length: count }).map((_, i) => {
        const isOut = i % 2 === 1
        const width = 55 + ((i * 13) % 35)
        return (
          <div key={i} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
            <Skeleton width={`${width}%`} height={28} />
          </div>
        )
      })}
    </div>
  )
}
