import { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { Virtuoso } from 'react-virtuoso'
import { useSearchParams } from 'react-router-dom'
import { MessageSquare, ArrowLeft, Mic, Image, FileText, Video, RefreshCw, SlidersHorizontal, X, Archive, AlertTriangle, Loader2, PanelRightClose, PanelRightOpen, Maximize2, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow, format, isToday, isYesterday, differenceInCalendarDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useTenantStore } from '../store/tenantStore'
import { useUIStore } from '../store/uiStore'
import { conversasApi, LeadDetalhe } from '../api/conversas'
import { tenantsApi } from '../api/tenants'
import { ConversaPreview, Mensagem, NumeroBot } from '../types'
import { DateRangePicker, DateRange } from '../components/DateRangePicker'
import LeadAvatar from '../components/ui/LeadAvatar'
import SyncFotosButton from '../components/ui/SyncFotosButton'
import ChannelIcon from '../components/ui/ChannelIcon'
import OpenActions from '../components/ui/OpenActions'
import { useHighlightRing } from '../hooks/useHighlightRing'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { semanticColors, normalizeTemperatura } from '../lib/semanticColors'
import { Pill, EmptyState, ConfirmModal, Popover } from '../components/ds'
import { FocusModeBar } from '../components/conversas/FocusModeBar'
import { ProximoPassoCard } from '../components/conversas/ProximoPassoCard'

function formatRelativeTime(dateStr: string) {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR })
  } catch {
    return ''
  }
}

function formatMessageTime(dateStr: string) {
  try {
    return format(new Date(dateStr), 'HH:mm', { locale: ptBR })
  } catch {
    return ''
  }
}

/**
 * Formata o rótulo do separador de data no chat, estilo WhatsApp:
 *   - Hoje
 *   - Ontem
 *   - <Dia da semana> (se foi nos últimos 6 dias)
 *   - dd de MMMM de yyyy (mais antigo)
 */
function formatDateSeparator(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isToday(d)) return 'Hoje'
    if (isYesterday(d)) return 'Ontem'
    const diff = differenceInCalendarDays(new Date(), d)
    if (diff > 1 && diff < 7) {
      // Dia da semana capitalizado (ex: "Segunda-feira")
      const name = format(d, 'EEEE', { locale: ptBR })
      return name.charAt(0).toUpperCase() + name.slice(1)
    }
    return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  } catch {
    return ''
  }
}

/**
 * Retorna uma chave estável do dia local de uma data ISO, pra comparar se duas
 * mensagens caem no mesmo dia (ignora hora/fuso).
 */
function dayKey(dateStr: string): string {
  try {
    return new Date(dateStr).toDateString()
  } catch {
    return ''
  }
}

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

type TipoNormalizado = 'texto' | 'audio' | 'imagem' | 'video' | 'documento'

/**
 * Normaliza o `tipo` da mensagem (que pode vir em formato Baileys/WhatsApp como
 * `Conversation`, `ExtendedTextMessage`, `ImageMessage`, `AudioMessage`, etc.,
 * ou formato legado como `texto`, `imagem`) para um conjunto padronizado.
 */
function normalizeTipoMensagem(tipo?: string | null): TipoNormalizado {
  if (!tipo) return 'texto'
  const t = tipo.toLowerCase()
  if (t.includes('audio') || t === 'ptt') return 'audio'
  if (t.includes('image') || t === 'imagem') return 'imagem'
  if (t.includes('video')) return 'video'
  if (t.includes('document') || t === 'documento') return 'documento'
  // Conversation, ExtendedTextMessage, texto, text → texto
  return 'texto'
}

function MidiaBadge({ tipo }: { tipo: string }) {
  const norm = normalizeTipoMensagem(tipo)
  const map: Record<TipoNormalizado, { icon: React.ElementType; label: string } | null> = {
    texto: null,
    audio: { icon: Mic, label: 'Áudio' },
    imagem: { icon: Image, label: 'Imagem' },
    video: { icon: Video, label: 'Vídeo' },
    documento: { icon: FileText, label: 'Documento' },
  }
  const entry = map[norm]
  if (!entry) return null
  const Icon = entry.icon
  return (
    <span className="flex items-center gap-1 text-gray-500 text-xs italic">
      <Icon size={12} />
      {entry.label}
    </span>
  )
}

