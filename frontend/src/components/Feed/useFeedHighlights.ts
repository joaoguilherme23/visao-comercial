import { useEffect, useRef, useState } from 'react'
import type { FeedCard } from '../../types'

/**
 * Compara o `updated_at` de cada card entre polls e devolve o conjunto
 * de IDs cujo timestamp avançou desde o snapshot anterior.
 *
 * Uso no FeedCard:
 *   const highlightedIds = useFeedHighlights(items)
 *   <FeedCardComp ... isHighlighted={highlightedIds.has(card.id)} />
 *
 * O destaque é "one-shot": a animação dura ~3s no próprio card e não
 * volta a disparar até o `updated_at` mudar de novo.
 */
export function useFeedHighlights(items: FeedCard[] | undefined): Set<string> {
  // snapshot do último updated_at por id
  const lastSeenRef = useRef<Map<string, string>>(new Map())
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!items) return
    const fresh = new Set<string>()
    const next = new Map<string, string>()

    for (const it of items) {
      const prev = lastSeenRef.current.get(it.id)
      if (prev && prev !== it.updated_at) fresh.add(it.id)
      next.set(it.id, it.updated_at)
    }

    lastSeenRef.current = next

    if (fresh.size > 0) {
      setHighlighted(fresh)
      // Limpa após 3.5s pra não acumular set entre polls.
      const t = setTimeout(() => setHighlighted(new Set()), 3500)
      return () => clearTimeout(t)
    }
  }, [items])

  return highlighted
}
