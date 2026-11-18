import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { TemperaturaResult } from '../../../api/dashboard'
import { semanticColors } from '../../../lib/semanticColors'
import InfoTooltip from '../shared/InfoTooltip'

// ── TemperaturaDonutPanel — PieChart (proporção do total) ────────────────────
export default function TemperaturaBarPanel({ data, onSelect }: { data?: TemperaturaResult; onSelect?: (temperatura: string) => void }) {
  const total = data?.total ?? 0
  // Cores vêm de lib/semanticColors (única fonte de verdade pro projeto).
  const slices = [
    { label: 'Quentes',  value: data?.quente ?? 0,          color: semanticColors.temperatura.quente },
    { label: 'Mornos',   value: data?.morno ?? 0,           color: semanticColors.temperatura.morno },
    { label: 'Frios',    value: data?.frio ?? 0,            color: semanticColors.temperatura.frio },
    { label: 'Sem temp', value: data?.sem_temperatura ?? 0, color: '#6b7280' },
  ]
  const hasData = total > 0

  return (
    <div className="card-surface p-5 h-full flex flex-col">
      <div className="flex items-center gap-1.5 mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Temperatura dos Leads
        </p>
        <InfoTooltip text="Distribuição dos leads por temperatura de interesse, classificada pela IA. Quente = alta intenção de compra. Morno = interesse moderado. Frio = baixo engajamento. Sem temp = ainda não classificado." />
      </div>

      {!hasData ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-600 text-sm">Sem dados para o período</p>
        </div>
      ) : (
        <>
          {/* Donut + label central */}
          <div className="relative flex items-center justify-center" style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={72}
                  paddingAngle={2}
                  isAnimationActive
                  animationDuration={700}
                  onClick={(_, idx) => {
                    const slice = slices[idx]
                    if (!slice) return
                    const tempKey = slice.label.toLowerCase().startsWith('quente') ? 'quente'
                      : slice.label.toLowerCase().startsWith('morno') ? 'morno'
                      : slice.label.toLowerCase().startsWith('frio') ? 'frio'
                      : null
                    if (tempKey) onSelect?.(tempKey)
                  }}
                >
                  {slices.map(({ label, color }) => (
                    <Cell key={label} fill={color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => [
                    `${Number(value ?? 0).toLocaleString('pt-BR')} (${total > 0 ? Math.round((Number(value ?? 0) / total) * 100) : 0}%)`,
                    name,
                  ]}
                  contentStyle={{
                    background: 'var(--tooltip-bg)',
                    border: '1px solid var(--tooltip-border)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#f1f5f9',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Label central */}
            <div className="absolute flex flex-col items-center pointer-events-none">
              <p className="text-xl font-bold text-white leading-none">{total.toLocaleString('pt-BR')}</p>
              <p className="text-xs text-gray-500 mt-0.5">leads</p>
            </div>
          </div>

          {/* Legenda */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2">
            {slices.map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-xs text-gray-400 truncate">{label}</span>
                <span className="text-xs font-semibold ml-auto" style={{ color }}>
                  {total > 0 ? Math.round((value / total) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