function ConversaItem({
  conversa,
  isSelected,
  onClick,
}: {
  conversa: ConversaPreview
  isSelected: boolean
  onClick: () => void
}) {
  // Mesma identidade visual da lista de leads do dashboard:
  // anel colorido pela temperatura + badge de score flutuante + pílula de temperatura.
  const tempKey = normalizeTemperatura(conversa.temperatura)
  const tempColor = tempKey ? semanticColors.temperatura[tempKey] : '#6b7280'
  const scoreVal = conversa.score
  const hasScore = scoreVal != null

  return (
    <button
      onClick={onClick}
      data-lead-id={conversa.lead_id}
      className="w-full text-left px-4 py-3 transition-colors flex items-center gap-3"
      style={{
        background: isSelected ? 'rgba(11,150,146,0.1)' : 'transparent',
        borderLeft: isSelected ? '3px solid var(--brand-500)' : '3px solid transparent',
      }}
    >
      {/* Avatar com anel por temperatura + badge de score flutuante */}
      <div className="relative shrink-0">
        <LeadAvatar
          name={conversa.nome}
          fallback={conversa.whatsapp}
          temperatura={conversa.temperatura}
          fotoUrl={conversa.foto_url}
          size={40}
        />
        {hasScore && (
          <span
            className="absolute -bottom-1 -right-1 rounded-full text-[9px] font-bold flex items-center justify-center font-mono-data"
            style={{
              width: 18, height: 18,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: '#eab308',
            }}
            title="Score"
          >
            {scoreVal!.toFixed(0)}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-white truncate">
            {conversa.nome || conversa.whatsapp}
          </p>
          {conversa.enviada_em && (
            <span className="text-xs text-gray-600 flex-shrink-0">
              {formatRelativeTime(conversa.enviada_em)}
            </span>
          )}
        </div>
        {/* Pílula de temperatura — só ela, sem ícone do canal nem número */}
        {conversa.temperatura && (
          <div className="mt-0.5">
            <span
              className="text-[10px] font-medium capitalize"
              style={{ color: tempColor }}
            >
              ● {conversa.temperatura}
            </span>
          </div>
        )}
        {/* Última mensagem */}
        <div className="flex items-center gap-1 mt-0.5 min-w-0">
          {conversa.direcao_ultima === 'saida' && (
            <span className="text-xs text-gray-600 flex-shrink-0">Você:</span>
          )}
          {(() => {
            const tipoNorm = normalizeTipoMensagem(conversa.tipo_ultima)
            // Priority 1: text content if present (covers Conversation/ExtendedTextMessage)
            if (conversa.ultima_mensagem) {
              return (
                <p className="text-xs text-gray-500 truncate flex-1 min-w-0">
                  {conversa.ultima_mensagem}
                </p>
              )
            }
            // Priority 2: media badge for known media types
            if (tipoNorm !== 'texto') {
              return (
                <div className="flex-shrink-0">
                  <MidiaBadge tipo={tipoNorm} />
                </div>
              )
            }
            // Fallback
            return (
              <p className="text-xs text-gray-500 truncate flex-1 min-w-0">—</p>
            )
          })()}
        </div>
      </div>
    </button>
  )
}

function SenderBadge({ enviado_por }: { enviado_por?: string | null }) {
  if (!enviado_por) return null
  if (enviado_por === 'IA') {
    return (
      <Pill tone="role:admin" size="xs" className="font-semibold mb-1">
        ✦ IA
      </Pill>
    )
  }
  if (enviado_por === 'Studio') {
    return (
      <Pill tone="status:active" size="xs" className="font-semibold mb-1">
        ● Consultor
      </Pill>
    )
  }
  return null
}

type BadgeIA = 'destaque' | 'objecao' | null

interface MensagemBubbleProps {
  msg: Mensagem
  leadNome?: string
  /**
   * Badge IA inline no footer da bolha quando a IA destacou esta msg:
   * - 'destaque': conteúdo bate com analise_extra.frases_ditas_lead
   *               (IA considerou relevante — ex: revela intenção, dúvida)
   * - 'objecao': conteúdo bate com analise_extra.frases_chave_negativas
   *              (IA marcou como objeção/resistência)
   * - null: sem badge
   */
  badgeIA?: BadgeIA
}

function MensagemBubble({ msg, leadNome, badgeIA }: MensagemBubbleProps) {
  const isOutgoing = msg.direcao === 'saida'

  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-[70%] flex flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}>
        {isOutgoing
          ? <SenderBadge enviado_por={msg.enviado_por} />
          : <span className="text-[10px] text-gray-500 mb-0.5 px-1">{leadNome || 'Lead'}</span>
        }
        <div
          className="rounded-2xl px-4 py-2.5 w-full"
          style={
            isOutgoing
              ? msg.enviado_por === 'IA'
                ? { background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.3)', borderBottomRightRadius: 4 }
                : msg.enviado_por === 'Studio'
                ? { background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', borderBottomRightRadius: 4 }
                : { background: 'rgba(11,150,146,0.25)', borderBottomRightRadius: 4 }
              : { background: 'var(--bg-card)', border: '1px solid var(--border)', borderBottomLeftRadius: 4 }
          }
        >
          {msg.conteudo ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words" style={{ color: isOutgoing ? 'var(--text-1)' : 'var(--text-1)' }}>
              {msg.conteudo}
            </p>
          ) : (
            <MidiaBadge tipo={msg.tipo} />
          )}
          <div className={`flex items-center gap-2 mt-1 ${badgeIA ? 'justify-between' : 'justify-end'}`}>
            {badgeIA === 'destaque' && (
              <span
                title="IA destacou esta mensagem como relevante (frase dita do lead)"
                className="inline-flex items-center gap-1 text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded"
                style={{
                  background: 'rgba(37,200,189,0.14)',
                  color: '#a5b4fc',
                  border: '1px solid rgba(37,200,189,0.32)',
                }}
              >
                <Zap size={10} />
                IA DESTACOU
              </span>
            )}
            {badgeIA === 'objecao' && (
              <span
                title="IA identificou esta mensagem como objeção/frase-chave negativa"
                className="inline-flex items-center gap-1 text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded"
                style={{
                  background: 'rgba(239,68,68,0.12)',
                  color: '#f87171',
                  border: '1px solid rgba(239,68,68,0.32)',
                }}
              >
                <AlertTriangle size={10} />
                OBJEÇÃO
              </span>
            )}
            <p className={`text-xs ${isOutgoing ? 'text-brand-300/60' : 'text-gray-600'}`}>
              {formatMessageTime(msg.enviada_em)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Tamanho da página de mensagens — 50 igual WhatsApp.
const MESSAGES_PAGE_SIZE = 50

function ChatPanel({
  clienteId,
  conversa,
  leadDetalhe,
  onBack,
  onInativar,
  insightsHidden,
  onShowInsights,
  focusMode,
  onEnterFocusMode,
  onExitFocusMode,
}: {
  clienteId: string
  conversa: ConversaPreview
  /** Detalhe do lead; passamos do ConversasPage pra evitar duplicar a query. */
  leadDetalhe: LeadDetalhe | undefined
  onBack: () => void
  onInativar: () => void
  /** Quando true, o painel de Insights está oculto e o ChatPanel mostra um botão pra reabrir. */
  insightsHidden: boolean
  onShowInsights: () => void
  /** Modo Atendimento — quando true, mostra FocusModeBar + ProximoPassoCard no topo. */
  focusMode: boolean
  onEnterFocusMode: () => void
  onExitFocusMode: () => void
}) {
  // ── Paginação estilo WhatsApp ────────────────────────────────────────
  // Backend retorna em order=desc (mais recentes primeiro), uma página de
  // MESSAGES_PAGE_SIZE por vez. Frontend reverte cada página pra exibir em
  // ordem crescente (antigas em cima, recentes em baixo) e empilha:
  //   [...página_mais_antiga, ..., ...página_mais_recente]
  // `hasNextPage` = true enquanto a última página retornada vier cheia.
  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['conversations', clienteId, conversa.lead_id, 'messages'],
    queryFn: ({ pageParam = 0 }) =>
      conversasApi.getMessages(clienteId, conversa.lead_id, {
        limit: MESSAGES_PAGE_SIZE,
        offset: pageParam as number,
        order: 'desc',
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < MESSAGES_PAGE_SIZE ? undefined : allPages.length * MESSAGES_PAGE_SIZE,
    enabled: !!conversa,
  })

  // Achata e ordena cronológico (antigas → recentes). Cada página vem DESC, então
  // revertemos em bloco e concatenamos: página mais recente (offset=0) vai por
  // último, página mais antiga (offset alto) vai primeiro.
  const mensagens = useMemo(() => {
    if (!data?.pages) return []
    // pages[0] = 50 mais recentes (DESC), pages[1] = 50 anteriores (DESC), ...
    // Queremos: [...mais antigas ASC, ..., ...mais recentes ASC]
    const reversed = [...data.pages].reverse() // página mais antiga primeiro
    return reversed.flatMap((p) => [...p].reverse())
  }, [data])

  const totalMensagens = mensagens.length
  const isEmpty = !isLoading && totalMensagens === 0

  // Última mensagem com direção "entrada" (vinda do lead) — usada pelo
  // timer do FocusModeBar pra mostrar "há X min" com cor dinâmica.
  const ultimaEntradaEm = useMemo(() => {
    if (!mensagens.length) return null
    for (let i = mensagens.length - 1; i >= 0; i--) {
      if (mensagens[i].direcao === 'entrada') return mensagens[i].enviada_em
    }
    return null
  }, [mensagens])

  // ── Refs e lógica de scroll ────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const didInitialScroll = useRef(false)
  const previousScrollHeight = useRef<number | null>(null)

  // Reset ao trocar de conversa.
  useEffect(() => {
    didInitialScroll.current = false
    previousScrollHeight.current = null
  }, [conversa.lead_id])

  // Scroll inicial pro fim após a primeira página carregar.
  useLayoutEffect(() => {
    if (didInitialScroll.current) return
    if (isLoading || totalMensagens === 0) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    didInitialScroll.current = true
  }, [isLoading, totalMensagens])

  // Antes de carregar mais (scroll up), capturar a altura atual pra preservar
  // a posição após o DOM crescer pra cima.
  const loadOlder = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return
    const el = scrollRef.current
    if (el) previousScrollHeight.current = el.scrollHeight
    fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Após as mensagens antigas serem inseridas no DOM, ajustar scrollTop
  // pra preservar a posição relativa do conteúdo visível.
  useLayoutEffect(() => {
    const el = scrollRef.current
    const prev = previousScrollHeight.current
    if (!el || prev == null) return
    if (isFetchingNextPage) return // só ajusta quando o fetch terminou
    const delta = el.scrollHeight - prev
    if (delta > 0) {
      el.scrollTop = el.scrollTop + delta
    }
    previousScrollHeight.current = null
  }, [isFetchingNextPage, totalMensagens])

  // IntersectionObserver no topo dispara loadOlder quando o sentinel aparece.
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
        // Pre-fetch um pouco antes de chegar no topo, pra UX mais fluida.
        rootMargin: '120px 0px 0px 0px',
        threshold: 0,
      }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, loadOlder])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
      >
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors md:hidden"
        >
          <ArrowLeft size={16} />
        </button>
        {/* Avatar com anel por temperatura + badge de score (mesma identidade da lista) */}
        <div className="relative shrink-0">
          <LeadAvatar
            name={conversa.nome}
            fallback={conversa.whatsapp}
            temperatura={conversa.temperatura}
            fotoUrl={conversa.foto_url}
            size={36}
          />
          {conversa.score != null && (
            <span
              className="absolute -bottom-1 -right-1 rounded-full text-[9px] font-bold flex items-center justify-center font-mono-data"
              style={{
                width: 16, height: 16,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: '#eab308',
              }}
              title="Score"
            >
              {conversa.score.toFixed(0)}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{conversa.nome || conversa.whatsapp}</p>
          {conversa.nome && (
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <ChannelIcon channel="whatsapp" size={10} />
              <span className="font-mono-data">{conversa.whatsapp}</span>
            </p>
          )}
          {/* Deep links pra Kanban/Dashboard — Ctrl+click abre em nova aba */}
          <OpenActions
            leadId={conversa.lead_id}
            excludeCurrent="conversa"
            showDashboard
            className="mt-1.5"
          />
        </div>
        {/* Modo Atendimento — só aparece em md+ (no mobile o espaço é curto). */}
        {!focusMode && (
          <button
            onClick={onEnterFocusMode}
            className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors flex-shrink-0"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-2)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-card)')}
            title="Entrar no modo atendimento (tela cheia)"
          >
            <Maximize2 size={12} />
            Foco
          </button>
        )}
        {/* Mostrar painel de Insights — só aparece quando ele está oculto */}
        {insightsHidden && (
          <button
            onClick={onShowInsights}
            className="p-2 rounded-lg text-gray-400 hover:text-white transition-colors flex-shrink-0"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
            }}
            title="Mostrar painel de insights"
          >
            <PanelRightOpen size={14} />
          </button>
        )}
        <button
          onClick={onInativar}
          className="p-2 rounded-lg text-gray-400 hover:text-red-400 transition-colors flex-shrink-0"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
          }}
          title="Inativar lead"
        >
          <Archive size={14} />
        </button>
      </div>

      {/* Modo Atendimento — bar + próximo passo ficam fixos acima do scroll. */}
      {focusMode && (
        <FocusModeBar
          conversa={conversa}
          ultimaEntradaEm={ultimaEntradaEm}
          onExit={onExitFocusMode}
        />
      )}
      {focusMode && leadDetalhe?.analise?.proximo_passo?.trim() && (
        <ProximoPassoCard texto={leadDetalhe.analise.proximo_passo} />
      )}

      {/* Messages — scroll WhatsApp-like: foco no fim, scroll up carrega mais */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isEmpty ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState variant="empty" size="sm" title="Nenhuma mensagem encontrada" />
          </div>
        ) : (
          <>
            {/* Sentinel + indicador no topo: enquanto há mais páginas, mostra
                "Carregando mais..."; quando chega no início real, mostra
                "Início da conversa". O sentinel é o gatilho do IntersectionObserver. */}
            <div ref={sentinelRef} />
            {hasNextPage ? (
              <div className="flex items-center justify-center py-3 text-xs text-gray-600">
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
              <div className="flex items-center justify-center py-3 text-[11px] text-gray-700 uppercase tracking-wider">
                Início da conversa
              </div>
            )}

            {(() => {
              // Renderiza msgs ASC intercalando separadores de data (Hoje / Ontem / dd de ...)
              // sempre que a data muda em relação à msg anterior.
              //
              // Badge IA inline no footer da bolha, baseado em frases que a IA
              // extraiu da conversa (analise_extra.frases_ditas_lead e
              // frases_chave_negativas — arrays de strings que batem 1:1 com
              // conteúdo de mensagens individuais). Match exato normalizado
              // (trim + lowercase), Sets pra lookup O(1).
              const extra = leadDetalhe?.analise_extra
              const normaliza = (s: string) => s.trim().toLowerCase()
              const setDestaque = new Set(
                (extra?.frases_ditas_lead ?? []).map(normaliza),
              )
              const setObjecao = new Set(
                (extra?.frases_chave_negativas ?? []).map(normaliza),
              )
              const badgeFor = (conteudo: string | null | undefined): BadgeIA => {
                if (!conteudo) return null
                const k = normaliza(conteudo)
                // Objecao tem prioridade visual (sinal negativo mais forte)
                if (setObjecao.has(k)) return 'objecao'
                if (setDestaque.has(k)) return 'destaque'
                return null
              }

              let lastDay = ''
              const nodes: React.ReactNode[] = []
              for (let i = 0; i < mensagens.length; i++) {
                const msg = mensagens[i]
                const k = dayKey(msg.enviada_em)
                if (k && k !== lastDay) {
                  nodes.push(<DateSeparator key={`sep-${k}`} dateStr={msg.enviada_em} />)
                  lastDay = k
                }
                nodes.push(
                  <MensagemBubble
                    key={msg.id}
                    msg={msg}
                    leadNome={conversa.nome || conversa.whatsapp}
                    badgeIA={badgeFor(msg.conteudo)}
                  />
                )
              }
              return nodes
            })()}
          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 border-b border-white/5 pb-1">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-3 gap-y-2">{children}</div>
}

