import { useEffect, useRef, useState } from 'react'
import {
  Zap, Copy, MessagesSquare, History as HistoryIcon, Flame,
  ChevronRight, Check, AlertCircle, MoreHorizontal,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'

import type { FeedCard as IFeedCard, SnoozePreset } from '../../types'
import LeadAvatar from '../ui/LeadAvatar'
import OpenActions from '../ui/OpenActions'
import { Pill } from '../ds'
import type { Tone } from '../ds'
import {
  normalizeTemperatura,
  normalizeSentimento,
  semanticColors,
} from '../../lib/semanticColors'
import FeedComments from './FeedComments'
import FeedHistorico from './FeedHistorico'
import FeedCardModal from './FeedCardModal'
import SnoozeMenu from './SnoozeMenu'
import type { FeedDensity } from './FeedDensityToggle'

const TEMP_LABEL: Record<'quente' | 'morno' | 'frio', string> = {
  quente: 'Quente',
  morno:  'Morno',
  frio:   'Frio',
}

const SENT_SYMBOL: Record<'positivo' | 'neutro' | 'negativo', string> = {
  positivo: '↑',
  neutro:   '–',
  negativo: '↓',
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR })
  } catch {
    return ''
  }
}

interface Props {
  card: IFeedCard
  clienteId: string
  density: FeedDensity
  /** Quando true, aplica ring-pulse no card. */
  isHighlighted?: boolean
  /** Callbacks pras ações de saída — página gerencia mutation otimista. */
  onConcluir?: (leadId: string) => void
  onSnooze?: (leadId: string, preset: SnoozePreset) => void
  /** Quando true, anima o card pra fora antes da remoção. */
  isLeaving?: boolean
}

/**
 * Card de lead no feed.
 *
 * - density=1: layout vertical completo, expansões inline (histórico/comentários)
 * - density>=2: layout compacto, expansões abrem em modal — preserva grid
 *
 * Botão "Concluir" (verde) e "Soneca" (popover) sempre visíveis no rodapé.
 */
