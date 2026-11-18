import { useTenantStore } from '../store/tenantStore'
import KanbanBoard from '../components/Kanban/KanbanBoard'
import { Kanban } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/ds'

export default function KanbanPage() {
  const { selectedTenant } = useTenantStore()
  const [searchParams] = useSearchParams()
  const initialLeadId = searchParams.get('leadId') ?? undefined
  const highlight = searchParams.get('highlight') === '1'

  if (!selectedTenant) {
    return (
      <EmptyState
        variant="info"
        icon={Kanban}
        title="Selecione um tenant"
        description="para visualizar o Kanban"
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold text-white">Kanban</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {selectedTenant.nome} · Gerencie os leads por etapa do funil
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <KanbanBoard clienteId={selectedTenant.id} initialLeadId={initialLeadId} highlight={highlight} />
      </div>
    </div>
  )
}
