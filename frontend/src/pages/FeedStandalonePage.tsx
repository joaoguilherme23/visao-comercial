import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Activity, LogOut, ChevronDown, Building2, Sun, Moon, RefreshCw, Loader2,
  AlertTriangle,
} from 'lucide-react'

import { tenantsApi } from '../api/tenants'
import { usersApi } from '../api/users'
import { feedApi } from '../api/feed'
import { useAuthStore } from '../store/authStore'
import { useTenantStore } from '../store/tenantStore'
import { useThemeStore } from '../store/themeStore'
import { Tenant, UserRole } from '../types'
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
import { EmptyState, Popover } from '../components/ds'

const REFETCH_MS = 30_000
const PAGE_SIZE = 50

const GRID_CLASS_BY_DENSITY: Record<FeedDensity, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
  5: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 [@media(min-width:2200px)]:grid-cols-5',
}

export default function FeedStandalonePage() {
  const navigate = useNavigate()
  const { user, logout, setStandaloneMode } = useAuthStore()
  const { selectedTenant, setSelectedTenant, setTenantRole } = useTenantStore()
  const { theme, toggleTheme } = useThemeStore()
  const [tenantOpen, setTenantOpen] = useState(false)

  // Lista de tenants do usuário
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: tenantsApi.list,
  })

  const { data: myRoles = [] } = useQuery({
    queryKey: ['my-tenant-roles'],
    queryFn: usersApi.myTenants,
    enabled: !!user && !user.is_superadmin,
  })

  function getRoleForTenant(tenantId: string): UserRole | null {
    if (user?.is_superadmin) return 'admin'
    return myRoles.find((r) => r.cliente_id === tenantId)?.role ?? null
  }

  // Auto-seleciona tenant único
  useEffect(() => {
    if (!selectedTenant && tenants.length === 1) {
      const t = tenants[0]
      setSelectedTenant(t)
      setTenantRole(getRoleForTenant(t.id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenants, myRoles, selectedTenant])

  function handleSelectTenant(t: Tenant) {
    setSelectedTenant(t)
    setTenantRole(getRoleForTenant(t.id))
    setTenantOpen(false)
  }

  async function handleLogout() {
    const loggedOut = await logout()
    if (!loggedOut) {
      toast.error('Não foi possível encerrar a sessão. Tente novamente.')
      return
    }
    setStandaloneMode(true)
    navigate('/standalone/login', { replace: true })
  }

  // Filtros
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

  const clienteId = selectedTenant?.id

  const queryKey = useMemo(
    () => [
      'feed',
      clienteId,
      debouncedSearch,
      filters.temperatura,
      filters.etapa,
      filters.soAcaoRequerida,
    ],
    [clienteId, debouncedSearch, filters.temperatura, filters.etapa, filters.soAcaoRequerida]
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
        offset: pageParam as number,
        limit: PAGE_SIZE,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage: FeedListResponse) =>
      lastPage.has_more ? lastPage.next_offset ?? undefined : undefined,
    enabled: !!clienteId,
    refetchInterval: REFETCH_MS,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  })

  const { data: etapas } = useQuery({
    queryKey: ['feed-etapas', clienteId],
    queryFn: () => feedApi.etapas(clienteId!),
    enabled: !!clienteId,
    staleTime: 5 * 60_000,
  })

  const items = useMemo(() => {
    if (!data) return []
    return data.pages.flatMap((p) => p.items)
  }, [data])

  const total = data?.pages[0]?.total ?? 0
  const highlightedIds = useFeedHighlights(items)
  const totalLabel = data ? `${total} ${total === 1 ? 'lead' : 'leads'}` : ''
  const { leavingIds, concluir, snooze } = useFeedActions(clienteId)

  const onSentinel = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage()
    }
  }, [isFetchingNextPage, hasNextPage, fetchNextPage])

  const [density, setDensity] = useState<FeedDensity>(() => loadFeedDensity())
  useEffect(() => {
    saveFeedDensity(density)
  }, [density])

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg-base)', color: 'var(--text-1)' }}
    >
      {/* Header standalone */}
      <header
        className="h-14 flex items-center justify-between px-6 gap-4 flex-shrink-0"
        style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--brand-500)' }}
          >
            <Activity size={16} color="#fff" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
              Visão Comercial · Feed
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
              {selectedTenant?.nome ?? 'Selecione uma empresa'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <FeedDensityToggle value={density} onChange={setDensity} />
          {/* Tenant switcher */}
          <Popover
            open={tenantOpen}
            onOpenChange={setTenantOpen}
            side="bottom"
            align="end"
            width={260}
            trigger={
              <button
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-2)',
                }}
              >
                <Building2 size={13} />
                <span className="max-w-[140px] truncate">
                  {selectedTenant?.nome ?? 'Empresa'}
                </span>
                <ChevronDown size={12} />
              </button>
            }
          >
            <div className="py-1 max-h-72 overflow-y-auto">
              {tenants.length === 0 && (
                <p className="text-xs px-3 py-2" style={{ color: 'var(--text-3)' }}>
                  Nenhuma empresa disponível.
                </p>
              )}
              {tenants.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTenant(t)}
                  className="w-full text-left px-3 py-2 text-sm transition-colors"
                  style={{
                    background: t.id === selectedTenant?.id ? 'rgba(11,150,146,0.08)' : 'transparent',
                    color: t.id === selectedTenant?.id ? '#a5b4fc' : 'var(--text-1)',
                  }}
                >
                  {t.nome}
                </button>
              ))}
            </div>
          </Popover>

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
            <RefreshCw size={13} className={isFetching && !isFetchingNextPage ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg transition-colors"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-3)',
            }}
            title="Alternar tema"
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-colors"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-3)',
            }}
            title="Sair"
          >
            <LogOut size={12} />
            Sair
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="w-full">
          {!selectedTenant ? (
            <EmptyState
              variant="info"
              icon={Building2}
              title="Selecione uma empresa"
              description="para visualizar o feed."
            />
          ) : (
            <>
              <div className="mb-4">
                <FeedFilters
                  value={filters}
                  onChange={setFilters}
                  etapas={etapas ?? []}
                  totalLabel={totalLabel}
                />
              </div>

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
            </>
          )}
        </div>
      </main>
    </div>
  )
}
