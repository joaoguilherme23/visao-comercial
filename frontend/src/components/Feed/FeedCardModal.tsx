import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import type { FeedCard as IFeedCard } from '../../types'
import LeadAvatar from '../ui/LeadAvatar'
import { Pill } from '../ds'
import type { Tone } from '../ds'
import {
  normalizeTemperatura,
  normalizeSentimento,
  semanticColors,
} from '../../lib/semanticColors'
import FeedComments from './FeedComments'
import FeedHistorico from './FeedHistorico'

interface Props {
  card: IFeedCard
  clienteId: string
  onClose: () => void
}

const TEMP_LABEL: Record<'quente' | 'morno' | 'frio', string> = {
  quente: 'Quente', morno: 'Morno', frio: 'Frio',
}
const SENT_SYMBOL: Record<'positivo' | 'neutro' | 'negativo', string> = {
  positivo: '↑', neutro: '–', negativo: '↓',
}

/**
 * Modal full do lead — abre em densidade ≥2 cols pra preservar o layout
 * do grid. Mostra histórico + comentários sem bagunçar a linha.
 */
export default function FeedCardModal({ card, clienteId, onClose }: Props) {
  // Esc fecha
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Trava o scroll do body
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[720px] max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start gap-3 p-5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <LeadAvatar
            name={card.nome ?? undefined}
            fallback={card.whatsapp}
            temperatura={card.temperatura ?? undefined}
            fotoUrl={card.foto_url ?? undefined}
            size={48}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base font-semibold" style={{ color: 'var(--text-1)' }}>
                {nomeTrimmed}
              </p>
              {tempTone && tempLabel && (
                <Pill tone={tempTone} dot size="xs">{tempLabel}</Pill>
              )}
              {sentInfo && (
                <span className="text-sm font-bold" style={{ color: sentInfo.color }}>
                  {sentInfo.symbol}
                </span>
              )}
              {card.score !== undefined && card.score !== null && (
                <Pill tone="neutral" variant="solid" size="xs" mono>{card.score}</Pill>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
              <span className="font-mono-data">{card.whatsapp}</span>
              {card.etapa_funil && <span>· {card.etapa_funil}</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-3)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Conteúdo (scrollável) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {card.ultima_analise?.resumo_curto && (
            <div>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
                Resumo
              </p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-1)' }}>
                {card.ultima_analise.resumo_curto}
              </p>
            </div>
          )}

          {card.ultima_analise?.proximo_passo && (
            <div>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
                Próximo passo
              </p>
              <div
                className="text-sm leading-relaxed px-3 py-2 rounded-lg"
                style={{
                  background: 'rgba(11,150,146,0.06)',
                  border: '1px solid rgba(11,150,146,0.2)',
                  color: '#a5b4fc',
                }}
              >
                {card.ultima_analise.proximo_passo}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>
              Histórico de análises
            </p>
            <FeedHistorico clienteId={clienteId} leadId={card.id} />
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>
              Comentários internos
            </p>
            <FeedComments clienteId={clienteId} leadId={card.id} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
