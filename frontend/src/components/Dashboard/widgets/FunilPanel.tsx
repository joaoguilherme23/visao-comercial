import type { FunilItem } from '../../../api/dashboard'
import InfoTooltip from '../shared/InfoTooltip'
import HBarRow from '../shared/HBarRow'

// ── FunilPanel — maxPct fixo relativo ao topo do funil (etapa 1 = 100%) ──────
export default function FunilPanel({ data, onSelect }: { data?: FunilItem[]; onSelect?: (etapa: string) => void }) {
  const items = data ?? []
  // A primeira etapa é o topo do funil (100%) — as demais são proporcionais a ela
  const topTotal = items[0]?.total ?? 1

  return (
    <div className="card-surface p-5 h-full">
      <div className="flex items-center gap-1.5 mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Funil de Conversão</p>
        <InfoTooltip text="Quantidade de leads em cada etapa do funil de vendas. A porcentagem é calculada em relação à primeira etapa (topo do funil = 100%)." />
      </div>
      {items.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-6">Sem dados para o período</p>
      ) : (
        <div className="space-y-3">
          {items.map(({ etapa, total }, idx) => {
            const pctRelativo = Math.round((total / topTotal) * 100)
            return (
              // Stagger: cada linha entra com atraso incremental pra sensação de cascata.
              <div
                key={etapa}
                className="animate-fade-in"
                style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'backwards' }}
              >
                <HBarRow
                  label={etapa}
                  total={total}
                  pct={pctRelativo}
                  color="#0e7490"
                  maxPct={100}
                  onClick={() => onSelect?.(etapa)}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
