import { useMemo } from 'react'

interface HeatmapItem {
  /** Hora do dia (0-23) — pode vir como string ou number. */
  hora: number | string
  label?: string
  total: number
}

interface Props {
  data?: HeatmapItem[]
  /** Cor base da escala — default ~brand index. */
  color?: string
  /** Altura das células em px. Default 22. */
  cellSize?: number
  /** Quando passa, dispara drill pra hora clicada. */
  onHourClick?: (hora: number) => void
}

/**
 * Heatmap 1×24 — mostra intensidade por hora do dia. Cada célula é pintada
 * com opacidade proporcional ao valor (min=0.08, max=1.0). Útil pra identificar
 * picos de atividade sem precisar de gráfico com eixos.
 *
 * Exemplo:
 *   <HeatmapHour data={horarioLeads} color="#3b5bdb" />
 */
export default function HeatmapHour({
  data,
  color = '#3b5bdb',
  cellSize = 22,
  onHourClick,
}: Props) {
  const { cells, max } = useMemo(() => {
    // Preenche 0..23 garantindo que todas as horas existam (zera se faltar).
    const byHour = new Map<number, number>()
    ;(data ?? []).forEach((d) => {
      const h = typeof d.hora === 'string' ? parseInt(d.hora, 10) : d.hora
      if (Number.isFinite(h) && h >= 0 && h < 24) byHour.set(h, (byHour.get(h) ?? 0) + d.total)
    })
    const filled = Array.from({ length: 24 }, (_, h) => ({ hora: h, total: byHour.get(h) ?? 0 }))
    const peak = Math.max(1, ...filled.map((c) => c.total))
    return { cells: filled, max: peak }
  }, [data])

  const totalLeads = cells.reduce((acc, c) => acc + c.total, 0)

  if (totalLeads === 0) {
    return <p className="text-gray-600 text-sm text-center py-6">Sem dados para o período</p>
  }

  return (
    <div className="space-y-1.5">
      {/* Células */}
      <div className="flex gap-0.5">
        {cells.map((c) => {
          // Intensidade mínima 8% pra célula com 0 não sumir de vez.
          const intensity = c.total === 0 ? 0.04 : 0.15 + (c.total / max) * 0.85
          return (
            <button
              key={c.hora}
              type="button"
              onClick={() => onHourClick?.(c.hora)}
              className="rounded-sm transition-transform hover:scale-110"
              style={{
                flex: 1,
                height: cellSize,
                background: color,
                opacity: intensity,
                cursor: onHourClick ? 'pointer' : 'default',
              }}
              title={`${String(c.hora).padStart(2, '0')}h — ${c.total.toLocaleString('pt-BR')} lead${c.total !== 1 ? 's' : ''}`}
              aria-label={`${c.hora}h: ${c.total} leads`}
            />
          )
        })}
      </div>

      {/* Régua horária — mostra 00, 06, 12, 18, 23 pra leitura */}
      <div className="flex justify-between text-[9px] font-mono-data" style={{ color: 'var(--text-3)' }}>
        <span>00h</span>
        <span>06h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>

      {/* Legenda compacta — ponta baixa → alta */}
      <div className="flex items-center gap-2 pt-1">
        <span className="text-[9px]" style={{ color: 'var(--text-3)' }}>menos</span>
        <div className="flex gap-0.5">
          {[0.2, 0.4, 0.6, 0.8, 1].map((i) => (
            <div key={i} className="w-3 h-2 rounded-sm" style={{ background: color, opacity: i }} />
          ))}
        </div>
        <span className="text-[9px]" style={{ color: 'var(--text-3)' }}>mais</span>
        <span className="text-[9px] ml-auto font-mono-data" style={{ color: 'var(--text-2)' }}>
          pico: {max.toLocaleString('pt-BR')}
        </span>
      </div>
    </div>
  )
}
