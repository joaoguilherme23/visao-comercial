import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line, CartesianGrid,
  AreaChart, Area,
  Treemap,
  FunnelChart, Funnel, LabelList,
} from 'recharts'
import type { AnaliseWidgetDataOut } from '../../api/dashboard'
import WidgetSkeleton from '../ui/skeletons/WidgetSkeleton'
import { brandColor } from '../../lib/brandColor'

interface Props {
  widget?: AnaliseWidgetDataOut | null
  isLoading?: boolean
  onItemClick?: (label: string) => void
}

const COLORS = [
  '#0b9692','#0e7490','#06b6d4','#10b981','#f59e0b',
  '#ef4444','#ec4899','#84cc16','#f97316','#14b8a6',
]

// ── Treemap custom cell — definido FORA do componente para não recriar em cada render
interface TreemapCellProps {
  x?: number; y?: number; width?: number; height?: number
  name?: string; value?: number; fill?: string; pct?: number; depth?: number
}
function TreemapCell({ x = 0, y = 0, width = 0, height = 0, name = '', fill = '#0b9692', pct, depth = 0 }: TreemapCellProps) {
  // depth=0 é o nó raiz virtual do Recharts — não renderizar
  if (depth === 0 || width < 30 || height < 20) return <g />
  const maxChars = Math.max(1, Math.floor(width / 7))
  const displayName = name.length > maxChars ? name.slice(0, maxChars) + '…' : name
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
      {height > 30 && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (pct !== undefined ? 8 : 0)}
          textAnchor="middle"
          fill="#fff"
          fontSize={Math.min(12, width / 6)}
          fontWeight={600}
        >
          {displayName}
        </text>
      )}
      {pct !== undefined && height > 40 && (
        <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={10}>
          {pct}%
        </text>
      )}
    </g>
  )
}

