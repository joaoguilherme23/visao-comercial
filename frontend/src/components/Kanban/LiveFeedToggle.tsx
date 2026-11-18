import { Zap } from 'lucide-react'
import clsx from 'clsx'

/**
 * Modos de Live Feed do Kanban.
 *  - `off`  : usa o DateRangePicker normalmente
 *  - `2h`   : janela últimas 2h + refetch agressivo (15s)
 *  - `6h`   : janela últimas 6h + refetch agressivo (15s)
 *  - `24h`  : janela últimas 24h + refetch agressivo (15s)
 *
 * Quando ativo, o board sobrepõe o date range e passa `isLive` pros cards,
 * que ganham o badge "NEW" pulsante em leads atualizados há <5min.
 */
export type LiveFeedMode = 'off' | '2h' | '6h' | '24h'

interface Props {
  value: LiveFeedMode
  onChange: (mode: LiveFeedMode) => void
}

const OPTIONS: { key: LiveFeedMode; label: string }[] = [
  { key: '2h',  label: '2h' },
  { key: '6h',  label: '6h' },
  { key: '24h', label: '24h' },
]

export default function LiveFeedToggle({ value, onChange }: Props) {
  const isLive = value !== 'off'

  return (
    <div
      className="flex items-center gap-1 rounded-lg p-0.5"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Botão LIVE (on/off) ——— pulsa quando ativo */}
      <button
        type="button"
        onClick={() => onChange(isLive ? 'off' : '2h')}
        className={clsx(
          'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-colors',
          isLive ? 'text-white' : 'text-gray-400 hover:text-gray-200'
        )}
        style={{
          background: isLive ? '#ef4444' : 'transparent',
        }}
        title={isLive ? 'Live Feed ativo — clique pra desligar' : 'Ativar Live Feed'}
      >
        <Zap size={11} className={isLive ? 'animate-pulse-soft' : ''} />
        LIVE
      </button>

      {/* Seletor de janela — só aparece quando live está ativo */}
      {isLive && (
        <div className="flex items-center gap-0.5">
          {OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              className={clsx(
                'px-2 py-1 rounded-md text-xs font-medium transition-colors font-mono-data',
                value === opt.key
                  ? 'text-white'
                  : 'text-gray-400 hover:text-gray-200'
              )}
              style={{
                background: value === opt.key ? 'var(--bg-card)' : 'transparent',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
