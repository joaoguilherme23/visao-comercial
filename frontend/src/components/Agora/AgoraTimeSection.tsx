import type { AgoraItem } from '../../api/agora'
import type { TimeBucket } from '../../lib/agoraGrouping'
import { AgoraCard } from './AgoraCard'
import { Pill } from '../ds'

interface AgoraTimeSectionProps {
  sectionKey: TimeBucket
  label: string
  items: AgoraItem[]
  /** Quando `true` e `sectionKey === 'today'`, renderiza a mensagem "Nada novo hoje...". */
  isEmpty?: boolean
}

/**
 * Uma secao de faixa temporal (Hoje / Ontem / Essa semana / Esse mes / Anteriores).
 * Header fino com linha divisoria, label em caps e contador.
 * O bucket "today" ganha destaque: label em text-1, bolinha indigo, letter-spacing maior.
 * E a unica secao que renderiza mensagem de estado vazio quando pedido pelo pai.
 */
export function AgoraTimeSection({
  sectionKey,
  label,
  items,
  isEmpty,
}: AgoraTimeSectionProps) {
  const isToday = sectionKey === 'today'

  return (
    <section aria-labelledby={`agora-section-${sectionKey}`} className="mb-6">
      {/* Header */}
      <div
        className="flex items-center justify-between pb-2 mb-3"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <h2
          id={`agora-section-${sectionKey}`}
          className="text-[11px] font-semibold uppercase flex items-center gap-2"
          style={{
            letterSpacing: isToday ? '0.12em' : '0.08em',
            color: isToday ? 'var(--text-1)' : 'var(--text-3)',
          }}
        >
          {isToday && (
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#25c8bd' }}
              aria-hidden
            />
          )}
          {label}
        </h2>
        <Pill
          tone="neutral"
          variant="ghost"
          size="xs"
          mono
          aria-label={`${items.length} ${items.length === 1 ? 'item' : 'itens'}`}
        >
          {items.length}
        </Pill>
      </div>

      {/* Estado vazio especifico de "Hoje" — so quando o pai pediu. */}
      {isEmpty && isToday && (
        <div
          className="text-[13px] italic py-4 px-4 rounded-lg"
          style={{
            color: 'var(--text-4)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          Nada novo hoje. Confira os itens de ontem abaixo.
        </div>
      )}

      {/* Lista de cards */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <AgoraCard key={item.lead_id} item={item} />
          ))}
        </div>
      )}
    </section>
  )
}
