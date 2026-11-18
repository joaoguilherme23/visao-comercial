import { useThemeStore } from '../../../store/themeStore'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import type { SentimentoHistoricoItem } from '../../../api/dashboard'
import InfoTooltip from '../shared/InfoTooltip'
import ChartTooltip from '../shared/ChartTooltip'

// ── SentimentoHistoricoPanel ──────────────────────────────────────────────────
// LineChart independente por categoria — sem stackId (sentimentos não são exclusivos)
export default function SentimentoHistoricoPanel({ data }: { data?: SentimentoHistoricoItem[] }) {
  const { theme } = useThemeStore()
  const chartGrid = theme === 'dark' ? '#1e2433' : '#e2e8f0'
  const chartTick = theme === 'dark' ? '#4a5568' : '#94a3b8'
  const legendColor = theme === 'dark' ? '#9ca3af' : '#64748b'
  const items = data ?? []

  const series = [
    { key: 'positivo', name: 'Positivo', color: '#22c55e' },
    { key: 'neutro',   name: 'Neutro',   color: '#94a3b8' },
    { key: 'negativo', name: 'Negativo', color: '#ef4444' },
    { key: 'misto',    name: 'Misto',    color: '#f97316' },
  ]

  return (
    <div className="card-surface p-5 h-full">
      <div className="flex items-center gap-1.5 mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Evolução do Sentimento</p>
        <InfoTooltip text="Tendência semanal do sentimento das conversas, classificado pela IA em Positivo, Neutro, Negativo e Misto. Reflete a percepção geral dos leads ao longo do tempo." />
      </div>
      {items.length === 0 ? (
        <div className="flex items-center justify-center" style={{ height: 200 }}>
          <p className="text-gray-600 text-sm">Sem dados para o período</p>
        </div>
      ) : (
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={items} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis
                dataKey="periodo"
                tick={{ fontSize: 10, fill: chartTick }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: chartTick }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value: string) => <span style={{ color: legendColor }}>{value}</span>}
              />
              {series.map(({ key, name, color }) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={name}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: color, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive
                  animationDuration={700}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
