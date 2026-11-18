import { useState, useCallback, useEffect, useRef } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { kanbanApi } from '../../api/kanban'
import { KanbanCard as IKanbanCard, KanbanColumn as IKanbanColumn } from '../../types'
import { useTenantStore } from '../../store/tenantStore'
import KanbanColumn from './KanbanColumn'
import KanbanCardComp from './KanbanCard'
import LeadModal from './LeadModal'
import { toastError } from '../../lib/toast'
import { Search, RefreshCw, Loader2 } from 'lucide-react'
import { format, startOfWeek, subHours } from 'date-fns'
import { DateRangePicker, DateRange } from '../DateRangePicker'
import { KanbanColumnSkeleton } from '../ui/skeletons'
import LiveFeedToggle, { LiveFeedMode } from './LiveFeedToggle'
import { useHighlightRing } from '../../hooks/useHighlightRing'

interface Props {
  clienteId: string
  initialLeadId?: string
  /** Quando true (`?highlight=1` na URL), aplica ring-pulse no card alvo. */
  highlight?: boolean
}

export default function KanbanBoard({ clienteId, initialLeadId, highlight = false }: Props) {
  const qc = useQueryClient()
  const { selectedNumero } = useTenantStore()
  const telefoneBot = selectedNumero?.numero
  const [activeCard, setActiveCard] = useState<IKanbanCard | null>(null)
  const [selectedCard, setSelectedCard] = useState<IKanbanCard | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [tempFilter, setTempFilter] = useState('')
  const [sentFilter, setSentFilter] = useState('')
  const today = new Date()
  const semanaIni = startOfWeek(today, { weekStartsOn: 1 })
  const [dateRange, setDateRange] = useState<DateRange | null>({ inicio: semanaIni, fim: today })
  const [liveMode, setLiveMode] = useState<LiveFeedMode>('off')
  const isLive = liveMode !== 'off'
  const liveHours = liveMode === '2h' ? 2 : liveMode === '6h' ? 6 : liveMode === '24h' ? 24 : 0

  // Live feed sobrepõe o dateRange — janela é sempre "agora - Nh ... agora".
  const effectiveRange: DateRange = isLive
    ? { inicio: subHours(today, liveHours), fim: today }
    : (dateRange ?? { inicio: semanaIni, fim: today })
  const startDate = format(effectiveRange.inicio, 'yyyy-MM-dd')
  const endDate   = format(effectiveRange.fim,    'yyyy-MM-dd')

  // Debounce search to avoid firing on every keystroke
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    timerRef.current = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(timerRef.current)
  }, [search])

  const cacheKey = ['kanban', clienteId, debouncedSearch, tempFilter, sentFilter, startDate, endDate, telefoneBot ?? ''] as const

  const { data: board, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: cacheKey,
    queryFn: () =>
      kanbanApi.getBoard(clienteId, {
        search: debouncedSearch || undefined,
        temperatura: tempFilter || undefined,
        sentimento: sentFilter || undefined,
        data_inicio: startDate,
        data_fim: endDate,
        telefone_bot: telefoneBot || undefined,
      }),
    enabled: !!clienteId,
    // Live feed: refetch mais agressivo pra sensação de "real-time"
    refetchInterval: isLive ? 15_000 : 30_000,
    refetchIntervalInBackground: false,
  })

  const moveMutation = useMutation({
    mutationFn: ({ leadId, nova_etapa }: { leadId: string; nova_etapa: string }) =>
      kanbanApi.moveCard(clienteId, leadId, nova_etapa),
    onMutate: async ({ leadId, nova_etapa }) => {
      await qc.cancelQueries({ queryKey: cacheKey })
      const previousBoard = qc.getQueryData(cacheKey)
      // Optimistic update
      qc.setQueryData(cacheKey, (old: typeof board) => {
        if (!old) return old
        const card = old.columns.flatMap((col: IKanbanColumn) => col.cards).find((c: IKanbanCard) => c.id === leadId)
        if (!card) return old
        return {
          ...old,
          columns: old.columns.map((col: IKanbanColumn) => {
            if (col.etapa === card.etapa_funil) {
              return { ...col, cards: col.cards.filter((c) => c.id !== leadId), total: col.total - 1 }
            }
            if (col.etapa === nova_etapa) {
              return { ...col, cards: [{ ...card, etapa_funil: nova_etapa }, ...col.cards], total: col.total + 1 }
            }
            return col
          }),
        }
      })
      return { previousBoard }
    },
    onError: (err, vars, context) => {
      // Rollback optimistic update
      if (context?.previousBoard) {
        qc.setQueryData(cacheKey, context.previousBoard)
      }
      // Motivo real (ex: "nicho exige preencher CNPJ antes de mover") + botão
      // de retry que refaz a mesma mutação com os mesmos args.
      toastError(err, {
        fallback: 'Erro ao mover card',
        retry: () => moveMutation.mutate(vars),
      })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['kanban', clienteId] })
    },
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Abre o modal automaticamente quando navegado via ?leadId=
  useEffect(() => {
    if (!initialLeadId || !board) return
    const card = board.columns.flatMap((col: IKanbanColumn) => col.cards).find((c: IKanbanCard) => c.id === initialLeadId)
    if (card) setSelectedCard(card)
  }, [initialLeadId, board])

  // Ring-pulse no card alvo quando chegou via ?leadId=X&highlight=1. O alvo
  // precisa ter `data-lead-id={card.id}` no DOM — ver KanbanCard.tsx.
  useHighlightRing(highlight ? initialLeadId : undefined)

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const card = e.active.data.current?.card as IKanbanCard
    setActiveCard(card)
  }, [])

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveCard(null)
      const { active, over } = e
      if (!over || !board) return
      const card = active.data.current?.card as IKanbanCard | undefined
      if (!card) return

      // Resolve target column: over.id can be a column etapa OR a card id
      let targetColumn = over.id as string
      const isColumnDrop = board.columns.some((col) => col.etapa === targetColumn)
      if (!isColumnDrop) {
        // Dropped on a card — find which column contains that card
        const parentCol = board.columns.find((col) =>
          col.cards.some((c) => c.id === targetColumn)
        )
        if (!parentCol) return
        targetColumn = parentCol.etapa
      }

      if (card.etapa_funil === targetColumn) return
      moveMutation.mutate({ leadId: card.id, nova_etapa: targetColumn })
    },
    [moveMutation, qc, clienteId, debouncedSearch, tempFilter, sentFilter, startDate, endDate, telefoneBot, board]
  )

  // First load: skeleton que replica o layout do board (reduz layout shift
  // e dá contexto visual do que está carregando).
  if (isLoading) {
    return (
      <div className="flex flex-col h-full gap-4">
        {/* Toolbar skeleton */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-48 h-9 rounded-lg animate-shimmer" style={{ background: 'var(--skeleton-base)' }} />
          <div className="w-32 h-9 rounded-lg animate-shimmer" style={{ background: 'var(--skeleton-base)' }} />
          <div className="w-32 h-9 rounded-lg animate-shimmer" style={{ background: 'var(--skeleton-base)' }} />
          <div className="w-44 h-9 rounded-lg animate-shimmer" style={{ background: 'var(--skeleton-base)' }} />
        </div>
        <KanbanColumnSkeleton columns={5} cardsPerColumn={3} />
      </div>
    )
  }

  // BUG-05: tratar erro (ex: nicho sem etapas configuradas retorna 422)
  if (isError) {
    const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    const msg = detail ?? 'Erro ao carregar o Kanban'
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-400 mb-2 text-sm max-w-sm">{msg}</p>
          <button
            onClick={() => refetch()}
            className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar lead..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <select
          value={tempFilter}
          onChange={(e) => setTempFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500"
        >
          <option value="">Temperatura</option>
          <option value="quente">Quente</option>
          <option value="morno">Morno</option>
          <option value="frio">Frio</option>
        </select>

        <select
          value={sentFilter}
          onChange={(e) => setSentFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500"
        >
          <option value="">Sentimento</option>
          <option value="positivo">Positivo</option>
          <option value="neutro">Neutro</option>
          <option value="negativo">Negativo</option>
        </select>

        {/* Live Feed desabilita o DateRangePicker — janela é derivada. */}
        {!isLive && <DateRangePicker value={dateRange} onChange={setDateRange} />}
        <LiveFeedToggle value={liveMode} onChange={setLiveMode} />

        <button
          onClick={() => refetch()}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          title="Atualizar"
        >
          <RefreshCw size={16} />
        </button>

        {/* Background refresh indicator */}
        {isFetching && !isLoading && (
          <Loader2 size={14} className="animate-spin text-brand-400" />
        )}

        <span className="text-xs text-gray-500 ml-auto">
          {board?.total_leads ?? 0} leads
        </span>
      </div>

      {/* Kanban */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {board?.columns.map((col, index) => (
            <KanbanColumn
              key={col.etapa}
              column={col}
              index={index}
              onCardClick={setSelectedCard}
              liveMode={isLive}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeCard && <KanbanCardComp card={activeCard} isDragging />}
        </DragOverlay>
      </DndContext>

      {/* Lead Detail Modal */}
      {selectedCard && (
        <LeadModal
          card={selectedCard}
          clienteId={clienteId}
          etapas={board?.columns.map((c) => c.etapa)}
          onMoveCard={(cardId, etapa) => {
            moveMutation.mutate({ leadId: cardId, nova_etapa: etapa })
            setSelectedCard(null)
          }}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  )
}
