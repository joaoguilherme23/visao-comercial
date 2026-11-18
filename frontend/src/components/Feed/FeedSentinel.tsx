import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'

interface Props {
  /** Chamado quando o sentinel entra no viewport. Idempotente. */
  onIntersect: () => void
  /** Quando true, mostra spinner; quando false e !hasMore, esconde tudo. */
  isLoading?: boolean
  /** Indica se ainda há mais páginas — se false, o sentinel não dispara. */
  hasMore: boolean
  /** Margem extra antes de disparar o load — default 400px. */
  rootMargin?: string
}

/**
 * Sentinel observado pelo IntersectionObserver. Quando entra no viewport
 * (com `rootMargin` de antecipação), dispara `onIntersect` para carregar
 * a próxima página.
 *
 * Idempotência: o callback é responsabilidade do parent (geralmente
 * `useInfiniteQuery.fetchNextPage`, que ignora chamadas concorrentes).
 */
export default function FeedSentinel({
  onIntersect,
  isLoading = false,
  hasMore,
  rootMargin = '400px',
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!hasMore) return
    const node = ref.current
    if (!node) return

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onIntersect()
          }
        }
      },
      { rootMargin, threshold: 0 }
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [hasMore, onIntersect, rootMargin])

  if (!hasMore && !isLoading) return null

  return (
    <div
      ref={ref}
      className="col-span-full flex items-center justify-center py-6 text-xs"
      style={{ color: 'var(--text-3)' }}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          Carregando mais leads…
        </span>
      ) : hasMore ? (
        // Reservado pra "ver mais" manual fallback (Tab pra acessibilidade)
        <span className="opacity-0">·</span>
      ) : null}
    </div>
  )
}
