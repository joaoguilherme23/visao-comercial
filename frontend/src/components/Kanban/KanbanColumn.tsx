import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { KanbanColumn as IKanbanColumn, KanbanCard as IKanbanCard } from '../../types'
import KanbanCard from './KanbanCard'
import clsx from 'clsx'

interface Props {
  column: IKanbanColumn
  onCardClick: (card: IKanbanCard) => void
  /** Quando true, cards mostram badge NEW se foram atualizados recentemente. */
  liveMode?: boolean
}

// Semantic hex colors for terminal stages; index-based palette for everything else
const SEMANTIC_HEX: Record<string, string> = {
  Fechado: '#16a34a',
  Perdido: '#dc2626',
}

const PALETTE_HEX = [
  '#4b5563', '#0284c7', '#2563eb', '#087f7c',
  '#0e7490', '#ca8a04', '#ea580c', '#0d9488',
  '#0891b2', '#087f7c', '#15948e', '#e11d48',
]

function getEtapaHex(etapa: string, index: number): string {
  return SEMANTIC_HEX[etapa] ?? PALETTE_HEX[index % PALETTE_HEX.length]
}

export default function KanbanColumn({ column, onCardClick, index = 0, liveMode = false }: Props & { index?: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.etapa })

  const color = getEtapaHex(column.etapa, index)

  return (
    <div
      className="flex flex-col w-72 min-w-72 rounded-xl border overflow-hidden transition-colors"
      style={{ background: 'var(--bg-surface)', borderColor: isOver ? color : 'var(--border)' }}
    >
      {/* Colored top bar */}
      <div className="h-1 w-full flex-shrink-0" style={{ background: color }} />

      {/* Column header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800/60">
        <span className="text-lg font-semibold text-white truncate flex-1">{column.etapa}</span>
        {/* Counter com cor dinâmica por etapa — fora do DS semantico
            (cor vem de getEtapaHex, não de tone). Mantem o estilo ad-hoc.
            Segue o mesmo formato visual do <Pill mono size="xs"> em soft. */}
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 font-mono-data"
          style={{
            background: `${color}20`,
            color: color,
            border: `1px solid ${color}40`,
          }}
        >
          {column.total}
        </span>
      </div>

      {/* Cards area */}
      <div
        ref={setNodeRef}
        className={clsx(
          'flex-1 p-2 space-y-2 min-h-48 overflow-y-auto transition-colors',
          isOver && 'bg-gray-800/20'
        )}
      >
        <SortableContext
          items={column.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onClick={() => onCardClick(card)}
              liveMode={liveMode}
            />
          ))}
        </SortableContext>

        {column.cards.length === 0 && (
          <div
            className="flex flex-col items-center justify-center gap-1.5 h-24 rounded-lg transition-colors"
            style={{ border: '1.5px dashed var(--border-muted)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            <p className="text-xs text-gray-600">Arraste aqui</p>
          </div>
        )}
      </div>
    </div>
  )
}
