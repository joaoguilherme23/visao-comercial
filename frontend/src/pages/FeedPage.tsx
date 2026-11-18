import { useCallback, useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Loader2, Activity, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react'

import { useTenantStore } from '../store/tenantStore'
import { feedApi } from '../api/feed'
import type { FeedListResponse } from '../types'
import FeedCardComp from '../components/Feed/FeedCard'
import FeedFilters, { FeedFiltersState } from '../components/Feed/FeedFilters'
import FeedDensityToggle, {
  FeedDensity,
  loadFeedDensity,
  saveFeedDensity,
} from '../components/Feed/FeedDensityToggle'
import FeedSentinel from '../components/Feed/FeedSentinel'
import { useFeedHighlights } from '../components/Feed/useFeedHighlights'
import { useFeedActions } from '../components/Feed/useFeedActions'
import { EmptyState } from '../components/ds'

/** Polling do feed — mesma cadência do kanban. */
const REFETCH_MS = 30_000
const PAGE_SIZE = 50

const GRID_CLASS_BY_DENSITY: Record<FeedDensity, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
  5: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 [@media(min-width:2200px)]:grid-cols-5',
}

export default function FeedPage() {
  const { selectedTenant, selectedNumero } = useTenantStore()
  const clienteId = selectedTenant?.id
  const telefoneBot = selectedNumero?.numero

  const [density, setDensity] = useState<FeedDensity>(() => loadFeedDensity())
  useEffect(() => {
    saveFeedDensity(density)
  }, [density])

  const [filters, setFilters] = useState<FeedFiltersState>({
    search: '',
    temperatura: '',
    etapa: '',
    soAcaoRequerida: false,
  })

  const [debouncedSearch, setDebouncedSearch] = useState(filters.search)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 350)
    return () => clearTimeout(t)
  }, [filters.search])

  const queryKey = useMemo(
    () => [
      'feed',
      clienteId,
      debouncedSearch,
      filters.temperatura,
      filters.etapa,
      filters.soAcaoRequerida,
      telefoneBot ?? '',
    ],
    [clienteId, debouncedSearch, filters.temperatura, filters.etapa, filters.soAcaoRequerida, telefoneBot]
  )

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 0 }) =>
      feedApi.list(clienteId!, {
        search: debouncedSearch || undefined,
        temperatura: filters.temperatura || undefined,
        etapa_funil: filters.etapa || undefined,
        so_acao_requerida: filters.soAcaoRequerida,
        ...(telefoneBot ? { telefone_bot: telefoneBot } : {}),
        offset: pageParam as number,
        limit: PAGE_SIZE,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage: FeedListResponse) =>
      lastPage.has_more ? lastPage.next_offset ?? undefined : undefined,
    enabled: !!clienteId,
    refetchInterval: REFETCH_MS,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  })

  const { data: etapas } = useQuery({
    queryKey: ['feed-etapas', clienteId],
    queryFn: () => feedApi.etapas(clienteId!),
    enabled: !!clienteId,
    staleTime: 5 * 60_000,
  })

  // Achata as páginas em uma única lista de cards
  const items = useMemo(() => {
    if (!data) return []
    return data.pages.flatMap((p) => p.items)
  }, [data])

  const total = data?.pages[0]?.total ?? 0

  const highlightedIds = useFeedHighlights(items)
  const { leavingIds, concluir, snooze } = useFeedActions(clienteId)

  const totalLabel = useMemo(() => {
    if (!data) return ''
    return `${total} ${total === 1 ? 'lead' : 'leads'}`
  }, [data, total])

  const onSentinel = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage()
    }
  }, [isFetchingNextPage, hasNextPage, fetchNextPage])

  if (!selectedTenant) {
    return (
      <EmptyState
        variant="info"
        icon={Activity}
        title="Selecione uma empresa"
        description="para visualizar o feed de leads"
      />
    )
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="mb-4 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
            Feed
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            {selectedTenant.nome} · Leads ativos ordenados por urgência
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FeedDensityToggle value={density} onChange={setDensity} />
          <a
            href="/standalone/feed"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-colors"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
            }}
            title="Abrir em modo standalone (sem menu)"
          >
            <ExternalLink size={12} />
            Standalone
          </a>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg transition-colors"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-3)',
            }}
            title="Atualizar"
          >
            <RefreshCw size={14} className={isFetching && !isFetchingNextPage ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-4">
        <FeedFilters
          value={filters}
          onChange={setFilters}
          etapas={etapas ?? []}
          totalLabel={totalLabel}
        />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-3)' }} />
          </div>
        ) : isError ? (
          <EmptyState
            variant="error"
            icon={AlertTriangle}
            title="Erro ao carregar o feed"
            description="Tente novamente em alguns segundos"
            action={{ label: 'Tentar de novo', onClick: () => refetch(), variant: 'primary' }}
          />
        ) : items.length === 0 ? (
          <EmptyState
            variant="empty"
            icon={Activity}
            title="Nenhum lead corresponde aos filtros"
            description="Ajuste a busca ou desligue 'só ação requerida'."
          />
        ) : (
          <div className={`grid gap-3 pb-6 ${GRID_CLASS_BY_DENSITY[density]}`}>
            {items.map((card) => (
              <FeedCardComp
                key={card.id}
                card={card}
                clienteId={clienteId!}
                density={density}
                isHighlighted={highlightedIds.has(card.id)}
                isLeaving={leavingIds.has(card.id)}
                onConcluir={concluir}
                onSnooze={snooze}
              />
            ))}
            <FeedSentinel
              onIntersect={onSentinel}
              isLoading={isFetchingNextPage}
              hasMore={!!hasNextPage}
            />
          </div>
        )}
      </div>
    </div>
  )
}
