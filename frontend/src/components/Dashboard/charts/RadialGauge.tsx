// ── RadialGauge — medidor radial pra KPIs em formato percent ─────────────────
// Extraido do DashboardPage.tsx mantendo o visual identico.
// Usa recharts (RadialBarChart + RadialBar + PolarAngleAxis) encapsulado.
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts'
import { useThemeStore } from '../../../store/themeStore'

interface RadialGaugeProps {
  /** Valor em percentual (0-100). Sera clamped. */
  value: number
  /** Cor do arco preenchido. */
  color: string
}

export default function RadialGauge({ value, color }: RadialGaugeProps) {
  const { theme } = useThemeStore()
  const trackColor = theme === 'dark' ? '#1f2937' : '#e2e8f0'
  const clamped = Math.min(Math.max(value, 0), 100)
  const data = [{ value: clamped }]

  return (
    <div style={{ width: 64, height: 64, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={22}
          outerRadius={30}
          startAngle={225}
          endAngle={-45}
          barSize={7}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          {/* Track */}
          <RadialBar
            dataKey="value"
            cornerRadius={4}
            fill={trackColor}
            background={{ fill: trackColor }}
            isAnimationActive={false}
          />
          {/* Filled arc */}
          <RadialBar
            dataKey="value"
            cornerRadius={4}
            fill={color}
            isAnimationActive
            animationDuration={700}
          />
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  )
}
