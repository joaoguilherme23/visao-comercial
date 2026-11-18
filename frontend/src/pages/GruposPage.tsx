import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useLayoutEffect,
  useCallback,
} from 'react'
import {
  useQuery,
  useInfiniteQuery,
} from '@tanstack/react-query'
import {
  Users2,
  ArrowLeft,
  RefreshCw,
  Search,
  X,
  Loader2,
  MessageSquare,
  UserCircle2,
} from 'lucide-react'
import {
  format,
  isToday,
  isYesterday,
  differenceInCalendarDays,
  formatDistanceToNow,
  subDays,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useTenantStore } from '../store/tenantStore'
import {
  gruposApi,
  GrupoListItem,
  GrupoMensagem,
  GrupoParticipante,
} from '../api/grupos'
import { EmptyState, Pill } from '../components/ds'
import { getParticipantColor } from '../lib/participantColor'
import { semanticColors, normalizeTemperatura } from '../lib/semanticColors'
import { resolveAvatarUrl } from '../lib/avatarUrl'
import SyncFotosButton from '../components/ui/SyncFotosButton'

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const MESSAGES_PAGE_SIZE = 50

type Periodo = 'all' | '24h' | '7d' | '30d'

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
]

// ---------------------------------------------------------------------------
// Helpers de formatação (reaproveitam padrões do ConversasPage).
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return ''
  try {
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: true,
      locale: ptBR,
    })
  } catch {
    return ''
  }
}

function formatMessageTime(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'HH:mm', { locale: ptBR })
  } catch {
    return ''
  }
}

function formatDateSeparator(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isToday(d)) return 'Hoje'
    if (isYesterday(d)) return 'Ontem'
    const diff = differenceInCalendarDays(new Date(), d)
    if (diff > 1 && diff < 7) {
      const name = format(d, 'EEEE', { locale: ptBR })
      return name.charAt(0).toUpperCase() + name.slice(1)
    }
    return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  } catch {
    return ''
  }
}

/** Chave estável do dia local — compara se duas datas ISO caem no mesmo dia. */
function dayKey(dateStr: string): string {
  try {
    return new Date(dateStr).toDateString()
  } catch {
    return ''
  }
}

/** Data-limite pra filtro client-side de período (null = sem filtro). */
function periodoCutoff(periodo: Periodo): Date | null {
  const now = new Date()
  if (periodo === '24h') return subDays(now, 1)
  if (periodo === '7d') return subDays(now, 7)
  if (periodo === '30d') return subDays(now, 30)
  return null
}

// ---------------------------------------------------------------------------
// GrupoItem — card da lista lateral de grupos.
// ---------------------------------------------------------------------------

