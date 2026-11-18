import api from './client'
import { ConversaPreview, ConversasListResponse, Mensagem } from '../types'

export interface AnaliseResumoOut {
  id: string; data_ref: string; sentimento?: string
  score_interesse?: number; intencao?: string
  proximo_passo?: string; resumo_curto?: string; total_msgs: number
}

export interface AnaliseLeadExtraOut {
  genero?: string; oportunidade_aberta?: boolean
  motivo_nao_fechamento?: string; motivo_desistencia?: string
  melhoria_atendimento?: string; melhoria_negociacao?: string
  frases_ditas_lead?: string[]; frases_chave_negativas?: string[]
}

export interface LeadDetalhe {
  id: string; cliente_id: string; whatsapp: string; nome?: string
  origem?: string; etapa_funil?: string
  temperatura?: string; score?: number; extras?: Record<string, unknown>
  bloqueado: boolean; ativo: boolean
  cidade_lead?: string; estado_lead?: string; perfil_lead?: string
  lead_recorrente: boolean; followup_em?: string; primeiraresposta_em?: string
  /** Foto sincronizada do WhatsApp (path relativo do backend). */
  foto_url?: string | null
  created_at: string; updated_at: string
  analise?: AnaliseResumoOut; analise_extra?: AnaliseLeadExtraOut
}

export interface ConversationsFilters {
  data_inicio?: string
  data_fim?: string
  temperatura?: string
  etapa_funil?: string
  sentimento?: string
  telefone_bot?: string
  /** Busca global por nome ou WhatsApp do lead. Acumula com os outros filtros. */
  search?: string
  /** Paginação — default 0. */
  offset?: number
  /** Tamanho da página — default 100, max 200. */
  limit?: number
}

export const conversasApi = {
  /** Lista paginada de conversas. Backend retorna envelope `{items, total, has_more, next_offset}`. */
  getConversations: (clienteId: string, params?: ConversationsFilters) =>
    api.get<ConversasListResponse>(`/kanban/${clienteId}/conversations`, { params }).then((r) => r.data),

  getConversationsEtapas: (clienteId: string) =>
    api.get<string[]>(`/kanban/${clienteId}/conversations/etapas`).then((r) => r.data),

  getMessages: (
    clienteId: string,
    leadId: string,
    params?: { limit?: number; offset?: number; order?: 'asc' | 'desc' }
  ) =>
    api
      .get<Mensagem[]>(`/kanban/${clienteId}/leads/${leadId}/messages`, { params })
      .then((r) => r.data),

  getLeadDetalhe: (clienteId: string, leadId: string): Promise<LeadDetalhe> =>
    api.get(`/kanban/${clienteId}/leads/${leadId}`).then(r => r.data),

  inativarLead: (clienteId: string, leadId: string) =>
    api.patch(`/kanban/${clienteId}/leads/${leadId}/inativar`).then(r => r.data),
}
