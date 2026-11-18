import { useState } from 'react'
import type { ObjecaoItem } from '../../../api/dashboard'
import ObjecoesWaterfall from '../ObjecoesWaterfall'
import InfoTooltip from '../shared/InfoTooltip'
import HBarRow from '../shared/HBarRow'

// ── ObjecoesPanel (B3) ────────────────────────────────────────────────────────
interface ObjecoesPanelProps {
  data?: ObjecaoItem[]
  somenteNaoConvertidos: boolean
  onToggle: (v: boolean) => void
  periodoLabel?: string
}

export default function ObjecoesPanel({ data, somenteNaoConvertidos, onToggle, periodoLabel }: ObjecoesPanelProps) {
  const items = data ?? []
  const maxPct = Math.max(...items.map(i => i.pct), 1)
  const totalLeads = items.reduce((acc, i) => acc + i.total, 0)
  // "barras" = horizontal compacto (padrão); "cascata" = waterfall acumulado.
  const [view, setView] = useState<'barras' | 'cascata'>('barras')

  return (
    <div className="card-surface p-5 h-full">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Principais Objeções</p>
          <InfoTooltip text="Motivos que mais impedem o fechamento, identificados automaticamente pela IA a partir das conversas. A visualização em cascata mostra impacto acumulado — útil pra priorizar quais objeções atacar primeiro." />
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle — Barras vs Cascata */}
          <div className="flex items-center rounded-md p-0.5" style={{ background: 'var(--bg-elevated)' }}>
            {(['barras', 'cascata'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className="text-[10px] px-2 py-0.5 rounded transition-colors font-medium"
                style={{
                  background: view === v ? 'var(--bg-surface)' : 'transparent',
                  color: view === v ? 'var(--text-1)' : 'var(--text-3)',
                }}
              >
                {v === 'barras' ? 'Barras' : 'Cascata'}
              </button>
            ))}
          </div>
          {/* Toggle só sem conversão */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs text-gray-500">Só sem conversão</span>
            <div
              className="relative w-8 h-4 rounded-full transition-colors duration-200"
              style={{ background: somenteNaoConvertidos ? '#06b6d4' : 'var(--border-muted)' }}
              onClick={() => onToggle(!somenteNaoConvertidos)}
            >
              <div
                className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200"
                style={{ transform: somenteNaoConvertidos ? 'translateX(18px)' : 'translateX(2px)' }}
              />
            </div>
          </label>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-6">Sem dados para o período</p>
      ) : view === 'cascata' ? (
        <ObjecoesWaterfall data={items} baseline={totalLeads} />
      ) : (
        <div className="space-y-3">
          {items.map(({ motivo, total, pct }, idx) => (
            <div
              key={motivo}
              className="animate-fade-in"
              style={{ animationDelay: `${idx * 60}ms`, animationFillMode: 'backwards' }}
            >
              <HBarRow
                label={motivo}
                total={total}
                pct={pct}
                color="#06b6d4"
                maxPct={maxPct}
                compact
                labelClassName="w-48 truncate"
              />
            </div>
          ))}
        </div>
      )}
      {periodoLabel && (
        <p className="text-xs text-gray-700 mt-3">
          {periodoLabel} · Base: {totalLeads.toLocaleString('pt-BR')} lead{totalLeads !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
