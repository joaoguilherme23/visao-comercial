import { useMemo } from 'react'
import { semanticColors } from '../../lib/semanticColors'

interface ObjecaoItem {
  motivo: string
  total: number
  pct: number
}

interface Props {
  data?: ObjecaoItem[]
  /** Base opcional — total de leads sem conversão. Se não vier, usa soma das objeções. */
  baseline?: number
}

/**
 * Waterfall (cascata) das objeções — visualiza o impacto sequencial de cada
 * motivo no universo de leads sem conversão. Cada barra "desce" do topo,
 * acumulando a perda. Útil pra priorização ("se resolver top-3, recupera X%").
 *
 * Leitura: topo = 100% dos sem conversão; cada etapa remove os leads que
 * pararam naquele motivo. O residual no final é "outros / não classificado".
 *
 * Diferente do bar chart plano, a cascata comunica PERDA ACUMULADA.
 */
export default function ObjecoesWaterfall({ data, baseline }: Props) {
  const rows = useMemo(() => {
    const items = (data ?? []).slice(0, 6) // top 6 pra caber na cascata sem virar ilegível
    const total = baseline ?? items.reduce((acc, i) => acc + i.total, 0)
    if (total === 0) return []

    let running = total
    return items.map((item) => {
      const before = running
      running -= item.total
      const pctBefore = (before / total) * 100
      const pctAfter = Math.max(0, (running / total) * 100)
      return {
        motivo: item.motivo,
        total: item.total,
        pctBefore,
        pctAfter,
        dropPct: pctBefore - pctAfter,
      }
    })
  }, [data, baseline])

  if (rows.length === 0) {
    return <p className="text-gray-600 text-sm text-center py-6">Sem dados para o período</p>
  }

  return (
    <div className="space-y-1.5">
      {rows.map((row, i) => {
        // Cor desce de vermelho→cinza conforme impacto diminui (usando paleta semântica).
        const color =
          i === 0 ? semanticColors.temperatura.quente
          : i < 3 ? semanticColors.temperatura.morno
          : semanticColors.temperatura.frio

        return (
          <div key={row.motivo} className="group">
            <div className="flex items-center gap-2 text-xs mb-0.5">
              <span className="truncate flex-1" style={{ color: 'var(--text-2)' }} title={row.motivo}>
                {i + 1}. {row.motivo}
              </span>
              <span className="font-mono-data flex-shrink-0" style={{ color }}>
                −{row.dropPct.toFixed(1)}%
              </span>
              <span className="font-mono-data text-gray-500 flex-shrink-0">
                {row.total.toLocaleString('pt-BR')}
              </span>
            </div>

            {/* Barra acumulada: segmento esquerdo = antes, segmento colorido = drop, ocultado = depois */}
            <div
              className="w-full h-5 rounded overflow-hidden flex"
              style={{ background: 'var(--bg-elevated)' }}
            >
              {/* "Depois" (remanescente) — fica visível em cinza claro pra referência */}
              <div
                className="h-full transition-all duration-700 ease-out"
                style={{
                  width: `${row.pctAfter}%`,
                  background: 'var(--border-muted)',
                  opacity: 0.35,
                }}
              />
              {/* Drop — fatia que representa essa objeção */}
              <div
                className="h-full transition-all duration-700 ease-out"
                style={{
                  width: `${row.dropPct}%`,
                  background: color,
                }}
              />
              {/* Resto vazio → antes */}
            </div>
          </div>
        )
      })}
    </div>
  )
}
