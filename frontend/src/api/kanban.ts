import api from './client'
import { KanbanBoard, KanbanStats, AnaliseFull } from '../types'

export interface KanbanFilters {
  temperatura?: string
  sentimento?: string
  search?: string
  periodo?: string
  data_inicio?: string
  data_fim?: string
  telefone_bot?: string
}

export const kanbanApi = {
  getBoard: (clienteId: string, filters?: KanbanFilters) =>
    api.get<KanbanBoard>(`/kanban/${clienteId}/board`, { params: filters }).then((r) => r.data),

  moveCard: (clienteId: string, leadId: string, novaEtapa: string, novaTemperatura?: string) =>
    api.patch(`/kanban/${clienteId}/move`, {
      lead_id: leadId,
      nova_etapa: novaEtapa,
      nova_temperatura: novaTemperatura,
    }).then((r) => r.data),

  getStats: (clienteId: string) =>
    api.get<KanbanStats>(`/kanban/${clienteId}/stats`).then((r) => r.data),

  getLeadAnalyses: (clienteId: string, leadId: string) =>
    api.get<AnaliseFull[]>(`/kanban/${clienteId}/leads/${leadId}/analyses`).then((r) => r.data),
}
