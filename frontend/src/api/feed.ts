import api from './client'
import type { FeedListResponse, ComentarioLead, SnoozePreset } from '../types'

export interface FeedFilters {
  search?: string
  temperatura?: string
  etapa_funil?: string
  so_acao_requerida?: boolean
  telefone_bot?: string
  /** Paginação — default 0. */
  offset?: number
  /** Quantos cards por página — default 50, max 200. */
  limit?: number
}

export const feedApi = {
  list: (clienteId: string, filters?: FeedFilters) =>
    api
      .get<FeedListResponse>(`/feed/${clienteId}`, { params: filters })
      .then((r) => r.data),

  listComentarios: (clienteId: string, leadId: string) =>
    api
      .get<ComentarioLead[]>(`/feed/${clienteId}/leads/${leadId}/comentarios`)
      .then((r) => r.data),

  createComentario: (clienteId: string, leadId: string, texto: string) =>
    api
      .post<ComentarioLead>(`/feed/${clienteId}/leads/${leadId}/comentarios`, { texto })
      .then((r) => r.data),

  /** Reaproveita o endpoint do kanban — lista de etapas do nicho do cliente. */
  etapas: (clienteId: string) =>
    api.get<string[]>(`/kanban/${clienteId}/conversations/etapas`).then((r) => r.data),

  /** Marca lead como concluído no feed — sai da listagem. */
  concluir: (clienteId: string, leadId: string) =>
    api.post(`/feed/${clienteId}/leads/${leadId}/concluir`).then((r) => r.data),

  /** Reverte conclusão — card volta ao feed. */
  desfazerConclusao: (clienteId: string, leadId: string) =>
    api.post(`/feed/${clienteId}/leads/${leadId}/desfazer-conclusao`).then((r) => r.data),

  /** Soneca temporária com preset. */
  snooze: (clienteId: string, leadId: string, preset: SnoozePreset) =>
    api.post(`/feed/${clienteId}/leads/${leadId}/snooze`, { preset }).then((r) => r.data),

  /** Soneca com timestamp específico (UTC ISO). */
  snoozeAte: (clienteId: string, leadId: string, ate: string) =>
    api.post(`/feed/${clienteId}/leads/${leadId}/snooze`, { ate }).then((r) => r.data),

  /** Limpa snooze — card volta ao feed. */
  unsnooze: (clienteId: string, leadId: string) =>
    api.post(`/feed/${clienteId}/leads/${leadId}/unsnooze`).then((r) => r.data),
}