export default function FeedCardComp({
  card,
  clienteId,
  density,
  isHighlighted = false,
  onConcluir,
  onSnooze,
  isLeaving = false,
}: Props) {
  const isCompact = density >= 2
  const isVeryDense = density >= 4

  const [showHistorico, setShowHistorico] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const cardRef = useRef<HTMLDivElement | null>(null)

  // Ring-pulse temporário quando isHighlighted vira true
  useEffect(() => {
    if (!isHighlighted || !cardRef.current) return
    const el = cardRef.current
    el.classList.add('feed-card-pulse')
    const t = setTimeout(() => el.classList.remove('feed-card-pulse'), 3000)
    return () => clearTimeout(t)
  }, [isHighlighted])

  const tempKey = normalizeTemperatura(card.temperatura)
  const tempTone: Tone | null = tempKey ? `temperatura:${tempKey}` : null
  const tempLabel = tempKey ? TEMP_LABEL[tempKey] : null

  const sentKey = normalizeSentimento(card.ultima_analise?.sentimento)
  const sentInfo = sentKey
    ? {
        symbol: SENT_SYMBOL[sentKey],
        color:
          sentKey === 'positivo' ? semanticColors.variacao.up
          : sentKey === 'negativo' ? semanticColors.variacao.down
          : semanticColors.variacao.flat,
      }
    : null

  const nomeTrimmed = card.nome?.trim() || card.whatsapp

  function copyTel() {
    navigator.clipboard.writeText(card.whatsapp).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }


  // Em modo compacto, expandir histórico/comentários abre o modal
  function openExpandable() {
    if (isCompact) {
      setShowModal(true)
    } else {
      // Modo 1-col — toggle inline
      // Mantém comportamento por botão (cada um controla seu state)
    }
  }

  return (
    <>
      <div
        ref={cardRef}
        data-lead-id={card.id}
        className={clsx(
          'feed-card relative rounded-xl transition-all flex flex-col',
          'border',
          isLeaving && 'feed-card-leaving',
        )}
        style={{
          padding: isVeryDense ? 12 : 16,
          background: 'var(--bg-card)',
          borderColor: card.acao_requerida
            ? 'rgba(245,158,11,0.35)'
            : 'var(--border)',
          borderLeftWidth: card.acao_requerida ? 3 : 1,
          borderLeftColor: card.acao_requerida ? '#f59e0b' : 'var(--border)',
          height: isCompact ? '100%' : 'auto',
        }}
      >
        <style>{`
          @keyframes feed-pulse-ring {
            0%, 70% { border-color: var(--brand-500); }
            100% { border-color: var(--border); }
          }
          .feed-card-pulse { animation: feed-pulse-ring 1.2s ease-out 2; }

          @keyframes feed-card-leave {
            0%   { opacity: 1; transform: translateX(0) scale(1); max-height: 1000px; margin-bottom: 0.75rem; }
            60%  { opacity: 0; transform: translateX(40px) scale(0.96); }
            100% { opacity: 0; transform: translateX(40px) scale(0.96); max-height: 0; margin-bottom: 0; padding: 0; border-width: 0; }
          }
          .feed-card-leaving {
            animation: feed-card-leave 480ms ease forwards;
            pointer-events: none;
            overflow: hidden;
          }
        `}</style>

        {/* Header */}
        <div className="flex items-start gap-3" style={{ marginBottom: isVeryDense ? 6 : 8 }}>
          <LeadAvatar
            name={card.nome ?? undefined}
            fallback={card.whatsapp}
            temperatura={card.temperatura ?? undefined}
            fotoUrl={card.foto_url ?? undefined}
            size={isVeryDense ? 32 : isCompact ? 36 : 42}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p
                className="font-semibold truncate"
                style={{
                  color: 'var(--text-1)',
                  fontSize: isVeryDense ? 12 : 14,
                  maxWidth: '100%',
                }}
              >
                {nomeTrimmed}
              </p>
              {tempTone && tempLabel && (
                <Pill tone={tempTone} dot size="xs">
                  {tempLabel}
                </Pill>
              )}
              {sentInfo && (
                <span className="text-xs font-bold" style={{ color: sentInfo.color }}>
                  {sentInfo.symbol}
                </span>
              )}
              {card.score !== undefined && card.score !== null && (
                <Pill tone="neutral" variant="solid" size="xs" mono>
                  {card.score}
                </Pill>
              )}
              {card.acao_requerida && !isVeryDense && (
                <Pill tone="status:pending" variant="solid" size="xs" className="uppercase tracking-wide">
                  <Flame size={10} className="mr-0.5" />
                  Ação
                </Pill>
              )}
            </div>
            <div
              className="flex items-center gap-1.5 mt-0.5 text-xs truncate"
              style={{ color: 'var(--text-3)' }}
            >
              <span className="font-mono-data truncate">{card.whatsapp}</span>
              {!isVeryDense && card.etapa_funil && <span>· {card.etapa_funil}</span>}
              <span className="ml-auto whitespace-nowrap">{relativeTime(card.updated_at)}</span>
            </div>
          </div>
        </div>

        {/* Resumo (oculto em alta densidade — vai pro modal) */}
        {!isVeryDense && card.ultima_analise?.resumo_curto && (
          <p
            className="leading-relaxed mb-2"
            style={{
              color: 'var(--text-2)',
              fontSize: isCompact ? 12 : 14,
              display: '-webkit-box',
              WebkitLineClamp: isCompact ? 2 : 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {card.ultima_analise.resumo_curto}
          </p>
        )}

        {/* Próximo passo */}
        {card.ultima_analise?.proximo_passo && (
          <div
            className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg leading-relaxed mb-2"
            style={{
              background: 'rgba(11,150,146,0.06)',
              border: '1px solid rgba(11,150,146,0.2)',
              color: '#a5b4fc',
              fontSize: isVeryDense ? 11 : 12,
            }}
          >
            <Zap size={11} className="flex-shrink-0 mt-0.5" />
            <span
              style={{
                display: '-webkit-box',
                WebkitLineClamp: isVeryDense ? 2 : isCompact ? 3 : 5,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {card.ultima_analise.proximo_passo}
            </span>
          </div>
        )}

        {/* Empurra footer pro fundo no modo grid */}
        {isCompact && <div className="flex-1" />}

        {/* Ações */}
        <div
          className="flex items-center gap-1.5 flex-wrap pt-2"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          {/* Modo 1 col: histórico + comentários inline. Modo grid: tudo via modal. */}
          {!isCompact ? (
            <>
              <button
                onClick={() => setShowHistorico((v) => !v)}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
                style={{
                  background: showHistorico ? 'rgba(11,150,146,0.08)' : 'transparent',
                  color: showHistorico ? '#25c8bd' : 'var(--text-3)',
                  border: '1px solid var(--border-subtle)',
                }}
                title="Histórico de análises"
              >
                <HistoryIcon size={11} />
                Histórico
                <ChevronRight size={10} className={clsx('transition-transform', showHistorico && 'rotate-90')} />
              </button>
              <button
                onClick={() => setShowComments((v) => !v)}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
                style={{
                  background: showComments ? 'rgba(11,150,146,0.08)' : 'transparent',
                  color: showComments ? '#25c8bd' : 'var(--text-3)',
                  border: '1px solid var(--border-subtle)',
                }}
                title="Comentários internos"
              >
                <MessagesSquare size={11} />
                Comentários
                {card.comentarios_count > 0 && (
                  <span
                    className="ml-0.5 text-[10px] font-bold tabular-nums"
                    style={{ color: '#25c8bd' }}
                  >
                    {card.comentarios_count}
                  </span>
                )}
                <ChevronRight size={10} className={clsx('transition-transform', showComments && 'rotate-90')} />
              </button>
              <OpenActions leadId={card.id} showConversa showKanban />
              <button
                onClick={copyTel}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
                style={{
                  background: copied ? 'rgba(34,197,94,0.08)' : 'transparent',
                  color: copied ? '#22c55e' : 'var(--text-3)',
                  border: '1px solid var(--border-subtle)',
                }}
                title={copied ? 'Copiado!' : 'Copiar telefone'}
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </>
          ) : (
            <>
              {/* Modo grid: 1 botão "Detalhes" abre modal completo */}
              <button
                onClick={openExpandable}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
                style={{
                  background: 'transparent',
                  color: 'var(--text-3)',
                  border: '1px solid var(--border-subtle)',
                }}
                title="Ver detalhes (histórico + comentários)"
              >
                <MoreHorizontal size={11} />
                Detalhes
                {card.comentarios_count > 0 && (
                  <span
                    className="ml-0.5 text-[10px] font-bold tabular-nums"
                    style={{ color: '#25c8bd' }}
                  >
                    {card.comentarios_count}
                  </span>
                )}
              </button>
              {/* Em densidade média (2-3) ainda dá pra mostrar conversa rápida */}
              {!isVeryDense && (
                <OpenActions leadId={card.id} showConversa showKanban={false} />
              )}
              <button
                onClick={copyTel}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
                style={{
                  background: copied ? 'rgba(34,197,94,0.08)' : 'transparent',
                  color: copied ? '#22c55e' : 'var(--text-3)',
                  border: '1px solid var(--border-subtle)',
                }}
                title={copied ? 'Copiado!' : 'Copiar telefone'}
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
              </button>
            </>
          )}

          <div className="flex-1" />

          {/* Soneca */}
          {onSnooze && (
            <SnoozeMenu onSelect={(p) => onSnooze(card.id, p)} />
          )}

          {/* Concluir — verde, ação positiva */}
          {onConcluir && (
            <button
              onClick={() => onConcluir(card.id)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium transition-colors"
              style={{
                background: 'rgba(34,197,94,0.1)',
                color: '#22c55e',
                border: '1px solid rgba(34,197,94,0.35)',
              }}
              title="Marcar como concluído (some do feed)"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(34,197,94,0.18)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(34,197,94,0.1)'
              }}
            >
              <Check size={11} />
              Concluir
            </button>
          )}
        </div>

        {/* Expansões inline — só em densidade 1 */}
        {!isCompact && showHistorico && (
          <div className="mt-3" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
            <FeedHistorico clienteId={clienteId} leadId={card.id} />
          </div>
        )}
        {!isCompact && showComments && (
          <div className="mt-3" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
            <FeedComments clienteId={clienteId} leadId={card.id} />
          </div>
        )}

        {!card.ultima_analise && card.bloqueado && (
          <div className="text-xs flex items-center gap-1 mt-2" style={{ color: '#f87171' }}>
            <AlertCircle size={11} />
            Lead bloqueado, sem análise.
          </div>
        )}
      </div>

      {showModal && (
        <FeedCardModal card={card} clienteId={clienteId} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}
