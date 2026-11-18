import { useMemo } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import { useThemeStore } from '../../store/themeStore'
import type { LlmDailySeries } from '../../api/llmLogs'

/**
 * Gráfico temporal do consumo LLM:
 *  - Barras: tokens/dia (eixo Y esquerdo)
 *  - Linha: custo R$/dia (eixo Y direito)
 *
 * Tooltip mostra ambos juntos pra facilitar correlação.
 * Empty state quando não há série.
 */
export default function LlmDailyChart({ data }: { data: LlmDailySeries[] }) {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const gridColor = isDark ? '#1e2433' : '#e2e8f0'
  const tickColor = isDark ? '#64748b' : '#94a3b8'

  const formatted = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        dataFmt: (() => {
          try {
            return format(new Date(d.dia + 'T00:00:00'), 'dd/MM', { locale: ptBR })
          } catch {
            return d.dia
          }
        })(),
      })),
    [data],
  )

  if (formatted.length === 0) {
    return (
      <div
        className="rounded-2xl p-5 flex items-center justify-center"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          height: 200,
          color: 'var(--text-3)',
        }}
      >
        <p className="text-sm">Sem dados no período</p>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wider mb-4"
        style={{ color: 'var(--text-2)' }}
      >
        Consumo por dia
      </p>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={formatted} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="dataFmt"
              tick={{ fontSize: 10, fill: tickColor }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="tokens"
              orientation="left"
              tick={{ fontSize: 10, fill: tickColor }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatNumberShort(v)}
            />
            <YAxis
              yAxisId="cost"
              orientation="right"
              tick={{ fontSize: 10, fill: tickColor }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `R$${v.toFixed(2)}`}
            />
            <Tooltip
              cursor={{ fill: isDark ? 'rgba(11,150,146,0.08)' : 'rgba(11,150,146,0.05)' }}
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: 'var(--text-1)', fontWeight: 600 }}
              formatter={(value: unknown, name: unknown): [string, string] => {
                const n = typeof value === 'number' ? value : 0
                const lbl = typeof name === 'string' ? name : ''
                if (lbl === 'Tokens') return [n.toLocaleString('pt-BR'), lbl]
                if (lbl === 'Custo R$') return [`R$ ${n.toFixed(4)}`, lbl]
                return [String(n), lbl]
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
              iconType="circle"
              iconSize={8}
            />
            <Bar
              yAxisId="tokens"
              dataKey="total_tokens"
              name="Tokens"
              fill="var(--brand-500)"
              fillOpacity={0.6}
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
            />
            <Line
              yAxisId="cost"
              type="monotone"
              dataKey="cost_brl"
              name="Custo R$"
              stroke="#10E088"
              strokeWidth={2}
              dot={{ r: 3, fill: '#10E088', stroke: '#10E088' }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** "1.500" → "1,5K", "157.279" → "157K" */
function formatNumberShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}
