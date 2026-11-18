import { useQuery } from '@tanstack/react-query'
import { getLeadsDrilldown, LeadScoreItem } from '../../../api/dashboard'
import { LeadRowSkeleton } from '../../ui/skeletons'
import LeadRow from '../shared/LeadRow'
import type { LeadDrillFilter } from '../types'

// LeadDrillDrawer — lista genérica acionada por clique nos KPIs/temperatura/funil
interface LeadDrillDrawerProps {
  title: string
  clienteId: string
  filter: LeadDrillFilter
  onClose: () => void
  onClickLead?: (lead: LeadScoreItem) => void
}

export default function LeadDrillDrawer({ title, clienteId, filter, onClose, onClickLead }: LeadDrillDrawerProps) {
  const { data: leads, isLoading } = useQuery({
    queryKey: ['leads-drill', clienteId, filter],
    queryFn: () => getLeadsDrilldown(clienteId, filter),
    enabled: !!clienteId,
    staleTime: 30_000,
  })

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-md z-50 flex flex-col" style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex flex-col">
            <p className="text-sm font-bold text-white">{title}</p>
            <p className="text-xs text-gray-500">Leads no critério selecionado</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading && <LeadRowSkeleton count={5} />}
          {!isLoading && (leads ?? []).length === 0 && (
            <p className="text-gray-500 text-sm text-center py-12">Nenhum lead encontrado</p>
          )}
          {(leads ?? []).map(lead => (
            <LeadRow key={lead.id} lead={lead} clienteId={clienteId} onClickLead={onClickLead} />
          ))}
        </div>
      </div>
    </>
  )
}
