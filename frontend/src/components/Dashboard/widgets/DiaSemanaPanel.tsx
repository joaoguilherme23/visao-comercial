import type { DiaSemanaItem } from '../../../api/dashboard'
import { DIA_SEMANA_ABBR } from '../constants'
import InfoTooltip from '../shared/InfoTooltip'

// ── DiaSemanaPanel — Barras horizontais por dia da semana ────────────────────
export default function DiaSemanaPanel({ data }: { data?: DiaSemanaItem[] }) {
  const items = data ?? []
  const maxTotal = Math.max(...items.map(i => i.total), 1)
  const peakItem = items.find(i => i.total === maxTotal)

  return (
    <div className="card-surface p-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Distribuição por Dia da Semana
          </p>
          <InfoTooltip text="Número de leads que iniciaram contato em cada dia da semana, no período selecionado. O dia com maior volume é destacado em azul." />
        </div>
        {peakItem && peakItem.total > 0 && (
          // @note: pill decorativa indigo (não semântica), não migrado pro DS
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(59,91,219,0.15)', color: '#3b5bdb' }}
          >
            Pico: {DIA_SEMANA_ABBR[peakItem.nome] ?? peakItem.label}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center justify-center" style={{ height: 200 }}>
          <p className="text-gray-600 text-sm">Sem dados para o período</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const isPeak = item.total === maxTotal
            const barPct = maxTotal > 0 ? (item.total / maxTotal) * 100 : 0
            return (
              <div key={item.label} className="flex items-center gap-3">
                {/* Dia abreviado */}
                <span
                  className="text-xs font-semibold w-7 flex-shrink-0 text-right"
                  style={{ color: isPeak ? 'var(--brand-600)' : 'var(--text-3)' }}
                >
                  {DIA_SEMANA_ABBR[item.nome] ?? item.label}
                </span>

                {/* Barra */}
                <div className="flex-1 rounded-full overflow-hidden" style={{ height: 8, background: 'var(--bg-elevated)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${barPct}%`,
                      background: isPeak
                        ? 'linear-gradient(90deg, var(--brand-600), var(--brand-500))'
                        : 'linear-gradient(90deg, var(--brand-400), var(--brand-200))',
                      opacity: isPeak ? 1 : 0.6,
                    }}
                  />
                </div>

                {/* Total + % */}
                <div className="flex items-center gap-1.5 flex-shrink-0 w-20 justify-end">
                  <span
                    className="text-xs font-semibold tabular-nums"
                    style={{ color: isPeak ? '#3b5bdb' : 'var(--text-2)' }}
                  >
                    {item.total.toLocaleString('pt-BR')}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-4)' }}>
                    ({item.pct}%)
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