function GrupoItem({
  grupo,
  isSelected,
  onClick,
}: {
  grupo: GrupoListItem
  isSelected: boolean
  onClick: () => void
}) {
  const tempKey = normalizeTemperatura(grupo.temperatura)
  const tempColor = tempKey ? semanticColors.temperatura[tempKey] : null

  const nome = grupo.nome?.trim() || grupo.whatsapp
  const inicial = (nome[0] ?? '#').toUpperCase()

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 transition-colors flex items-center gap-3"
      style={{
        background: isSelected ? 'rgba(11,150,146,0.1)' : 'transparent',
        borderLeft: isSelected
          ? '3px solid var(--brand-500)'
          : '3px solid transparent',
      }}
    >
      {/* Avatar do grupo — círculo com inicial + ícone de grupo sobreposto */}
      <div className="relative shrink-0">
        {grupo.foto_url ? (
          <img
            src={resolveAvatarUrl(grupo.foto_url) ?? ''}
            alt={nome}
            className="w-10 h-10 rounded-full object-cover"
            style={{
              border: `1px solid ${tempColor ?? 'var(--border-subtle)'}`,
            }}
            loading="lazy"
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
            style={{
              background: 'var(--bg-elevated)',
              border: `1px solid ${tempColor ?? 'var(--border-subtle)'}`,
              color: 'var(--text-1)',
            }}
            title={nome}
          >
            {inicial}
          </div>
        )}
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full flex items-center justify-center"
          style={{
            width: 16,
            height: 16,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Users2 size={9} style={{ color: 'var(--text-3)' }} />
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p
            className="text-sm font-medium truncate"
            style={{ color: 'var(--text-1)' }}
          >
            {nome}
          </p>
          {grupo.ultima_interacao && (
            <span
              className="text-xs flex-shrink-0"
              style={{ color: 'var(--text-3)' }}
            >
              {formatRelativeTime(grupo.ultima_interacao)}
            </span>
          )}
        </div>
        {/* Metadados agregados */}
        <div className="flex items-center gap-3 mt-0.5">
          <span
            className="text-[11px] flex items-center gap-1 font-mono-data"
            style={{ color: 'var(--text-3)' }}
            title="Total de mensagens (inclui bots)"
          >
            <MessageSquare size={10} />
            {grupo.total_mensagens.toLocaleString('pt-BR')}
          </span>
          <span
            className="text-[11px] flex items-center gap-1 font-mono-data"
            style={{ color: 'var(--text-3)' }}
            title="Participantes únicos"
          >
            <UserCircle2 size={10} />
            {grupo.total_participantes.toLocaleString('pt-BR')}
          </span>
          {tempKey && (
            <span
              className="text-[10px] font-medium capitalize"
              style={{ color: tempColor ?? undefined }}
            >
              ● {grupo.temperatura}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Separador de data no chat — reusa estilo do ConversasPage.
// ---------------------------------------------------------------------------

function DateSeparator({ dateStr }: { dateStr: string }) {
  const label = formatDateSeparator(dateStr)
  if (!label) return null
  return (
    <div className="flex items-center justify-center my-4">
      <Pill tone="neutral" variant="ghost" className="uppercase tracking-wider px-3 py-1">
        {label}
      </Pill>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bubble de mensagem de grupo — estilo WhatsApp com remetente colorido.
// ---------------------------------------------------------------------------

function MensagemBubble({ msg }: { msg: GrupoMensagem }) {
  // Em grupos, tratamos todas as mensagens como "entrada" (vindas de
  // participantes), porque bots do tenant já vêm filtrados pelo backend.
  // Mesmo se `direcao === 'saida'`, renderizamos na coluna esquerda com o
  // nome colorido — são admins/consultores do tenant falando no grupo.
  const color = getParticipantColor(msg.participant_number, msg.participant_name)
  const displayName =
    msg.participant_name?.trim() || msg.participant_number || 'Desconhecido'

  return (
    <div className="flex justify-start mb-2">
      <div className="max-w-[70%] flex flex-col items-start">
        {/* Nome do participante, colorido e estável por hash */}
        <span
          className="text-[11px] font-semibold mb-0.5 px-1"
          style={{ color }}
        >
          {displayName}
        </span>
        <div
          className="rounded-2xl px-4 py-2.5 w-full"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderBottomLeftRadius: 4,
          }}
        >
          {msg.conteudo ? (
            <p
              className="text-sm leading-relaxed whitespace-pre-wrap break-words"
              style={{ color: 'var(--text-1)' }}
            >
              {msg.conteudo}
            </p>
          ) : (
            <span
              className="text-xs italic"
              style={{ color: 'var(--text-3)' }}
            >
              [mídia: {msg.tipo}]
            </span>
          )}
          <div className="flex justify-end mt-1">
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              {formatMessageTime(msg.enviada_em)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ParticipantesDrawer — drawer lateral direito com lista agregada.
// ---------------------------------------------------------------------------

function ParticipantesDrawer({
  clienteId,
  grupo,
  open,
  onClose,
}: {
  clienteId: string
  grupo: GrupoListItem
  open: boolean
  onClose: () => void
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['grupos', clienteId, grupo.id, 'participantes'],
    queryFn: () => gruposApi.listParticipantes(clienteId, grupo.id),
    enabled: open && !!clienteId,
    staleTime: 60_000,
  })

  if (!open) return null

  return (
    <>
      {/* Backdrop — click fecha */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        className="fixed top-0 right-0 bottom-0 w-[360px] z-50 flex flex-col"
        style={{
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-20px 0 40px rgba(0,0,0,0.25)',
        }}
        role="dialog"
        aria-label="Participantes do grupo"
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="min-w-0">
            <h3
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--text-1)' }}
            >
              Participantes
            </h3>
            <p
              className="text-xs truncate"
              style={{ color: 'var(--text-3)' }}
            >
              {grupo.nome ?? grupo.whatsapp}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-3)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)'
              e.currentTarget.style.color = 'var(--text-1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-3)'
            }}
            aria-label="Fechar painel de participantes"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {isLoading ? (
            <div className="space-y-2 px-2 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 animate-pulse px-2 py-2"
                >
                  <div
                    className="w-9 h-9 rounded-full flex-shrink-0"
                    style={{ background: 'var(--bg-elevated)' }}
                  />
                  <div className="flex-1 space-y-1.5">
                    <div
                      className="h-3 rounded w-3/4"
                      style={{ background: 'var(--bg-elevated)' }}
                    />
                    <div
                      className="h-2.5 rounded w-1/2"
                      style={{ background: 'var(--bg-elevated)' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <EmptyState
              variant="error"
              size="sm"
              title="Erro ao carregar participantes"
              description="Tente fechar e reabrir o painel."
            />
          ) : !data?.items.length ? (
            <EmptyState
              variant="empty"
              size="sm"
              icon={UserCircle2}
              title="Nenhum participante"
              description="Este grupo ainda não tem mensagens (excluindo bots)."
            />
          ) : (
            <>
              <div
                className="px-3 py-2 text-[11px] uppercase tracking-wider font-semibold"
                style={{ color: 'var(--text-3)' }}
              >
                {data.total} {data.total === 1 ? 'participante' : 'participantes'} · ordem: mais ativos
              </div>
              <ul className="space-y-1">
                {[...data.items]
                  .sort((a, b) => b.total_mensagens - a.total_mensagens)
                  .map((p) => (
                    <ParticipanteRow key={p.participant_number} p={p} />
                  ))}
              </ul>
            </>
          )}
        </div>
      </aside>
    </>
  )
}

function ParticipanteRow({ p }: { p: GrupoParticipante }) {
  const color = getParticipantColor(p.participant_number, p.participant_name)
  const displayName = p.participant_name?.trim() || p.participant_number
  const inicial = (displayName[0] ?? '?').toUpperCase()

  return (
    <li
      className="flex items-center gap-3 mx-2 px-2 py-2 rounded-lg transition-colors"
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-elevated)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{
          background: `${color}22`,
          border: `1px solid ${color}66`,
          color,
        }}
      >
        {inicial}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: 'var(--text-1)' }}
        >
          {displayName}
        </p>
        <p
          className="text-[11px] font-mono-data truncate"
          style={{ color: 'var(--text-3)' }}
        >
          {p.participant_number}
          {p.ultima_msg_em && (
            <span className="ml-2" style={{ color: 'var(--text-3)' }}>
              · última: {formatRelativeTime(p.ultima_msg_em)}
            </span>
          )}
        </p>
      </div>
      <span
        className="text-xs font-mono-data font-semibold flex-shrink-0"
        style={{ color: 'var(--text-2)' }}
        title="Total de mensagens"
      >
        {p.total_mensagens}
      </span>
    </li>
  )
}

// ---------------------------------------------------------------------------
// ChatPanel — painel central com mensagens do grupo selecionado.
// ---------------------------------------------------------------------------

function ChatPanel({
  clienteId,
  grupo,
  onBack,
  onOpenParticipantes,
}: {
  clienteId: string
  grupo: GrupoListItem
  onBack: () => void
  onOpenParticipantes: () => void
}) {
  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['grupos', clienteId, grupo.id, 'mensagens'],
    queryFn: ({ pageParam = 0 }) =>
      gruposApi.listMensagens(clienteId, grupo.id, {
        limit: MESSAGES_PAGE_SIZE,
        offset: pageParam as number,
      }),
    initialPageParam: 0,
    // Backend retorna pageable { total, limit, offset, items }. Calculamos
    // hasNextPage por offset+items < total (mais robusto que checar len<limit
    // quando total é reduzido por filtros).
    getNextPageParam: (lastPage) => {
      const consumed = lastPage.offset + lastPage.items.length
      return consumed < lastPage.total ? consumed : undefined
    },
    enabled: !!grupo,
  })

  /**
   * Backend já retorna mensagens em ordem cronológica reversa (DESC por
   * enviada_em). Replicamos o padrão do ConversasPage: reverte cada página
   * pra ASC e empilha — página 0 (mais recentes) vai por último, página N
   * (mais antigas) vai primeiro.
   */
  const mensagens = useMemo(() => {
    if (!data?.pages) return []
    const reversed = [...data.pages].reverse()
    return reversed.flatMap((p) => [...p.items].reverse())
  }, [data])

  const totalMensagens = mensagens.length
  const isEmpty = !isLoading && totalMensagens === 0

  // Refs para scroll style WhatsApp — idêntico ao ConversasPage.
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const didInitialScroll = useRef(false)
  const previousScrollHeight = useRef<number | null>(null)

  useEffect(() => {
    didInitialScroll.current = false
    previousScrollHeight.current = null
  }, [grupo.id])

  useLayoutEffect(() => {
    if (didInitialScroll.current) return
    if (isLoading || totalMensagens === 0) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    didInitialScroll.current = true
  }, [isLoading, totalMensagens])

  const loadOlder = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return
    const el = scrollRef.current
    if (el) previousScrollHeight.current = el.scrollHeight
    fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  useLayoutEffect(() => {
    const el = scrollRef.current
    const prev = previousScrollHeight.current
    if (!el || prev == null) return
    if (isFetchingNextPage) return
    const delta = el.scrollHeight - prev
    if (delta > 0) {
      el.scrollTop = el.scrollTop + delta
    }
    previousScrollHeight.current = null
  }, [isFetchingNextPage, totalMensagens])

  useEffect(() => {
    if (!hasNextPage) return
    const sentinel = sentinelRef.current
    const root = scrollRef.current
    if (!sentinel || !root) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadOlder()
      },
      {
        root,
        rootMargin: '120px 0px 0px 0px',
        threshold: 0,
      },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, loadOlder])

  return (
    <div className="flex flex-col h-full">
      {/* Header do chat */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--bg-surface)',
        }}
      >
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg transition-colors md:hidden"
          style={{ color: 'var(--text-3)' }}
          aria-label="Voltar para lista"
        >
          <ArrowLeft size={16} />
        </button>
        {/* Avatar do grupo */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-1)',
          }}
        >
          {(grupo.nome?.[0] ?? grupo.whatsapp[0] ?? '#').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium truncate"
            style={{ color: 'var(--text-1)' }}
          >
            {grupo.nome ?? grupo.whatsapp}
          </p>
          <p
            className="text-xs font-mono-data truncate"
            style={{ color: 'var(--text-3)' }}
          >
            {grupo.whatsapp}
          </p>
        </div>
        {/* Pílula clicável — abre drawer de participantes */}
        <button
          onClick={onOpenParticipantes}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex-shrink-0"
          style={{
            background: 'rgba(11,150,146,0.12)',
            border: '1px solid rgba(11,150,146,0.32)',
            color: '#a5b4fc',
          }}
          title="Ver participantes do grupo"
        >
          <Users2 size={12} />
          {grupo.total_participantes}
          {grupo.total_participantes === 1 ? ' participante' : ' participantes'}
        </button>
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isEmpty ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              variant="empty"
              size="sm"
              icon={MessageSquare}
              title="Nenhuma mensagem nesse grupo"
              description="Bots internos são filtrados automaticamente."
            />
          </div>
        ) : (
          <>
            <div ref={sentinelRef} />
            {hasNextPage ? (
              <div className="flex items-center justify-center py-3 text-xs" style={{ color: 'var(--text-3)' }}>
                {isFetchingNextPage ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" />
                    Carregando mensagens anteriores...
                  </span>
                ) : (
                  <span className="opacity-60">Role pra cima pra ver mais</span>
                )}
              </div>
            ) : (
              <div
                className="flex items-center justify-center py-3 text-[11px] uppercase tracking-wider"
                style={{ color: 'var(--text-3)' }}
              >
                Início da conversa
              </div>
            )}

            {(() => {
              let lastDay = ''
              const nodes: React.ReactNode[] = []
              for (let i = 0; i < mensagens.length; i++) {
                const msg = mensagens[i]
                const k = dayKey(msg.enviada_em)
                if (k && k !== lastDay) {
                  nodes.push(
                    <DateSeparator key={`sep-${k}`} dateStr={msg.enviada_em} />,
                  )
                  lastDay = k
                }
                nodes.push(<MensagemBubble key={msg.id} msg={msg} />)
              }
              return nodes
            })()}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GruposPage — página principal com lista + chat + drawer.
