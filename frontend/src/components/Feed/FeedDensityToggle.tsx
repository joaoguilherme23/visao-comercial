import { LayoutList, Columns2, Columns3, Columns4, LayoutGrid } from 'lucide-react'
import clsx from 'clsx'

export type FeedDensity = 1 | 2 | 3 | 4 | 5

interface Props {
  value: FeedDensity
  onChange: (next: FeedDensity) => void
}

const OPTIONS: Array<{ value: FeedDensity; icon: React.ElementType; label: string }> = [
  { value: 1, icon: LayoutList,   label: '1 coluna' },
  { value: 2, icon: Columns2,     label: '2 colunas' },
  { value: 3, icon: Columns3,     label: '3 colunas' },
  { value: 4, icon: Columns4,     label: '4 colunas' },
  { value: 5, icon: LayoutGrid,   label: '5 colunas' },
]

/**
 * Seletor de densidade do grid do feed.
 *
 * O usuário escolhe quantas colunas quer — auto-detect inicial baseado em
 * `window.innerWidth` é responsabilidade da página. A escolha é persistida
 * em localStorage por sessão (chave `x9-feed-density`).
 */
export default function FeedDensityToggle({ value, onChange }: Props) {
  return (
    <div
      className="inline-flex items-center rounded-lg p-0.5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      role="radiogroup"
      aria-label="Densidade do feed"
    >
      {OPTIONS.map(({ value: v, icon: Icon, label }) => {
        const active = v === value
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            className={clsx('p-1.5 rounded-md transition-colors')}
            style={{
              background: active ? 'rgba(11,150,146,0.12)' : 'transparent',
              color: active ? '#a5b4fc' : 'var(--text-3)',
            }}
          >
            <Icon size={14} />
          </button>
        )
      })}
    </div>
  )
}

/** Detecta densidade ideal baseada na largura inicial. */
export function detectInitialDensity(): FeedDensity {
  if (typeof window === 'undefined') return 1
  const w = window.innerWidth
  if (w >= 3000) return 5
  if (w >= 2300) return 4
  if (w >= 1700) return 3
  if (w >= 1200) return 2
  return 1
}

/** Lê do localStorage com fallback pra detect automático. */
export function loadFeedDensity(): FeedDensity {
  try {
    const raw = localStorage.getItem('x9-feed-density')
    if (raw) {
      const n = parseInt(raw, 10)
      if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n as FeedDensity
    }
  } catch {
    // localStorage indisponível — segue pro detect
  }
  return detectInitialDensity()
}

export function saveFeedDensity(d: FeedDensity) {
  try {
    localStorage.setItem('x9-feed-density', String(d))
  } catch {
    // sem persistência se localStorage falhar
  }
}
