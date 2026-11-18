import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Flame, AlertTriangle } from 'lucide-react'
import { agoraApi } from '../api/agora'
import { useTenantStore } from '../store/tenantStore'
import { groupByTimeBucket } from '../lib/agoraGrouping'
import { AgoraHeader } from '../components/Agora/AgoraHeader'
import { AgoraTimeSection } from '../components/Agora/AgoraTimeSection'
import { AgoraEmpty } from '../components/Agora/AgoraEmpty'
import { AgoraSkeleton } from '../components/Agora/AgoraSkeleton'
import { EmptyState } from '../components/ds'

/**
 * Pagina /agora v2 — fila temporal.
 *
 * Itens antes agrupados por motivo agora vao para 5 faixas temporais (Hoje, Ontem,
 * Essa semana, Esse mes, Anteriores). O motivo vira atributo visual do card (borda
 * lateral colorida + prefixo textual em bold).
 *
 * Polling a cada 45s, refetch on focus, staleTime 15s.
 */
export default function AgoraPage() {
  const { selectedTenant } = useTenantStore()
  const clienteId = selectedTenant?.id
  const [showOlder, setShowOlder] = useState(false)

  const { data, isLoading, isError, refetch, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ['agora', clienteId],
    queryFn: () => agoraApi.getBoard(clienteId!),
    enabled: !!clienteId,
    refetchOnWindowFocus: true,
    refetchInterval: 45_000,
    staleTime: 15_000,
  })

  const sections = useMemo(() => (data ? groupByTimeBucket(data) : []), [data])

  if (!selectedTenant) {
    return (
      <div className="max-w-[960px] mx-auto px-6">
        <EmptyState
          variant="info"
          icon={Flame}
          title="Selecione uma empresa"
          description="para visualizar a fila de agora"
        />
      </div>
    )
  }

  if (isLoading) return <AgoraSkeleton />

  if (isError || !data) {
    return (
      <div className="max-w-[960px] mx-auto px-6">
        <EmptyState
          variant="error"
          icon={AlertTriangle}
          title="Erro ao carregar a fila"
          description="Verifique sua conexão e tente novamente"
          action={{ label: 'Tentar de novo', onClick: () => refetch(), variant: 'primary' }}
        />
      </div>
    )
  }

  // groupByTimeBucket sempre retorna as 5 secoes, logo usar .find eh seguro.
  const todaySection = sections.find((s) => s.key === 'today')!
  const yesterdaySection = sections.find((s) => s.key === 'yesterday')!
  const weekSection = sections.find((s) => s.key === 'thisWeek')!
  const monthSection = sections.find((s) => s.key === 'thisMonth')!
  const olderSection = sections.find((s) => s.key === 'older')!

  const totalGeral = data.total_geral

  if (totalGeral === 0) {
    return (
      <div className="max-w-[960px] mx-auto px-6 py-6">
        <AgoraHeader
          totalGeral={0}
          updatedAt={dataUpdatedAt}
          onRefresh={() => refetch()}
          isRefreshing={isFetching}
        />
        <AgoraEmpty />
      </div>
    )
  }

  // "Hoje" vazia mas com itens recentes ganha mensagem especifica.
  const hasLaterItems =
    yesterdaySection.items.length +
      weekSection.items.length +
      monthSection.items.length >
    0
  const todayIsEmpty = todaySection.items.length === 0
  const showTodayEmptyMsg = todayIsEmpty && hasLaterItems

  return (
    <div className="max-w-[960px] mx-auto px-6 py-6">
      <AgoraHeader
        totalGeral={totalGeral}
        updatedAt={dataUpdatedAt}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
      />

      <div>
        {/* Hoje: renderiza se tem itens OU se precisa mostrar mensagem de "nada novo" */}
        {(todaySection.items.length > 0 || showTodayEmptyMsg) && (
          <AgoraTimeSection
            sectionKey="today"
            label={todaySection.label}
            items={todaySection.items}
            isEmpty={todayIsEmpty}
          />
        )}

        {/* Ontem, Essa semana, Esse mes: so renderiza com itens */}
        {yesterdaySection.items.length > 0 && (
          <AgoraTimeSection
            sectionKey="yesterday"
            label={yesterdaySection.label}
            items={yesterdaySection.items}
          />
        )}
        {weekSection.items.length > 0 && (
          <AgoraTimeSection
            sectionKey="thisWeek"
            label={weekSection.label}
            items={weekSection.items}
          />
        )}
        {monthSection.items.length > 0 && (
          <AgoraTimeSection
            sectionKey="thisMonth"
            label={monthSection.label}
            items={monthSection.items}
          />
        )}

        {/* Anteriores: oculto por padrao, botao pra revelar */}
        {olderSection.items.length > 0 && (
          <>
            <div className="my-6 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setShowOlder((v) => !v)}
                className="agora-older-btn inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium transition-colors"
                style={{
                  color: showOlder ? 'var(--text-2)' : 'var(--text-3)',
                  border: '1px solid var(--border-subtle)',
                  background: 'transparent',
                }}
                aria-expanded={showOlder}
                aria-controls="agora-older-section"
              >
                <style>{`
                  .agora-older-btn:hover {
                    border-color: rgba(11,150,146,0.35) !important;
                    color: var(--text-2) !important;
                  }
                `}</style>
                <ChevronDown
                  size={14}
                  style={{
                    transform: showOlder ? 'rotate(180deg)' : 'none',
                    transition: 'transform 200ms',
                  }}
                  aria-hidden
                />
                {showOlder
                  ? 'Ocultar itens antigos'
                  : `Mostrar itens antigos (${olderSection.items.length})`}
              </button>
            </div>
            {showOlder && (
              <div id="agora-older-section" className="animate-fade-in">
                <AgoraTimeSection
                  sectionKey="older"
                  label={olderSection.label}
                  items={olderSection.items}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
