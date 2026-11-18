// ── HistoricoChart (área chart) ──────────────────────────────────────────────
// Extraido do DashboardPage.tsx mantendo o visual identico.
// Usa recharts (AreaChart + Area + eixos + tooltip) encapsulado.
import { useMemo } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, LabelList,
} from 'recharts'
import { useThemeStore } from '../../../store/themeStore'
import type { HistoricoPoint } from '../../../api/dashboard'
import ChartTooltip from '../shared/ChartTooltip'

export default function HistoricoChart({ data, label }: { data: HistoricoPoint[]; label: string }) {
  const { theme } = useThemeStore()
  const chartGrid = theme === 'dark' ? '#1e2433' : '#e2e8f0'
  const chartTick = theme === 'dark' ? '#4a5568' : '#94a3b8'
  const formatted = useMemo(
    () => data.map(d => ({
      ...d,
      dataFmt: format(new Date(d.data + 'T00:00:00'), 'dd/MM', { locale: ptBR }),
    })),
    [data],
  )

  return (
    <div className="card-surface p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{label}</p>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b5bdb" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#3b5bdb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
            <XAxis
              dataKey="dataFmt"
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
            <Area
              type="monotone"
              dataKey="novos_leads"
              name="Novos leads"
              stroke="#3b5bdb"
              strokeWidth={2}
              fill="url(#leadsGradient)"
              dot={{ r: 5, fill: '#3b82f6', strokeWidth: 0 }}
              activeDot={{ r: 4, fill: '#3b5bdb', stroke: '#0f1117', strokeWidth: 2 }}
              isAnimationActive={false}
            >
              <LabelList dataKey="novos_leads" position="top" fontSize={11} fill={chartTick} />
            </Area>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
