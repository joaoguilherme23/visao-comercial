import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { MessageSquare, Users, BarChart2, Zap } from 'lucide-react'
import { useThemeStore } from '../../../store/themeStore'
import type { MensagensVolumeResult } from '../../../api/dashboard'
import InfoTooltip from '../shared/InfoTooltip'
import ChartTooltip from '../shared/ChartTooltip'

// ── MensagensVolumePanel (B3) ─────────────────────────────────────────────────
export default function MensagensVolumePanel({ data }: { data?: MensagensVolumeResult }) {
  const { theme } = useThemeStore()
  const chartGrid = theme === 'dark' ? '#1e2433' : '#e2e8f0'
  const chartTick = theme === 'dark' ? '#4a5568' : '#94a3b8'
  const legendColor = theme === 'dark' ? '#9ca3af' : '#64748b'
  const resumo = data?.resumo
  const serie = data?.serie ?? []

  const formatted = serie.map(d => ({
    ...d,
    dataFmt: format(new Date(d.data + 'T00:00:00'), 'dd/MM', { locale: ptBR }),
  }))

  const kpiCards = [
    {
      label: 'IA',
      value: resumo?.total_ia?.toLocaleString('pt-BR') ?? '—',
      icon: MessageSquare,
      color: '#0e7490',
    },
    {
      label: 'Lead',
      value: resumo?.total_lead?.toLocaleString('pt-BR') ?? '—',
      icon: Users,
      color: '#22c55e',
    },
    {
      label: 'Total',
      value: resumo?.total_geral?.toLocaleString('pt-BR') ?? '—',
      icon: BarChart2,
      color: '#3b82f6',
    },
    {
      label: 'Automação',
      value: resumo != null ? `${resumo.pct_automacao}%` : '—',
      icon: Zap,
      color: '#f97316',
    },
  ]

  return (
    <div className="card-surface p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <p className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Volume de Mensagens</p>
        <InfoTooltip text="Total de mensagens do mês atual. 'IA' = mensagens enviadas pelo agente virtual. 'Lead' = mensagens recebidas dos clientes. '% Automação' = proporção das mensagens enviadas pela IA." />
        {/* @note: pill decorativa azul (não semântica), não migrado pro DS */}
        <span
          className="ml-2 text-xs font-semibold rounded-full px-2 py-0.5"
          style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}
        >
          Mês Atual
        </span>
      </div>

      {/* 4 KPI summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {kpiCards.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-lg p-3 flex items-center gap-3"
            style={{ background: `${color}12`, border: `1px solid ${color}30` }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}22` }}
            >
              <Icon size={15} style={{ color }} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-lg font-bold" style={{ color }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* LineChart */}
      {formatted.length === 0 ? (
        <div className="flex items-center justify-center" style={{ height: 180 }}>
          <p className="text-gray-600 text-sm">Sem dados para o período</p>
        </div>
      ) : (
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value: string) => <span style={{ color: legendColor }}>{value}</span>}
              />
              <Line
                type="monotone"
                dataKey="ia"
                name="IA"
                stroke="#0e7490"
                strokeWidth={2}
                dot={{ r: 3, fill: '#0e7490', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive
                animationDuration={700}
              />
              <Line
                type="monotone"
                dataKey="lead"
                name="Lead"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive
                animationDuration={700}
              />
              <Line
                type="monotone"
                dataKey="total"
                name="Total"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive
                animationDuration={700}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
