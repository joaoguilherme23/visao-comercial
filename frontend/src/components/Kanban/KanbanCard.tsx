import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { KanbanCard as IKanbanCard } from '../../types'
import { AlertCircle, GripVertical, Zap } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'
import {
  semanticColors,
  normalizeTemperatura,
  normalizeSentimento,
} from '../../lib/semanticColors'
import LeadAvatar from '../ui/LeadAvatar'
import ChannelIcon from '../ui/ChannelIcon'
import OpenConversaIconButton from '../ui/OpenConversaIconButton'
import { Pill } from '../ds'
import type { Tone } from '../ds'

interface Props {
  card: IKanbanCard
  isDragging?: boolean
  onClick?: () => void
  /** Quando true, mostra badge "NEW" pulsante em cards recentes (<5min). */
  liveMode?: boolean
}

// Limite em minutos pra considerar um card "NEW" no Live Feed.
const NEW_WINDOW_MINUTES = 5

// Labels PT-BR pra exibição — cores vêm de lib/semanticColors.
const TEMP_LABEL: Record<'quente' | 'morno' | 'frio', string> = {
  quente: 'Quente',
  morno:  'Morno',
  frio:   'Frio',
}

// Símbolo visual do sentimento — cor vem de semanticColors.variacao (up/flat/down).
const SENT_SYMBOL: Record<'positivo' | 'neutro' | 'negativo', string> = {
  positivo: '↑',
  neutro:   '–',
  negativo: '↓',
}

export default function KanbanCard({ card, isDragging, onClick, liveMode = false }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isSortDragging,
  } = useSortable({ id: card.id, data: { card } })

  // isDragging = card renderizado dentro do DragOverlay (fantasma que segue o mouse)
  // isSortDragging = placeholder que fica na coluna de origem enquanto arrasta
  const isPlaceholder = !isDragging && isSortDragging

  const dndStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: 'none',
    background: 'var(--bg-card)',
  }

  const tempKey = normalizeTemperatura(card.temperatura)
  const tempTone: Tone | null = tempKey ? `temperatura:${tempKey}` : null
  const tempLabel = tempKey ? TEMP_LABEL[tempKey] : null

  const sentKey = normalizeSentimento(card.ultima_analise?.sentimento)
  const sentInfo = sentKey
    ? {
        symbol: SENT_SYMBOL[sentKey],
        // Reutiliza a paleta de variação (up/flat/down) — mesma polaridade.
        color:
          sentKey === 'positivo' ? semanticColors.variacao.up
          : sentKey === 'negativo' ? semanticColors.variacao.down
          : semanticColors.variacao.flat,
      }
    : null
  const nomeTrimmed = card.nome?.trim()

  const relativeTime = (() => {
    try {
      return formatDistanceToNow(new Date(card.updated_at), { addSuffix: true, locale: ptBR })
    } catch {
      return null
    }
  })()

  // Badge "NEW" — cards atualizados nos últimos NEW_WINDOW_MINUTES. Só aparece
  // com Live Feed ativo pra não poluir o fluxo normal.
  const isNew = (() => {
    if (!liveMode) return false
    try {
      const diffMs = Date.now() - new Date(card.updated_at).getTime()
      return diffMs >= 0 && diffMs <= NEW_WINDOW_MINUTES * 60_000
    } catch {
      return false
    }
  })()

  return (
    <div
      ref={setNodeRef}
      style={dndStyle}
      {...attributes}
      {...listeners}
      onClick={onClick}
      data-lead-id={card.id}
      className={clsx(
        'group relative rounded-xl p-3 select-none border transition-all duration-150',
        isDragging
          ? 'cursor-grabbing border-brand-500/80'          // fantasma: destaque
          : isPlaceholder
          ? 'opacity-25 border-dashed border-gray-600 cursor-grab'    // placeholder: vazado
          : 'cursor-grab border-gray-700/60 hover:border-brand-500/50 hover:-translate-y-0.5' // normal
      )}
    >
      {/* Botão flutuante "Abrir conversa" — hover-only em desktop, sempre
          visível em touch. Posicionado à esquerda do GripVertical. */}
      {!isDragging && !isPlaceholder && (
        <OpenConversaIconButton
          leadId={card.id}
          nome={card.nome}
          className="absolute top-2 right-8 z-10"
        />
      )}
      {/* ── Avatar + TÍTULO + grip ───────────────────── */}
      <div className="flex items-start gap-2 mb-1.5">
        <LeadAvatar
          name={nomeTrimmed}
          fallback={card.whatsapp}
          temperatura={card.temperatura}
          fotoUrl={card.foto_url}
          size={28}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-snug truncate">
            {nomeTrimmed || card.whatsapp}
          </p>
          {/* Canal + número — ícone oficial WhatsApp vindo de ChannelIcon */}
          <p className="text-[11px] text-gray-500 truncate flex items-center gap-1 mt-0.5 font-mono-data">
            <ChannelIcon channel="whatsapp" size={10} />
            {card.whatsapp}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
          {isNew && (
            <Pill
              tone="status:danger"
              variant="solid"
              size="xs"
              className="animate-pulse-soft tracking-wide"
              title={`Atualizado há menos de ${NEW_WINDOW_MINUTES}min`}
            >
              NEW
            </Pill>
          )}
          {card.bloqueado && <AlertCircle size={12} className="text-red-400" />}
          <GripVertical size={12} className="text-gray-700" />
        </div>
      </div>

      {/* ── Resumo da análise ──────────────────────── */}
      {card.ultima_analise?.resumo_curto && (
        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-2">
          {card.ultima_analise.resumo_curto}
        </p>
      )}

      {/* ── KPI preview ───────────────────────────── */}
      {(() => {
        const kpiPreview = card.kpi_generico
          ? Object.values(card.kpi_generico).find((v) => v && typeof v === 'string')
          : card.kpi?.veiculo_interesse
        const urgencia = card.kpi_generico?.urgencia ?? card.kpi?.urgencia
        if (!kpiPreview) return null
        return (
          <div className="text-xs text-gray-500 mb-2 flex items-center gap-1 truncate">
            <span className="text-gray-600 flex-shrink-0">📋</span>
            <span className="truncate">{String(kpiPreview)}</span>
            {urgencia && <span className="text-yellow-500 flex-shrink-0">{String(urgencia)}</span>}
          </div>
        )
      })()}


      {/* ── Footer: temp • sentimento • score • tempo ─ */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {tempTone && tempLabel && (
          <Pill tone={tempTone} dot className="flex-shrink-0">
            {tempLabel}
          </Pill>
        )}
        {sentInfo && (
          <span className="text-xs font-bold flex-shrink-0" style={{ color: sentInfo.color }}>
            {sentInfo.symbol}
          </span>
        )}
        {card.score !== undefined && card.score !== null && (
          <Pill tone="neutral" variant="solid" size="xs" mono className="flex-shrink-0">
            {card.score}
          </Pill>
        )}
        {relativeTime && (
          <span className="text-xs text-gray-600 ml-auto flex-shrink-0">{relativeTime}</span>
        )}
      </div>

      {/* ── Próximo passo ─────────────────────────── */}
      {card.ultima_analise?.proximo_passo && (
        <div className="mt-2 pt-2 border-t border-gray-700/50 flex items-start gap-1">
          <Zap size={10} className="text-brand-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-brand-400 line-clamp-1">
            {card.ultima_analise.proximo_passo}
          </p>
        </div>
      )}
    </div>
  )
}
