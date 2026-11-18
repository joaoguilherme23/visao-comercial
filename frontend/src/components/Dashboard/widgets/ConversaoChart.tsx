import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, LabelList, Cell,
} from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { useThemeStore } from '../../../store/themeStore'
import type { KpiResult } from '../../../api/dashboard'
import { URGENCIA_COLORS, FUNNEL_ORDER, FUNNEL_COLORS } from '../constants'

// ── Conversão Chart — funil comparativo (atual vs anterior) ──────────────────
// ── Custom tooltip para o funil de conversão (co-localizado, não exportado) ─
const FunnelTooltip = ({ active, payload }: {
  active?: boolean
  payload?: Array<{ payload?: { nome: string; valor: number; anterior: number; variacao: number | null; color: string } }>
}) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  if (!d) return null
  return (
    <div style={{ background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: 8, padding: '10px 14px', minWidth: 160 }}>
      <p className="text-xs font-semibold mb-2" style={{ color: '#f1f5f9' }}>{d.nome}</p>
      <div className="flex items-center justify-between gap-6 mb-1">
        <span className="text-xs" style={{ color: '#94a3b8' }}>Atual</span>
        <span className="text-sm font-bold" style={{ color: d.color }}>{d.valor.toLocaleString('pt-BR')}%</span>
      </div>
      {d.anterior > 0 && (
        <div className="flex items-center justify-between gap-6 mb-1">
          <span className="text-xs" style={{ color: '#94a3b8' }}>Anterior</span>
          <span className="text-xs" style={{ color: '#cbd5e1' }}>{d.anterior.toLocaleString('pt-BR')}%</span>
        </div>
      )}
      {d.variacao != null && (
        <div className="flex items-center justify-between gap-6 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: '#94a3b8' }}>Variação</span>
          <span className={`text-xs font-semibold flex items-center gap-0.5 ${d.variacao >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {d.variacao >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {d.variacao >= 0 ? '+' : ''}{d.variacao.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  )
}

export default function ConversaoChart({ kpis, onDrill }: { kpis: KpiResult[]; onDrill?: (kpi: KpiResult) => void }) {
  const { theme } = useThemeStore()
  const labelColor = theme === 'dark' ? '#ffffff' : '#000000'
  const tickColor  = theme === 'dark' ? '#4a5568' : '#94a3b8'

  if (kpis.length === 0) return null

  const kpiMap       = Object.fromEntries(kpis.map(k => [k.slug, k]))
  const funnelKpis   = FUNNEL_ORDER.map(s => kpiMap[s]).filter(Boolean)
  const urgenciaKpis = ['pct_alta_urgencia', 'pct_media_urgencia', 'pct_baixa_urgencia']
                         .map(s => kpiMap[s]).filter(Boolean)
  const perdidos     = kpiMap['pct_leads_perdidos']

  // Monta dados para o BarChart — funil + perdidos como barra separada
  const barData = [
    ...funnelKpis.map((kpi, i) => ({
      nome: kpi.nome,
      valor: typeof kpi.valor === 'number' ? kpi.valor : 0,
      anterior: kpi.valor_anterior ?? 0,
      variacao: kpi.variacao_pct ?? null,
      color: FUNNEL_COLORS[i] ?? '#22c55e',
      isPerdidos: false,
    })),
    ...(perdidos ? [{
      nome: perdidos.nome,
      valor: typeof perdidos.valor === 'number' ? perdidos.valor : 0,
      anterior: perdidos.valor_anterior ?? 0,
      variacao: perdidos.variacao_pct ?? null,
      color: '#ef4444',
      isPerdidos: true,
    }] : []),
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

      {/* ── Funil principal ─────────────────────────────────────────── */}
      <div className="lg:col-span-2 card-surface rounded-xl p-5">
        <ResponsiveContainer width="100%" height={barData.length * 46 + 24}>
          <BarChart
            data={barData}
            layout="vertical"
            barCategoryGap="22%"
            margin={{ top: 4, right: 52, left: 0, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fill: tickColor, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="nome"
              width={148}
              tick={{ fill: tickColor, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<FunnelTooltip />} cursor={{ fill: 'var(--bg-elevated)', opacity: 0.4 }} />
            <Bar dataKey="valor" radius={[0, 4, 4, 0]} maxBarSize={30}>
              {barData.map((entry, i) => (
                <Cell key={i} fill={entry.color} fillOpacity={entry.isPerdidos ? 0.85 : 1} />
              ))}
              <LabelList
                dataKey="valor"
                position="right"
                content={({ x, y, width, height, value }) => (
                  <text
                    x={(x as number) + (width as number) + 7}
                    y={(y as number) + (height as number) / 2}
                    dominantBaseline="middle"
                    fill={labelColor}
                    fontSize={12}
                    fontWeight={700}
                  >
                    {value}%
                  </text>
                )}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Urgência ────────────────────────────────────────────────── */}
      {urgenciaKpis.length > 0 && (
        <div className="card-surface rounded-xl p-5 flex flex-col gap-4">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Urgência dos Leads
          </p>

          {/* Barra empilhada proporcional */}
          <div className="flex h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
            {urgenciaKpis.map(kpi => {
              const v = typeof kpi.valor === 'number' ? kpi.valor : 0
              return (
                <div
                  key={kpi.slug}
                  className="transition-all duration-700"
                  style={{ width: `${v}%`, background: URGENCIA_COLORS[kpi.slug] }}
                />
              )
            })}
          </div>

          {/* Linhas de detalhe */}
          <div className="space-y-3">
            {urgenciaKpis.map(kpi => {
              const v       = typeof kpi.valor === 'number' ? kpi.valor : 0
              const variacao = kpi.variacao_pct
              const color   = URGENCIA_COLORS[kpi.slug] ?? '#22c55e'
              return (
                <button
                  key={kpi.slug}
                  className="w-full flex items-center gap-2 rounded-lg px-2 py-1 -mx-2 transition-colors hover:bg-white/5"
                  style={{ cursor: onDrill ? 'pointer' : 'default' }}
                  onClick={() => onDrill?.(kpi)}
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-xs flex-1 truncate text-left" style={{ color: 'var(--text-muted)' }}>
                    {kpi.nome}
                  </span>
                  <span className="text-xs font-bold text-white">{v.toLocaleString('pt-BR')}%</span>
                  {variacao != null && variacao > 0 && (
                    <span className="text-xs text-green-400 flex items-center gap-0.5">
                      <TrendingUp size={9} />+{variacao.toFixed(0)}%
                    </span>
                  )}
                  {variacao != null && variacao < 0 && (
                    <span className="text-xs text-red-400 flex items-center gap-0.5">
                      <TrendingDown size={9} />{variacao.toFixed(0)}%
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
