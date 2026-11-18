import { useState } from 'react'
import { ScoreFaixaItem } from '../../../api/dashboard'
import InfoTooltip from '../shared/InfoTooltip'
import ScoreDrawer from './ScoreDrawer'

// ── ScoreFaixasPanel — tabela com faixas coloridas ───────────────────────────
export default function ScoreFaixasPanel({
  data,
  clienteId,
  dataInicio,
  dataFim,
}: {
  data?: ScoreFaixaItem[]
  clienteId: string
  dataInicio?: string
  dataFim?: string
}) {
  const items = data ?? []
  const totalLeads = items.reduce((acc, i) => acc + i.total, 0)
  const [selected, setSelected] = useState<ScoreFaixaItem | null>(null)

  // Mapeia faixa string "9–10" para scoreMin/scoreMax
  const faixaRange = (faixa: string): [number, number] => {
    const parts = faixa.replace('–', '-').split('-').map(Number)
    return [parts[0] ?? 1, parts[1] ?? parts[0] ?? 10]
  }

  return (
    <>
      <div className="card-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Score de Qualificação dos Leads (IA)
            </p>
            <InfoTooltip text="Distribuição dos leads por faixa de score (0–10), calculado pela IA com base no perfil e engajamento de cada lead. Quanto maior o score, maior a probabilidade de fechamento. Clique em uma faixa para ver os leads." />
          </div>
          <span className="text-[10px] text-gray-600">Clique para ver os leads</span>
        </div>
        {items.length === 0 || totalLeads === 0 ? (
          <p className="text-gray-600 text-sm text-center py-6">Sem dados de score para o período</p>
        ) : (
          <>
            <div className="grid grid-cols-12 gap-2 px-3 mb-1">
              <span className="col-span-5 text-xs text-gray-600 font-medium">Faixa de score</span>
              <span className="col-span-4 text-xs text-gray-600 font-medium text-right">Leads</span>
              <span className="col-span-3 text-xs text-gray-600 font-medium text-right">%</span>
            </div>
            <div className="space-y-1.5">
              {items.map((item) => {
                const { faixa, label, cor, total, pct } = item
                return (
                  <button
                    key={faixa}
                    className="w-full grid grid-cols-12 gap-2 items-center rounded-lg px-3 py-2 text-left transition-opacity hover:opacity-80 active:scale-[0.99]"
                    style={{ background: `${cor}18`, border: `1px solid ${cor}33`, cursor: 'pointer' }}
                    onClick={() => setSelected(item)}
                  >
                    <div className="col-span-5 flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cor }} />
                      <span className="text-xs font-semibold" style={{ color: cor }}>Score {faixa}</span>
                      <span className="text-xs text-gray-400 truncate">{label}</span>
                    </div>
                    <span className="col-span-4 text-sm font-bold text-white text-right">
                      {total.toLocaleString('pt-BR')}
                    </span>
                    <span className="col-span-3 text-xs font-semibold text-right" style={{ color: cor }}>
                      {pct}%
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-gray-700 mt-3">
              Score calculado automaticamente com base no perfil e comportamento do lead na conversa
            </p>
          </>
        )}
      </div>

      {selected && (
        <ScoreDrawer
          clienteId={clienteId}
          faixa={selected}
          scoreMin={faixaRange(selected.faixa)[0]}
          scoreMax={faixaRange(selected.faixa)[1]}
          dataInicio={dataInicio}
          dataFim={dataFim}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
