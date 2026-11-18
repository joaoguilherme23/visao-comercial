import { useThemeStore } from '../../../store/themeStore'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import type { HorarioRespostaItem } from '../../../api/dashboard'
import { HORA_COLOR } from '../utils'
import InfoTooltip from '../shared/InfoTooltip'

// ── HorarioRespostasPanel — 24 barras por hora do dia ────────────────────────
export default function HorarioRespostasPanel({ data, title = 'Horário de Respostas', tooltip }: { data?: HorarioRespostaItem[]; title?: string; tooltip?: string }) {
  const { theme } = useThemeStore()
  const chartGrid = theme === 'dark' ? '#1e2433' : '#e2e8f0'
  const chartTick = theme === 'dark' ? '#4a5568' : '#94a3b8'

  const items: HorarioRespostaItem[] = data && data.length > 0
    ? data
    : Array.from({ length: 24 }, (_, h) => ({ hora: h, label: `${String(h).padStart(2, '0')}h`, total: 0, pct: 0 }))

  const pico = items.reduce((max, i) => (i.total > max.total ? i : max), items[0])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTick = ({ x, y, payload }: any) => {
    const h = Number(payload?.value ?? 0)
    if (h % 3 !== 0) return null
    return (
      <text x={x} y={y + 10} textAnchor="middle" fontSize={9} fill={chartTick}>
        {`${String(h).padStart(2, '0')}h`}
      </text>
    )
  }

  return (
    <div className="card-surface p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
          <InfoTooltip text={tooltip} />
        </div>
        {pico.total > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${HORA_COLOR(pico.hora)}20`, color: HORA_COLOR(pico.hora) }}>
            Pico: {pico.label}
          </span>
        )}
      </div>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={items} margin={{ top: 4, right: 4, left: -28, bottom: 16 }} barCategoryGap="10%">
            <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
            <XAxis
              dataKey="hora"
              tick={<CustomTick />}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 10, fill: chartTick }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, _: any, entry: any) => [
                `${Number(value ?? 0).toLocaleString('pt-BR')} msgs (${entry.payload?.pct ?? 0}%)`,
                entry.payload?.label ?? '',
              ]}
              contentStyle={{
                background: 'var(--tooltip-bg)',
                border: '1px solid var(--tooltip-border)',
                borderRadius: 8,
                fontSize: 12,
                color: '#f1f5f9',
              }}
            />
            <Bar dataKey="total" radius={[3, 3, 0, 0]} isAnimationActive animationDuration={600}>
              {items.map(({ hora }) => (
                <Cell
                  key={hora}
                  fill={HORA_COLOR(hora)}
                  opacity={hora === pico.hora ? 1 : 0.55}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Legenda faixas */}
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {[
          { label: 'Madrugada', color: '#0b9692' },
          { label: 'Manhã',     color: '#f59e0b' },
          { label: 'Tarde',     color: '#f97316' },
          { label: 'Noite',     color: '#3b82f6' },
        ].map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
