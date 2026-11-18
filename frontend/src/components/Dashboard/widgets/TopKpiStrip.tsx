import type React from 'react'
import type { LucideIcon } from 'lucide-react'
import type { KpiResult, HistoricoPoint } from '../../../api/dashboard'
import KpiCardTop from '../KpiCard'
import { ICON_MAP } from '../constants'
import { useIsLgUp } from '../utils'
import { orderTopStrip } from '../kpiClusters'

export default function TopKpiStrip({ kpis, sparkData, extraCard, onDrill }: {
  kpis: KpiResult[]
  sparkData?: HistoricoPoint[]
  extraCard?: React.ReactNode
  onDrill?: (kpi: KpiResult) => void
}) {
  const filtered = kpis.filter(k => k.slug !== 'leads_inativos')
  // Ordena pela prioridade comercial (TOP_STRIP_CRITICAL_SLUGS) e pega até 8
  const top = orderTopStrip(filtered).slice(0, 8)
  if (top.length === 0 && !extraCard) return null

  // Máximo de 4 KPIs por linha — quebra em 2 linhas quando tiver 5-8.
  // Mobile: 2 cols. Tablet (sm+): 3 cols. Desktop (lg+): 4 cols (fixo).
  // Com 1-3 KPIs, distribui em colunas iguais pra evitar espaço ocioso.
  const isLgUp = useIsLgUp()
  const fewCards = top.length < 4

  return (
    <div className="space-y-3">
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
      style={
        isLgUp && fewCards
          ? { gridTemplateColumns: `repeat(${top.length}, minmax(0, 1fr))` }
          : undefined
      }
    >
      {/* KPIs cujo aumento é ruim — variação mostrada com cor invertida */}
      {top.map(kpi => {
        // Slugs cuja alta é ruim (aumento = vermelho). Nota: 'tempo_primeira_resposta'
        // é o nome canônico no kpi_catalog.py — 'tempo_medio_resposta' nunca existiu.
        const inverseVariation = kpi.slug === 'pct_leads_perdidos' || kpi.slug === 'tempo_primeira_resposta'
        return (
          <KpiCardTop
            key={kpi.slug}
            kpi={kpi}
            iconMap={ICON_MAP as Record<string, LucideIcon>}
            sparkData={sparkData}
            onDrill={onDrill}
            inverseVariation={inverseVariation}
          />
        )
      })}
    </div>
    {extraCard && <div className="space-y-3">{extraCard}</div>}
    </div>
  )
}
