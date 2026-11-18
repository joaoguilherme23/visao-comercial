import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { useThemeStore } from '../../../store/themeStore'
import type { EvolucaoAnualResult } from '../../../api/dashboard'
import InfoTooltip from '../shared/InfoTooltip'
import Skeleton from '../../ui/Skeleton'
import { brandColor } from '../../../lib/brandColor'

// ── EvolucaoAnualPanel (B4) ───────────────────────────────────────────────────
export default function EvolucaoAnualPanel({
  data,
  ano,
  onAnoChange,
  agruparPor,
  onAgruparPorChange,
  isLoading,
}: {
  data?: EvolucaoAnualResult
  ano: number
  onAnoChange: (ano: number) => void
  agruparPor: 'temperatura' | 'etapa'
  onAgruparPorChange: (v: 'temperatura' | 'etapa') => void
  isLoading: boolean
}) {
  const { theme } = useThemeStore()
  const chartGrid = theme === 'dark' ? '#1e2433' : '#e2e8f0'
  const chartTick = theme === 'dark' ? '#4a5568' : '#94a3b8'
  const currentYear = new Date().getFullYear()
  const anos = [currentYear - 2, currentYear - 1, currentYear]

  const serie = data?.serie ?? []
  const chaves = data?.chaves ?? []
  const cores = Object.fromEntries(Object.entries(data?.cores ?? {}).map(([key, color]) => [key, brandColor(color)]))

  // Aggregate weekly data → monthly (12 pontos por grupo — muito mais legível)
  const monthly = Object.values(
    serie.reduce<Record<number, Record<string, number | string>>>((acc, item) => {
      const key = item.mes_num as number
      if (!acc[key]) {
        acc[key] = { mes: item.mes, mes_num: key, ...Object.fromEntries(chaves.map(k => [k, 0])) }
      }
      chaves.forEach(k => {
        acc[key][k] = ((acc[key][k] as number) || 0) + ((item[k] as number) || 0)
      })
      return acc
    }, {})
  ).sort((a, b) => (a.mes_num as number) - (b.mes_num as number))

  const hasData = monthly.some(m => chaves.some(k => (m[k] as number) > 0))

  return (
    <div className="card-surface p-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Evolução Mensal (Ano)</p>
          <InfoTooltip text="Quantidade de leads por mês ao longo do ano selecionado. Agrupado por temperatura ou etapa do funil para identificar sazonalidades e tendências de volume." />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={ano}
            onChange={e => onAnoChange(Number(e.target.value))}
            className="rounded-lg px-2 py-1 text-xs font-medium outline-none cursor-pointer"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-1)' }}
          >
            {anos.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            value={agruparPor}
            onChange={e => onAgruparPorChange(e.target.value as 'temperatura' | 'etapa')}
            className="rounded-lg px-2 py-1 text-xs font-medium outline-none cursor-pointer"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-1)' }}
          >
            <option value="temperatura">Por Temperatura</option>
            <option value="etapa">Por Etapa do Funil</option>
          </select>
        </div>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="flex items-end gap-2" style={{ height: 240 }}>
          {[44, 62, 56, 78, 66, 84, 72, 58, 70, 86, 64, 78].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end gap-1">
              <Skeleton width="100%" height={`${h}%`} />
              <Skeleton width="100%" height={7} />
            </div>
          ))}
        </div>
      ) : !hasData ? (
        <div className="flex items-center justify-center" style={{ height: 240 }}>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>Sem dados para o ano selecionado</p>
        </div>
      ) : (
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                {chaves.map(chave => (
                  <linearGradient key={chave} id={`grad-${chave}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={cores[chave] ?? '#0b9692'} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={cores[chave] ?? '#0b9692'} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 10, fill: chartTick }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: chartTick }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--tooltip-bg)',
                  border: '1px solid var(--tooltip-border)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#f1f5f9',
                }}
                cursor={{ stroke: chartTick, strokeWidth: 1, strokeDasharray: '4 2' }}
              />
              <Legend
                verticalAlign="bottom"
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value: string) => <span style={{ color: chartTick }}>{value}</span>}
              />
              {chaves.map(chave => (
                <Area
                  key={chave}
                  type="monotone"
                  dataKey={chave}
                  name={chave}
                  stroke={cores[chave] ?? '#0b9692'}
                  strokeWidth={2}
                  fill={`url(#grad-${chave})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive
                  animationDuration={600}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
