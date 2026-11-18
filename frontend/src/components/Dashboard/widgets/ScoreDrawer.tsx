import { useQuery } from '@tanstack/react-query'
import { getLeadsPorScoreFaixa, ScoreFaixaItem } from '../../../api/dashboard'
import { LeadRowSkeleton } from '../../ui/skeletons'
import LeadRow from '../shared/LeadRow'

// ── ScoreDrawer — drawer lateral com leads da faixa ──────────────────────────
interface ScoreDrawerProps {
  clienteId: string
  faixa: ScoreFaixaItem
  scoreMin: number
  scoreMax: number
  dataInicio?: string
  dataFim?: string
  onClose: () => void
}

export default function ScoreDrawer({ clienteId, faixa, scoreMin, scoreMax, dataInicio, dataFim, onClose }: ScoreDrawerProps) {
  const { data: leads, isLoading } = useQuery({
    queryKey: ['leads-score-faixa', clienteId, scoreMin, scoreMax, dataInicio, dataFim],
    queryFn: () => getLeadsPorScoreFaixa(clienteId, scoreMin, scoreMax, dataInicio, dataFim),
    staleTime: 30_000,
  })

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full w-full max-w-md z-50 flex flex-col"
        style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ background: faixa.cor }} />
            <div>
              <p className="text-sm font-bold text-white">Score {faixa.faixa}</p>
              <p className="text-xs text-gray-500">{faixa.label} · {faixa.total.toLocaleString('pt-BR')} leads</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading && <LeadRowSkeleton count={5} />}
          {!isLoading && (leads ?? []).length === 0 && (
            <p className="text-gray-500 text-sm text-center py-12">Nenhum lead nesta faixa</p>
          )}
          {(leads ?? []).map(lead => (
            <LeadRow key={lead.id} lead={lead} clienteId={clienteId} />
          ))}
        </div>
      </div>
    </>
  )
}