function Info({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <div className="text-sm font-medium text-white break-words">{children}</div>
    </div>
  )
}

function InsightsPanel({
  lead,
  loading,
  onClose,
}: {
  lead: LeadDetalhe | undefined
  loading: boolean
  /** Botão "ocultar" — se omitido, painel não tem botão de fechar. */
  onClose?: () => void
}) {
  const fmt = (v: unknown) => (v != null && String(v).trim() !== '') ? String(v) : '—'
  const fmtDate = (iso?: string) => {
    if (!iso) return '—'
    try { return format(new Date(iso), 'dd/MM/yyyy HH:mm') } catch { return '—' }
  }
  const tempColor = (t?: string) =>
    t === 'quente' ? 'text-red-400' : t === 'morno' ? 'text-orange-400' : t === 'frio' ? 'text-blue-400' : 'text-gray-400'
  const sentColor = (s?: string) =>
    s === 'positivo' ? 'text-green-400' : s === 'negativo' ? 'text-red-400' : s === 'misto' ? 'text-yellow-400' : 'text-gray-400'

  return (
    <div className="w-80 shrink-0 border-l flex flex-col overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      <div
        className="px-4 py-3 border-b shrink-0 flex items-center justify-between gap-2"
        style={{ borderColor: 'var(--border)' }}
      >
        <h3 className="font-semibold text-white text-sm">Insights do Lead</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 -mr-1 rounded-md text-gray-500 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0"
            title="Ocultar painel"
            aria-label="Ocultar painel de insights"
          >
            <PanelRightClose size={14} />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-sm">
        {loading ? (
          <div className="space-y-3">{[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="h-4 bg-white/10 rounded animate-pulse" style={{width: `${60 + (i % 3) * 15}%`}} />
          ))}</div>
        ) : (
          <>
            <Section title="STATUS">
              <Grid2>
                <Info label="Temperatura"><span className={tempColor(lead?.temperatura)}>{fmt(lead?.temperatura)}</span></Info>
                <Info label="Etapa do Funil">{fmt(lead?.etapa_funil)}</Info>
                <Info label="Score">{lead?.score != null ? lead.score.toFixed(1) : '—'}</Info>
                <Info label="Origem">{fmt(lead?.origem)}</Info>
                <Info label="Follow-up">{fmtDate(lead?.followup_em)}</Info>
                <Info label="Recorrente">{lead?.lead_recorrente ? 'Sim' : 'Não'}</Info>
                <Info label="Bloqueado">{lead?.bloqueado ? <span className="text-red-400">Sim</span> : 'Não'}</Info>
                <Info label="1ª Resposta Bot">{fmtDate(lead?.primeiraresposta_em)}</Info>
              </Grid2>
            </Section>

            <Section title="PERFIL (IA)">
              <Grid2>
                <Info label="Cidade">{fmt(lead?.cidade_lead)}</Info>
                <Info label="Estado">{fmt(lead?.estado_lead)}</Info>
                <Info label="Perfil">{fmt(lead?.perfil_lead)}</Info>
                <Info label="Gênero">{fmt(lead?.analise_extra?.genero)}</Info>
                <Info label="Oportunidade">
                  {lead?.analise_extra?.oportunidade_aberta === true
                    ? <span className="text-green-400">Aberta ✓</span>
                    : lead?.analise_extra?.oportunidade_aberta === false
                    ? <span className="text-red-400">Não</span>
                    : '—'}
                </Info>
              </Grid2>
            </Section>

            {lead?.analise && (
              <Section title="ANÁLISE IA">
                <Grid2>
                  <Info label="Sentimento">
                    <span className={sentColor(lead.analise.sentimento)}>{fmt(lead.analise.sentimento)}</span>
                  </Info>
                  <Info label="Score IA">{lead.analise.score_interesse != null ? lead.analise.score_interesse.toFixed(1) : '—'}</Info>
                </Grid2>
                {lead.analise.intencao && <Info label="Intenção" full>{lead.analise.intencao}</Info>}
                {lead.analise.proximo_passo && <Info label="Próximo Passo" full>{lead.analise.proximo_passo}</Info>}
                {lead.analise.resumo_curto && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Resumo</p>
                    <p className="text-xs text-gray-300 leading-relaxed line-clamp-4">{lead.analise.resumo_curto}</p>
                  </div>
                )}
              </Section>
            )}

            {lead?.analise_extra && (lead.analise_extra.motivo_nao_fechamento || lead.analise_extra.motivo_desistencia || lead.analise_extra.melhoria_atendimento || lead.analise_extra.melhoria_negociacao) && (
              <Section title="OBJEÇÕES">
                {lead.analise_extra.motivo_nao_fechamento && <Info label="Motivo Não Fechamento" full>{lead.analise_extra.motivo_nao_fechamento}</Info>}
                {lead.analise_extra.motivo_desistencia && <Info label="Motivo Desistência" full>{lead.analise_extra.motivo_desistencia}</Info>}
                {lead.analise_extra.melhoria_atendimento && <Info label="Melhoria Atendimento" full>{lead.analise_extra.melhoria_atendimento}</Info>}
                {lead.analise_extra.melhoria_negociacao && <Info label="Melhoria Negociação" full>{lead.analise_extra.melhoria_negociacao}</Info>}
              </Section>
            )}


            <Section title="DATAS">
              <Grid2>
                <Info label="Primeiro contato">{fmtDate(lead?.created_at)}</Info>
                <Info label="Última interação">{fmtDate(lead?.updated_at)}</Info>
              </Grid2>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

// ── Filtros auxiliares ─────────────────────────────────────────────────────
const TEMPERATURA_OPTIONS = [
  { value: 'quente', label: 'Quente', color: '#ef4444' },
  { value: 'morno', label: 'Morno', color: '#f59e0b' },
  { value: 'frio', label: 'Frio', color: '#3b82f6' },
]
const SENTIMENTO_OPTIONS = [
  { value: 'positivo', label: 'Positivo', color: '#22c55e' },
  { value: 'neutro', label: 'Neutro', color: '#94a3b8' },
  { value: 'negativo', label: 'Negativo', color: '#ef4444' },
]

interface ConversaFilters {
  /** Busca global por nome ou WhatsApp do lead. Acumula com os outros filtros. */
  search: string
  temperatura: string | null
  etapa: string | null
  sentimento: string | null
  telefone_bot: string | null
}

const EMPTY_FILTERS: ConversaFilters = { search: '', temperatura: null, etapa: null, sentimento: null, telefone_bot: null }

function FilterPopoverButton({
  etapas,
  numeros,
  filters,
  onChange,
}: {
  etapas: string[]
  numeros: { id: string; numero: string; nome: string | null }[]
  filters: ConversaFilters
  onChange: (f: ConversaFilters) => void
}) {
  const [open, setOpen] = useState(false)

  const activeCount = [filters.search.trim() || null, filters.temperatura, filters.etapa, filters.sentimento, filters.telefone_bot].filter(Boolean).length
  const hasActive = activeCount > 0

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      side="bottom"
      align="start"
      width={240}
      aria-label="Filtros"
      trigger={
        <button
          className="relative p-1.5 rounded-lg transition-colors"
          style={{
            background: open || hasActive ? 'rgba(11,150,146,0.12)' : 'var(--bg-card)',
            border: `1px solid ${open || hasActive ? 'rgba(11,150,146,0.4)' : 'var(--border-subtle)'}`,
            color: hasActive ? '#25c8bd' : 'var(--text-3)',
          }}
          title="Filtros"
        >
          <SlidersHorizontal size={12} />
          {hasActive && (
            <span
              className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full text-[9px] font-bold flex items-center justify-center px-1 leading-none"
              style={{ background: 'var(--brand-500)', color: '#fff' }}
            >
              {activeCount}
            </span>
          )}
        </button>
      }
    >
      <div className="overflow-hidden rounded-xl">
        {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
              Filtros
            </span>
            <div className="flex items-center gap-1">
              {hasActive && (
                <button
                  onClick={() => onChange(EMPTY_FILTERS)}
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors"
                  style={{ color: 'var(--text-3)' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#25c8bd')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)')}
                >
                  Limpar
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--text-3)' }}
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* Busca global — acumula com os outros filtros */}
          <div className="p-3 space-y-1.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
              Buscar
            </p>
            <div className="relative">
              <input
                type="text"
                value={filters.search}
                onChange={(e) => onChange({ ...filters, search: e.target.value })}
                placeholder="Nome ou WhatsApp..."
                className="w-full text-[12px] px-2.5 py-1.5 pr-7 rounded-lg outline-none transition-colors"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-1)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(11,150,146,0.4)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() => onChange({ ...filters, search: '' })}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors"
                  style={{ color: 'var(--text-3)' }}
                  aria-label="Limpar busca"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Temperatura */}
          <div className="p-3 space-y-1.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
              Temperatura
            </p>
            <div className="flex gap-1">
              {TEMPERATURA_OPTIONS.map((opt) => {
                const active = filters.temperatura === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => onChange({ ...filters, temperatura: active ? null : opt.value })}
                    className="flex-1 text-[11px] font-medium px-1.5 py-1.5 rounded-lg transition-all"
                    style={{
                      background: active ? `${opt.color}22` : 'var(--bg-card)',
                      border: `1px solid ${active ? opt.color : 'var(--border-subtle)'}`,
                      color: active ? opt.color : 'var(--text-2)',
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Etapa do funil */}
          <div className="p-3 space-y-1.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
              Etapa do funil
            </p>
            <select
              value={filters.etapa ?? ''}
              onChange={(e) => onChange({ ...filters, etapa: e.target.value || null })}
              className="w-full h-8 rounded-lg border px-2 text-xs outline-none transition-colors"
              style={{
                background: 'var(--bg-card)',
                borderColor: filters.etapa ? 'rgba(11,150,146,0.5)' : 'var(--border-subtle)',
                color: 'var(--text-1)',
              }}
            >
              <option value="">Todas</option>
              {etapas.map((et) => (
                <option key={et} value={et}>
                  {et}
                </option>
              ))}
            </select>
          </div>

          {/* Sentimento */}
          <div className="p-3 space-y-1.5" style={{ borderBottom: numeros.length >= 2 ? '1px solid var(--border-subtle)' : undefined }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
              Sentimento
            </p>
            <div className="flex gap-1">
              {SENTIMENTO_OPTIONS.map((opt) => {
                const active = filters.sentimento === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => onChange({ ...filters, sentimento: active ? null : opt.value })}
                    className="flex-1 text-[11px] font-medium px-1.5 py-1.5 rounded-lg transition-all"
                    style={{
                      background: active ? `${opt.color}22` : 'var(--bg-card)',
                      border: `1px solid ${active ? opt.color : 'var(--border-subtle)'}`,
                      color: active ? opt.color : 'var(--text-2)',
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Número — só exibe quando tenant tem 2+ números */}
          {numeros.length >= 2 && (
            <div className="p-3 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                Número
              </p>
              <select
                value={filters.telefone_bot ?? ''}
                onChange={(e) => onChange({ ...filters, telefone_bot: e.target.value || null })}
                className="w-full h-8 rounded-lg border px-2 text-xs outline-none transition-colors"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: filters.telefone_bot ? 'rgba(11,150,146,0.5)' : 'var(--border-subtle)',
                  color: 'var(--text-1)',
                }}
              >
                <option value="">Todos</option>
                {numeros.map((n) => (
                  <option key={n.id} value={n.numero}>
                    {n.nome || n.numero}
                  </option>
                ))}
              </select>
            </div>
          )}
      </div>
    </Popover>
  )
}

// Chave do localStorage pra preferência de visibilidade do painel de insights.
const INSIGHTS_OPEN_KEY = 'conversas:insightsOpen'

export default function ConversasPage() {
  const { selectedTenant } = useTenantStore()
  const queryClient = useQueryClient()
  const clienteId = selectedTenant?.id
  const [selectedConversa, setSelectedConversa] = useState<ConversaPreview | null>(null)
  const [inativarTarget, setInativarTarget] = useState<ConversaPreview | null>(null)

  // Modo Atendimento: esconde Sidebar/Header (via Layout) + lista de conversas,
  // deixando o ChatPanel + InsightsPanel como centro da tela.
  const focusMode = useUIStore((s) => s.focusMode)
  const setFocusMode = useUIStore((s) => s.setFocusMode)
  const exitFocusMode = useUIStore((s) => s.exitFocusMode)

  // ESC sai do modo foco. O hook respeita [role=dialog]/[role=alertdialog]
  // abertos (Popover de filtros, ConfirmModal de inativar), então não colide
  // com a UX desses componentes do DS.
  useEscapeKey(focusMode, () => setFocusMode(false))

  // Cleanup: ao desmontar a página (navegação), garante que sai do modo foco.
  useEffect(() => {
    return () => exitFocusMode()
  }, [exitFocusMode])
  // Deep linking: `?leadId=<uuid>` abre a conversa correspondente quando a
  // lista carregar. `&highlight=1` (tratado pelo useHighlightRing) aplica
  // ring-pulse no item-alvo.
  const [searchParams, setSearchParams] = useSearchParams()
  const urlLeadId = searchParams.get('leadId')
  // Indica que a URL trouxe um leadId mas ele não existe na lista atual (com
  // os filtros/período correntes). Mostramos um banner oferecendo "Limpar
  // filtros" pra liberar o lead.
  const [leadNotFound, setLeadNotFound] = useState(false)

  // Segurança: ao trocar de empresa, limpa toda state vinculada ao tenant anterior.
  const prevClienteIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (prevClienteIdRef.current === undefined) {
      prevClienteIdRef.current = clienteId
      return
    }
    if (prevClienteIdRef.current === clienteId) return
    prevClienteIdRef.current = clienteId

    setSelectedConversa(null)
    setFocusMode(false)
    setSearchParams({}, { replace: true })
    queryClient.removeQueries({ queryKey: ['conversations'] })
    queryClient.removeQueries({ queryKey: ['lead-detalhe'] })
  }, [clienteId])

  // Pinta o anel ao redor do ConversaItem selecionado quando `highlight=1`.
  useHighlightRing(selectedConversa?.lead_id)

  // Painel de Insights: aberto por padrão, com toggle persistido em localStorage.
  // Se a preferência salva for inválida ou ausente, default = true.
  const [insightsOpen, setInsightsOpen] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(INSIGHTS_OPEN_KEY)
      if (raw === null) return true
      return raw === 'true'
    } catch {
      return true
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(INSIGHTS_OPEN_KEY, String(insightsOpen))
    } catch {
      /* localStorage indisponível — ignora silenciosamente */
    }
  }, [insightsOpen])

  const inativarMutation = useMutation({
    mutationFn: (leadId: string) => conversasApi.inativarLead(clienteId!, leadId),
    onSuccess: async (_data, leadId) => {
      toast.success('Lead inativado com sucesso')
      // Limpa seleção se era a conversa aberta
      if (selectedConversa?.lead_id === leadId) {
        setSelectedConversa(null)
        // Sai do modo foco — sem conversa, o ChatPanel fica vazio e não faz
        // sentido continuar em tela cheia.
        setFocusMode(false)
      }
      setInativarTarget(null)
      // Invalida tudo que depende de Lead.ativo
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['conversations', clienteId] }),
        queryClient.invalidateQueries({ queryKey: ['conversations-etapas', clienteId] }),
        queryClient.invalidateQueries({ queryKey: ['lead-detalhe', clienteId] }),
        queryClient.invalidateQueries({ queryKey: ['kanban'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
    },
    onError: () => {
      toast.error('Não foi possível inativar o lead. Tente novamente.')
    },
  })
  // Inicialmente sem filtro de data — lista todas as conversas. O usuário escolhe
  // quando/se quer aplicar um período.
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [filters, setFilters] = useState<ConversaFilters>(EMPTY_FILTERS)

  // Debounce só do `search` — quando o usuário digita, espera 350ms antes de
  // refazer a query (evita uma request por tecla).
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search.trim()), 350)
    return () => clearTimeout(t)
  }, [filters.search])

  const baseQueryParams = useMemo(() => ({
    ...(dateRange && {
      data_inicio: format(dateRange.inicio, 'yyyy-MM-dd'),
      data_fim: format(dateRange.fim, 'yyyy-MM-dd'),
    }),
    ...(filters.temperatura && { temperatura: filters.temperatura }),
    ...(filters.etapa && { etapa_funil: filters.etapa }),
    ...(filters.sentimento && { sentimento: filters.sentimento }),
    ...(filters.telefone_bot && { telefone_bot: filters.telefone_bot }),
    ...(debouncedSearch && { search: debouncedSearch }),
  }), [dateRange, filters.temperatura, filters.etapa, filters.sentimento, filters.telefone_bot, debouncedSearch])

  const { data: numerosDoTenant = [] } = useQuery<NumeroBot[]>({
    queryKey: ['tenant-numeros', clienteId],
    queryFn: () => tenantsApi.getNumeros(clienteId!),
    enabled: !!clienteId,
    staleTime: 5 * 60_000,
  })

  const { data: etapas = [] } = useQuery({
    queryKey: ['conversations-etapas', clienteId],
    queryFn: () => conversasApi.getConversationsEtapas(clienteId!),
    enabled: !!clienteId,
    staleTime: 5 * 60_000,
  })

  // Paginação infinita: 100 contatos por página, scroll infinito.
  // refetchInterval: 30s atualiza só a primeira página pra não resetar scroll.
  const CONVERSAS_PAGE_SIZE = 100
  const {
    data: conversasPaginated,
    isLoading,
    isFetching,
    isFetchingNextPage,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'conversations',
      clienteId,
      baseQueryParams.data_inicio ?? null,
      baseQueryParams.data_fim ?? null,
      filters.temperatura,
      filters.etapa,
      filters.sentimento,
      filters.telefone_bot,
      debouncedSearch,
    ],
    queryFn: ({ pageParam = 0 }) =>
      conversasApi.getConversations(clienteId!, {
        ...baseQueryParams,
        offset: pageParam as number,
        limit: CONVERSAS_PAGE_SIZE,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_offset ?? undefined : undefined,
    enabled: !!clienteId,
    refetchInterval: 30_000,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  })

  // Achata todas as páginas em uma única lista
  const conversas = useMemo(() => {
    if (!conversasPaginated) return undefined
    return conversasPaginated.pages.flatMap((p) => p.items)
  }, [conversasPaginated])

  const conversasTotal = conversasPaginated?.pages[0]?.total ?? 0

  const loadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage()
    }
  }, [isFetchingNextPage, hasNextPage, fetchNextPage])

  /** Quantos filtros (incluindo busca) estão ativos — usado no empty state. */
  const activeFiltersCount = [
    filters.search.trim() || null,
    filters.temperatura,
    filters.etapa,
    filters.sentimento,
    filters.telefone_bot,
    dateRange,
  ].filter(Boolean).length

  const { data: leadDetalhe, isLoading: loadingDetalhe } = useQuery({
    queryKey: ['lead-detalhe', clienteId, selectedConversa?.lead_id],
    queryFn: () => conversasApi.getLeadDetalhe(clienteId!, selectedConversa!.lead_id),
    enabled: !!clienteId && !!selectedConversa,
    staleTime: 30_000,
  })

  // Ref guarda o último urlLeadId que já foi "consumido" pelo efeito URL→state.
  // Sem isso, o efeito fica em ping-pong com o efeito state→URL: ao clicar em
  // outra conversa, o state muda antes da URL, o efeito URL→state vê
  // divergência e "puxa" o state de volta pro valor antigo da URL.
  const lastConsumedUrlLeadIdRef = useRef<string | null>(null)

  // URL → state: reage APENAS quando a URL muda por navegação externa
  // (reload, deep link, notificação). Quando o clique do usuário mexer no
  // state primeiro, o efeito state→URL atualiza o ref ANTES de escrever a
  // URL — assim este efeito não vê a mudança como "externa".
  useEffect(() => {
    if (!conversas) return
    // URL limpa: nada a fazer (não toca no state local).
    if (!urlLeadId) {
      lastConsumedUrlLeadIdRef.current = null
      return
    }
    // URL repetida (mesmo valor já consumido): ignora — evita loop.
    if (lastConsumedUrlLeadIdRef.current === urlLeadId) return

    lastConsumedUrlLeadIdRef.current = urlLeadId

    // Se a conversa atualmente selecionada já corresponde à URL, só limpa banner.
    if (selectedConversa?.lead_id === urlLeadId) {
      if (leadNotFound) setLeadNotFound(false)
      return
    }

    const found = conversas.find((c) => c.lead_id === urlLeadId)
    if (found) {
      setSelectedConversa(found)
      setLeadNotFound(false)
    } else {
      // Lead não está na página atual. Com paginação, isso é comum (pode estar
      // na página 30). Em vez de mostrar banner, busca direto pelo /leads/{id}
      // e cria um ConversaPreview mínimo pra poder abrir o chat. O banner só
      // aparece se a busca falhar de verdade (lead inativo/inexistente).
      conversasApi
        .getLeadDetalhe(clienteId!, urlLeadId)
        .then((det) => {
          setSelectedConversa({
            lead_id: det.id,
            whatsapp: det.whatsapp,
            nome: det.nome,
            temperatura: det.temperatura ?? null,
            score: det.score ?? null,
            foto_url: det.foto_url ?? null,
          })
          setLeadNotFound(false)
        })
        .catch(() => {
          setLeadNotFound(true)
        })
    }
    // selectedConversa/leadNotFound intencionalmente fora das deps — só
    // disparamos este efeito quando urlLeadId ou conversas mudam de verdade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlLeadId, conversas])

  // state → URL: quando o usuário clica numa conversa, reflete `?leadId=`
  // sem duplicar history. Atualiza o ref ANTES de escrever pra evitar que
  // o efeito URL→state interprete a mudança como externa.
  useEffect(() => {
    if (!selectedConversa) return
    const currentUrlLeadId = searchParams.get('leadId')
    if (currentUrlLeadId === selectedConversa.lead_id) return
    lastConsumedUrlLeadIdRef.current = selectedConversa.lead_id
    const next = new URLSearchParams(searchParams)
    next.set('leadId', selectedConversa.lead_id)
    setSearchParams(next, { replace: true })
    // searchParams intencionalmente fora das deps — ele muda de referência
    // a cada render do react-router e causaria re-execução sem fim. Lemos
    // via `searchParams.get('leadId')` quando precisa do valor atual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversa])

  // Ação do banner "Lead não está no período atual": zera filtros e período.
  const clearAllFilters = useCallback(() => {
    setDateRange(null)
    setFilters(EMPTY_FILTERS)
    setLeadNotFound(false)
  }, [])

  if (!selectedTenant) {
    return (
      <EmptyState
        variant="info"
        icon={MessageSquare}
        title="Selecione uma empresa"
        description="para visualizar as conversas"
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Título da página — ocultado em Modo Atendimento pra maximizar o chat. */}
      {!focusMode && (
        <div className="mb-4 flex-shrink-0 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Conversas</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {selectedTenant.nome} · Histórico de mensagens dos leads
            </p>
          </div>
          <SyncFotosButton
            tipo="leads"
            invalidateKeys={[['conversations'], ['kanban']]}
          />
        </div>
      )}

      <div
        className="flex-1 overflow-hidden rounded-xl flex"
        style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        {/* Contact list — escondida em Modo Atendimento pra dar espaço pro chat. */}
        <div
          className={`flex-shrink-0 overflow-y-auto border-r ${
            focusMode
              ? 'hidden'
              : selectedConversa
                ? 'hidden md:flex md:flex-col'
                : 'flex flex-col w-full'
          } md:w-72`}
          style={{ borderColor: 'var(--border)' }}
        >
          {/* List header */}
          <div
            className="px-4 py-3 border-b flex-shrink-0"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                {isLoading
                  ? 'Carregando...'
                  : `${conversasTotal} ${conversasTotal === 1 ? 'contato' : 'contatos'}`}
              </p>
              <div className="flex items-center gap-1.5">
                <DateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  compact
                  clearable
                  placeholder="Todo período"
                />
                <FilterPopoverButton
                  etapas={etapas}
                  numeros={numerosDoTenant}
                  filters={filters}
                  onChange={setFilters}
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
                >
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Banner: a URL trouxe um leadId que não existe na lista com os filtros/período atuais */}
          {leadNotFound && !isLoading && (
            <div
              className="flex items-start gap-2 px-3 py-2 flex-shrink-0"
              style={{
                background: 'rgba(234,179,8,0.08)',
                borderBottom: '1px solid rgba(234,179,8,0.25)',
              }}
            >
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" style={{ color: '#facc15' }} />
              <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                <span className="text-[11px]" style={{ color: 'var(--text-2)' }}>
                  Lead não está no período atual.
                </span>
                <button
                  onClick={clearAllFilters}
                  className="text-[11px] underline transition-colors"
                  style={{ color: '#fbbf24' }}
                >
                  Limpar filtros
                </button>
              </div>
              <button
                onClick={() => setLeadNotFound(false)}
                className="p-0.5 rounded transition-colors flex-shrink-0"
                style={{ color: 'var(--text-3)' }}
                aria-label="Fechar aviso"
              >
                <X size={10} />
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ background: 'var(--bg-elevated)' }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 rounded w-3/4" style={{ background: 'var(--bg-elevated)' }} />
                    <div className="h-2.5 rounded w-1/2" style={{ background: 'var(--bg-elevated)' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center flex-1 p-8">
              <div className="text-center">
                <MessageSquare size={32} className="text-red-800 mx-auto mb-2" />
                <p className="text-red-400 text-sm font-medium">Erro ao carregar conversas</p>
                <p className="text-gray-600 text-xs mt-1">Verifique sua conexão e tente novamente</p>
              </div>
            </div>
          ) : !conversas?.length ? (
            <div className="flex items-center justify-center flex-1 p-8">
              <EmptyState
                variant="empty"
                size="sm"
                icon={MessageSquare}
                title={debouncedSearch || activeFiltersCount > 0 ? 'Nenhum contato encontrado' : 'Nenhuma conversa ainda'}
                description={debouncedSearch || activeFiltersCount > 0 ? 'Ajuste os filtros ou a busca.' : undefined}
              />
            </div>
          ) : (
            // Virtualização — renderiza só os itens visíveis no DOM. Suporta
            // listas de milhares de leads sem travar. `endReached` dispara
            // fetchNextPage quando o usuário se aproxima do fim.
            <Virtuoso
              className="flex-1"
              data={conversas}
              endReached={loadMore}
              overscan={400}
              itemContent={(_index, c) => (
                <ConversaItem
                  conversa={c}
                  isSelected={selectedConversa?.lead_id === c.lead_id}
                  onClick={() => setSelectedConversa(c)}
                />
              )}
              components={{
                Footer: () => (
                  isFetchingNextPage ? (
                    <div className="flex items-center justify-center py-4 text-xs gap-2" style={{ color: 'var(--text-3)' }}>
                      <Loader2 size={12} className="animate-spin" />
                      Carregando mais...
                    </div>
                  ) : null
                ),
              }}
            />
          )}
        </div>

        {/* Chat area */}
        <div className={`flex-1 min-w-0 overflow-hidden ${selectedConversa ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`}>
          {selectedConversa ? (
            <ChatPanel
              clienteId={selectedTenant.id}
              conversa={selectedConversa}
              leadDetalhe={leadDetalhe}
              onBack={() => setSelectedConversa(null)}
              onInativar={() => setInativarTarget(selectedConversa)}
              insightsHidden={!insightsOpen}
              onShowInsights={() => setInsightsOpen(true)}
              focusMode={focusMode}
              onEnterFocusMode={() => setFocusMode(true)}
              onExitFocusMode={() => setFocusMode(false)}
            />
          ) : (
            <EmptyState
              variant="info"
              icon={MessageSquare}
              title="Selecione uma conversa"
              description="para ver o histórico de mensagens"
            />
          )}
        </div>

        {/* Insights panel — só com conversa selecionada e toggle ligado.
            Aberto por padrão; usuário pode ocultar com PanelRightClose; volta
            via botão PanelRightOpen no header do ChatPanel. Preferência salva
            em localStorage. */}
        {selectedConversa && insightsOpen && (
          <InsightsPanel
            lead={leadDetalhe}
            loading={loadingDetalhe}
            onClose={() => setInsightsOpen(false)}
          />
        )}
      </div>

      {/* Modal de confirmação de inativação */}
      <ConfirmModal
        open={!!inativarTarget}
        onClose={() => setInativarTarget(null)}
        onConfirm={() => { if (inativarTarget) inativarMutation.mutate(inativarTarget.lead_id) }}
        variant="danger"
        title="Inativar este lead?"
        description={
          <>
            <p className="mb-1 truncate" style={{ color: 'var(--text-3)' }}>
              {inativarTarget?.nome || inativarTarget?.whatsapp}
            </p>
            <p className="mt-3">
              Esse lead{' '}
              <span className="font-medium" style={{ color: 'var(--text-1)' }}>
                deixará de aparecer
              </span>{' '}
              em:
            </p>
          </>
        }
        bullets={[
          'Lista de conversas e histórico de mensagens',
          'Kanban e funil de vendas',
          'Dashboards, KPIs e relatórios',
        ]}
        confirmLabel="Sim, inativar"
        isLoading={inativarMutation.isPending}
      />
    </div>
  )
}
