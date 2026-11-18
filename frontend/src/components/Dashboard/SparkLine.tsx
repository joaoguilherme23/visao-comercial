import { AreaChart, Area, ResponsiveContainer } from 'recharts'

interface SparkLineProps {
  /** Array de pontos. Cada ponto precisa ter o campo indicado em `dataKey`. */
  data: Record<string, unknown>[]
  /** Chave numérica no ponto — ex: 'novos_leads', 'valor'. */
  dataKey: string
  /** Cor do stroke + gradiente. Default: var(--color-pos). */
  color?: string
  /** Largura em px. Default: 100% do container. */
  width?: number | string
  /** Altura em px. Default: 28. */
  height?: number | string
  /** ID único pro gradient (obrigatório se houver múltiplas na mesma página). */
  gradId?: string
}

/**
 * Mini gráfico inline pra mostrar tendência num KPI. Propositalmente sem eixos,
 * tooltip ou dots — a ideia é dar uma "forma" à variação, não valores precisos
 * (quem quiser valor olha o número grande ao lado).
 */
export default function SparkLine({
  data,
  dataKey,
  color = 'var(--color-pos)',
  width = '100%',
  height = 28,
  gradId = 'sparkline-grad',
}: SparkLineProps) {
  if (!data || data.length < 2) return null
  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 1, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
