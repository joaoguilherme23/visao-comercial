// ── KpiCard — smart dispatcher por formato ───────────────────────────────────
// Escolhe o card apropriado (percent/text/count) de acordo com kpi.formato.
// Extraido do DashboardPage.tsx sem alterar o comportamento.
import type { HistoricoPoint, KpiResult } from '../../../api/dashboard'
import KpiCardCount from './KpiCardCount'
import KpiCardPercent from './KpiCardPercent'
import KpiCardText from './KpiCardText'

interface KpiCardProps {
  kpi: KpiResult
  sparkData?: HistoricoPoint[]
  accentColor?: string
  onDrill?: () => void
}

export default function KpiCard({ kpi, sparkData, accentColor, onDrill }: KpiCardProps) {
  if (kpi.formato === 'percent') {
    return <KpiCardPercent kpi={kpi} accentColor={accentColor} onDrill={onDrill} />
  }
  if (kpi.formato === 'text') {
    return <KpiCardText kpi={kpi} accentColor={accentColor} onDrill={onDrill} />
  }
  return (
    <KpiCardCount
      kpi={kpi}
      sparkData={sparkData}
      accentColor={accentColor}
      onDrill={onDrill}
    />
  )
}
