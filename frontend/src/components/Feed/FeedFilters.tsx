import { Search, Flame } from 'lucide-react'

export interface FeedFiltersState {
  search: string
  temperatura: string
  etapa: string
  soAcaoRequerida: boolean
}

interface Props {
  value: FeedFiltersState
  onChange: (next: FeedFiltersState) => void
  etapas?: string[]
  totalLabel?: string
}

export default function FeedFilters({ value, onChange, etapas, totalLabel }: Props) {
  function patch(p: Partial<FeedFiltersState>) {
    onChange({ ...value, ...p })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--text-3)' }}
        />
        <input
          type="text"
          placeholder="Buscar nome ou WhatsApp…"
          value={value.search}
          onChange={(e) => patch({ search: e.target.value })}
          className="w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-1)',
          }}
        />
      </div>

      <select
        value={value.temperatura}
        onChange={(e) => patch({ temperatura: e.target.value })}
        className="rounded-lg px-3 py-2 text-sm outline-none"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          color: 'var(--text-1)',
        }}
      >
        <option value="">Todas temperaturas</option>
        <option value="quente">Quente</option>
        <option value="morno">Morno</option>
        <option value="frio">Frio</option>
      </select>

      {etapas && etapas.length > 0 && (
        <select
          value={value.etapa}
          onChange={(e) => patch({ etapa: e.target.value })}
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-1)',
          }}
        >
          <option value="">Todas etapas</option>
          {etapas.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      )}

      <button
        onClick={() => patch({ soAcaoRequerida: !value.soAcaoRequerida })}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
        style={{
          background: value.soAcaoRequerida ? 'rgba(245,158,11,0.12)' : 'var(--bg-card)',
          border: `1px solid ${value.soAcaoRequerida ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
          color: value.soAcaoRequerida ? '#f59e0b' : 'var(--text-2)',
        }}
        title="Mostrar apenas leads com próximo passo (ação) definido"
      >
        <Flame size={13} />
        Só ação requerida
      </button>

      {totalLabel && (
        <span className="text-xs ml-auto" style={{ color: 'var(--text-3)' }}>
          {totalLabel}
        </span>
      )}
    </div>
  )
}