// ---------------------------------------------------------------------------

export default function GruposPage() {
  const { selectedTenant } = useTenantStore()
  const clienteId = selectedTenant?.id

  const [selectedGrupo, setSelectedGrupo] = useState<GrupoListItem | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('all')
  const [participantesOpen, setParticipantesOpen] = useState(false)

  // Debounce 300ms no search input — evita re-filtrar a cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const {
    data: grupos,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['grupos', clienteId],
    queryFn: () => gruposApi.listGrupos(clienteId!),
    enabled: !!clienteId,
    staleTime: 30_000,
  })

  // Filtros client-side: período (cutoff em ultima_interacao) + texto (nome/whatsapp).
  const gruposFiltrados = useMemo(() => {
    if (!grupos) return []
    const cutoff = periodoCutoff(periodo)
    const q = debouncedSearch.trim().toLowerCase()

    return grupos.filter((g) => {
      if (cutoff) {
        if (!g.ultima_interacao) return false
        try {
          if (new Date(g.ultima_interacao) < cutoff) return false
        } catch {
          return false
        }
      }
      if (q) {
        const haystack = `${g.nome ?? ''} ${g.whatsapp}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [grupos, periodo, debouncedSearch])

  // Se o grupo selecionado sumiu do filtro (ex: usuário mudou pra "24h" e o
  // grupo não teve atividade recente), limpa seleção.
  useEffect(() => {
    if (!selectedGrupo) return
    if (!gruposFiltrados.find((g) => g.id === selectedGrupo.id)) {
      setSelectedGrupo(null)
    }
  }, [gruposFiltrados, selectedGrupo])

  if (!selectedTenant) {
    return (
      <EmptyState
        variant="info"
        icon={Users2}
        title="Selecione um tenant"
        description="para visualizar os grupos"
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Título */}
      <div className="mb-4 flex-shrink-0">
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
          Grupos
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
          {selectedTenant.nome} · Conversas em grupo (bots filtrados)
        </p>
      </div>

      <div
        className="flex-1 overflow-hidden rounded-xl flex"
        style={{
          border: '1px solid var(--border)',
          background: 'var(--bg-surface)',
        }}
      >
        {/* Lista lateral */}
        <div
          className={`flex-shrink-0 overflow-hidden flex flex-col border-r ${
            selectedGrupo ? 'hidden md:flex' : 'flex w-full'
          } md:w-80`}
          style={{ borderColor: 'var(--border)' }}
        >
          {/* Header com busca + refresh */}
          <div
            className="px-4 py-3 border-b flex-shrink-0 space-y-2"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-3)' }}
              >
                {isLoading
                  ? 'Carregando...'
                  : `${gruposFiltrados.length}${grupos && gruposFiltrados.length !== grupos.length ? ` de ${grupos.length}` : ''} grupos`}
              </p>
              <div className="flex items-center gap-1.5">
                <SyncFotosButton
                  tipo="grupos"
                  invalidateKeys={[['grupos']]}
                  size="xs"
                />
                <button
                  onClick={() => refetch()}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-3)',
                  }}
                  title="Atualizar"
                  disabled={isFetching}
                >
                  <RefreshCw
                    size={12}
                    className={isFetching ? 'animate-spin' : undefined}
                  />
                </button>
              </div>
            </div>

            {/* Busca */}
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-3)' }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar grupo..."
                className="w-full h-8 pl-7 pr-7 rounded-lg text-xs outline-none transition-colors"
                style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${search ? 'rgba(11,150,146,0.5)' : 'var(--border-subtle)'}`,
                  color: 'var(--text-1)',
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded"
                  style={{ color: 'var(--text-3)' }}
                  aria-label="Limpar busca"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filtros de período — chips */}
            <div className="flex gap-1">
              {PERIODOS.map((p) => {
                const active = periodo === p.value
                return (
                  <button
                    key={p.value}
                    onClick={() => setPeriodo(p.value)}
                    className="flex-1 text-[11px] font-medium px-1.5 py-1 rounded-lg transition-all"
                    style={{
                      background: active
                        ? 'rgba(11,150,146,0.12)'
                        : 'var(--bg-card)',
                      border: `1px solid ${active ? 'rgba(11,150,146,0.5)' : 'var(--border-subtle)'}`,
                      color: active ? '#a5b4fc' : 'var(--text-2)',
                    }}
                    aria-pressed={active}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div
                      className="w-10 h-10 rounded-full flex-shrink-0"
                      style={{ background: 'var(--bg-elevated)' }}
                    />
                    <div className="flex-1 space-y-2">
                      <div
                        className="h-3 rounded w-3/4"
                        style={{ background: 'var(--bg-elevated)' }}
                      />
                      <div
                        className="h-2.5 rounded w-1/2"
                        style={{ background: 'var(--bg-elevated)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : isError ? (
              <div className="flex items-center justify-center flex-1 p-8 h-full">
                <EmptyState
                  variant="error"
                  icon={Users2}
                  title="Erro ao carregar grupos"
                  description="Verifique sua conexão e tente novamente"
                  action={{ label: 'Tentar novamente', onClick: () => refetch() }}
                />
              </div>
            ) : !gruposFiltrados.length ? (
              <div className="flex items-center justify-center flex-1 p-8 h-full">
                <EmptyState
                  variant="empty"
                  icon={Users2}
                  size="sm"
                  title={
                    grupos && grupos.length > 0
                      ? 'Nenhum grupo encontrado'
                      : 'Nenhum grupo ainda'
                  }
                  description={
                    grupos && grupos.length > 0
                      ? 'Ajuste a busca ou o período.'
                      : 'Aguarde sincronização com o provedor de mensagens.'
                  }
                />
              </div>
            ) : (
              gruposFiltrados.map((g) => (
                <GrupoItem
                  key={g.id}
                  grupo={g}
                  isSelected={selectedGrupo?.id === g.id}
                  onClick={() => setSelectedGrupo(g)}
                />
              ))
            )}
          </div>
        </div>

        {/* Chat */}
        <div
          className={`flex-1 min-w-0 overflow-hidden ${
            selectedGrupo ? 'flex flex-col' : 'hidden md:flex md:flex-col'
          }`}
        >
          {selectedGrupo && clienteId ? (
            <ChatPanel
              clienteId={clienteId}
              grupo={selectedGrupo}
              onBack={() => setSelectedGrupo(null)}
              onOpenParticipantes={() => setParticipantesOpen(true)}
            />
          ) : (
            <EmptyState
              variant="info"
              icon={Users2}
              title="Selecione um grupo"
              description="para ver as mensagens e participantes"
            />
          )}
        </div>
      </div>

      {/* Drawer de participantes */}
      {selectedGrupo && clienteId && (
        <ParticipantesDrawer
          clienteId={clienteId}
          grupo={selectedGrupo}
          open={participantesOpen}
          onClose={() => setParticipantesOpen(false)}
        />
      )}
    </div>
  )
}