export default function WidgetRenderer({ widget, isLoading, onItemClick }: Props) {
  if (isLoading) {
    // Usa o tipo do widget (se conhecido) pra escolher skeleton com a silhueta
    // correta — fallback em 'bar' quando widget ainda não chegou do servidor.
    const tipoSkeleton = (widget?.tipo_grafico ?? 'bar') as
      | 'bar' | 'line' | 'area' | 'pie' | 'donut'
      | 'metric' | 'table' | 'funnel' | 'treemap'
    return <WidgetSkeleton tipo={tipoSkeleton} height={200} />
  }

  if (!widget || !widget.data || widget.data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-sm text-gray-500">Sem dados para o período</p>
      </div>
    )
  }

  const cor = brandColor(widget.cor)
  const { tipo_grafico, data } = widget
  const clickable = !!onItemClick

  // Normaliza dados para Recharts
  const chartData = data.map((d) => ({
    name: d.label,
    value: typeof d.value === 'number' ? d.value : parseFloat(String(d.value)) || 0,
    pct: d.pct,
  }))

  if (tipo_grafico === 'metric') {
    const val = data[0]?.value ?? '—'
    return (
      <div className="flex flex-col items-center justify-center h-40">
        <span className="text-4xl font-bold text-white">{val}</span>
        <span className="text-xs text-gray-500 mt-1">{data[0]?.label ?? ''}</span>
      </div>
    )
  }

  if (tipo_grafico === 'table') {
    return (
      <div className="space-y-2 py-2 max-h-52 overflow-y-auto pr-1">
        {data.map((item, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 rounded px-1 ${clickable ? 'cursor-pointer hover:bg-white/5' : ''}`}
            onClick={() => onItemClick?.(item.label)}
          >
            <span className="text-xs text-gray-400 w-4 text-right flex-shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between mb-0.5">
                <span className="text-xs text-gray-300 truncate">{item.label}</span>
                <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{item.value}</span>
              </div>
              {item.pct !== undefined && (
                <div className="h-1 rounded-full bg-gray-700">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${item.pct}%`, background: cor }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (tipo_grafico === 'pie' || tipo_grafico === 'donut') {
    const isDonut = tipo_grafico === 'donut'
    const total = chartData.reduce((s, d) => s + d.value, 0) || 1

    return (
      <div className="flex items-center gap-3 w-full">
        {/* Lista lateral esquerda */}
        <div className="flex-1 min-w-0 space-y-1 max-h-52 overflow-y-auto pr-1">
          {chartData.map((item, index) => {
            const pct = item.pct ?? Math.round(item.value / total * 1000) / 10
            const color = COLORS[index % COLORS.length]
            return (
              <div
                key={index}
                className={`flex items-center gap-2 group rounded px-1 ${clickable ? 'cursor-pointer hover:bg-white/5' : ''}`}
                onClick={() => onItemClick?.(item.name)}
              >
                <span className="flex-shrink-0 w-2 h-2 rounded-full" style={{ background: color }} />
                <span
                  className="flex-1 min-w-0 text-xs truncate"
                  style={{ color: '#9ca3af' }}
                  title={item.name}
                >
                  {item.name}
                </span>
                <span className="flex-shrink-0 text-xs font-semibold tabular-nums" style={{ color }}>
                  {pct}%
                </span>
              </div>
            )
          })}
        </div>

        {/* Gráfico à direita */}
        <div className="flex-shrink-0" style={{ width: 160, height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={75}
                innerRadius={isDonut ? 42 : 0}
                labelLine={false}
                label={false}
                style={{ cursor: clickable ? 'pointer' : 'default' }}
                onClick={(d) => d.name && onItemClick?.(d.name)}
              >
                {chartData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name, props) => {
                  const pct = props.payload?.pct
                  return [`${value ?? 0}${pct !== undefined ? ` (${pct}%)` : ''}`, name]
                }}
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
                itemStyle={{ color: '#e5e7eb' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  if (tipo_grafico === 'line') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} />
          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} width={32} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke={cor} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (tipo_grafico === 'area') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} />
          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} width={32} />
          <Tooltip />
          <Area type="monotone" dataKey="value" stroke={cor} fill={cor} fillOpacity={0.15} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (tipo_grafico === 'funnel') {
    const funnelData = chartData.map((d, i) => ({
      ...d,
      fill: COLORS[i % COLORS.length],
    }))

    return (
      <ResponsiveContainer width="100%" height={Math.max(180, funnelData.length * 36)}>
        <FunnelChart margin={{ top: 4, right: 80, bottom: 4, left: 80 }}>
          <Tooltip
            formatter={(value, name) => [value ?? 0, name]}
            contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
            itemStyle={{ color: '#e5e7eb' }}
          />
          <Funnel
            dataKey="value"
            data={funnelData}
            isAnimationActive
            style={{ cursor: clickable ? 'pointer' : 'default' }}
            onClick={(d: { name?: string }) => d.name && onItemClick?.(d.name)}
          >
            <LabelList
              position="right"
              fill="#9ca3af"
              fontSize={11}
              formatter={(value: unknown) => String(value ?? '')}
            />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    )
  }

  if (tipo_grafico === 'treemap') {
    const treemapData = chartData.map((d, i) => ({
      ...d,
      fill: COLORS[i % COLORS.length],
    }))

    return (
      <ResponsiveContainer width="100%" height={220}>
        <Treemap
          data={treemapData}
          dataKey="value"
          content={TreemapCell}
          style={{ cursor: clickable ? 'pointer' : 'default' }}
          onClick={(d: { name?: string }) => d.name && onItemClick?.(d.name)}
        >
          <Tooltip
            formatter={(value, name) => [value ?? 0, name]}
            contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
            itemStyle={{ color: '#e5e7eb' }}
          />
        </Treemap>
      </ResponsiveContainer>
    )
  }

  if (tipo_grafico === 'column') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 40, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={50}
          />
          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} width={32} />
          <Tooltip
            formatter={(value) => [value ?? 0, 'Total']}
            contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
            itemStyle={{ color: '#e5e7eb' }}
          />
          <Bar
            dataKey="value"
            fill={cor}
            radius={[3, 3, 0, 0]}
            maxBarSize={40}
            style={{ cursor: clickable ? 'pointer' : 'default' }}
            onClick={(d) => d.name && onItemClick?.(d.name)}
          />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // default: bar (horizontal)
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 80 }}>
        <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          width={76}
        />
        <Tooltip formatter={(value) => [value ?? 0, 'Total']} />
        <Bar
          dataKey="value"
          fill={cor}
          radius={[0, 3, 3, 0]}
          maxBarSize={20}
          style={{ cursor: clickable ? 'pointer' : 'default' }}
          onClick={(d) => d.name && onItemClick?.(d.name)}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
