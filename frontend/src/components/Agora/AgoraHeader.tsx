import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Pill } from '../ds'

interface AgoraHeaderProps {
  totalGeral: number
  /** ms desde epoch — timestamp do último fetch bem-sucedido (React Query `dataUpdatedAt`). */
  updatedAt: number
  onRefresh: () => void
  isRefreshing?: boolean
}

/**
 * Header sticky da página /agora.
 * Título + subtítulo à esquerda, contador total + refresh + "atualizado há Xs" à direita.
 * Em mobile, empilha ações abaixo do título.
 */
export function AgoraHeader({
  totalGeral,
  updatedAt,
  onRefresh,
  isRefreshing = false,
}: AgoraHeaderProps) {
  // Re-renderiza o "atualizado há Xs" a cada 15s pra manter vivo sem buscar dado.
  const [, tick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 15_000)
    return () => window.clearInterval(id)
  }, [])

  const relative = updatedAt
    ? formatDistanceToNow(new Date(updatedAt), { addSuffix: true, locale: ptBR })
    : ''

  // O `<main>` do Layout tem `p-6` (padding 1.5rem = 26.25px com html font-size 17.5px).
  // Como `<main>` é o scroll container, o `sticky top-0` grudaria 1.5rem abaixo do
  // topo visual da viewport — deixando o padding-top do main exposto e os cards
  // passando por trás. Solução: usar `top: -1.5rem` (negativo do p-6 do main) e
  // `-mx-6 -mt-6` para vazar e cobrir exatamente a área do padding. O `pt-7` (1.75rem)
  // dá respiro visual ao H1 quando o header está grudado no topo.
  return (
    <div
      className="sticky top-[-1.5rem] z-10 -mx-6 -mt-6 px-6 pt-7 pb-4 mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"
      style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)' }}
    >
      {/* Esquerda: título + subtítulo */}
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold leading-tight" style={{ color: 'var(--text-1)' }}>
          Agora
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-3)' }}>
          O que precisa da sua atenção, em ordem de urgência
        </p>
      </div>

      {/* Direita: contador + refresh + timestamp */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Pill
          tone="neutral"
          variant="ghost"
          mono
          className="h-7 px-2.5"
          title={`${totalGeral} itens na fila`}
        >
          {totalGeral} {totalGeral === 1 ? 'item' : 'itens'}
        </Pill>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="refresh-btn relative w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-2)',
            cursor: isRefreshing ? 'wait' : 'pointer',
          }}
          title="Atualizar"
          aria-label="Atualizar fila"
        >
          <RefreshCw
            size={13}
            className={`transition-transform duration-300 ${isRefreshing ? 'animate-spin' : ''}`}
            style={{
              // hover rotate-180 via classe inline
            }}
          />
          <style>{`
            .refresh-btn:hover svg { transform: rotate(180deg); }
          `}</style>
        </button>

        {relative && (
          <span className="text-[11px] hidden sm:inline" style={{ color: 'var(--text-4)' }}>
            Atualizado {relative}
          </span>
        )}
      </div>
    </div>
  )
}
