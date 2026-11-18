import api from './client'

export interface LlmLogsFilters {
  data_inicio?: string  // ISO date
  data_fim?: string
  cliente_id?: string
  modelo?: string
  workflow?: string
}

export interface LlmModelBreakdown {
  model: string
  matched_pricing_key: string | null
  pricing_missing: boolean
  calls: number
  total_tokens: number
  prompt_tokens: number
  completion_tokens: number
  cached_tokens: number
  cost_usd: number | null
  cost_brl: number | null
}

export interface LlmTenantBreakdown {
  cliente_id: string | null
  cliente_nome: string | null
  calls: number
  total_tokens: number
  cost_usd: number | null
  cost_brl: number | null
  budget_brl_diario: number | null
  cost_brl_today: number | null
  over_budget: boolean
}

export interface LlmWorkflowBreakdown {
  workflow_name: string | null
  calls: number
  total_tokens: number
  cost_usd: number | null
  cost_brl: number | null
}

export interface LlmDailySeries {
  dia: string
  calls: number
  total_tokens: number
  cost_usd: number | null
  cost_brl: number | null
}

export interface LlmLogsSummary {
  periodo: { inicio: string | null; fim: string | null }
  total_calls: number
  total_tokens: number
  total_prompt_tokens: number
  total_completion_tokens: number
  total_cached_tokens: number
  cost_usd: number | null
  cost_brl: number | null
  avg_cost_brl_per_call: number | null
  usd_to_brl_rate: number
  has_pricing_gaps: boolean
  tenants_over_budget_today: number
  by_model: LlmModelBreakdown[]
  by_tenant: LlmTenantBreakdown[]
  by_workflow: LlmWorkflowBreakdown[]
  daily: LlmDailySeries[]
}

export interface LlmLogItem {
  id: number
  created_at: string
  model: string | null
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cached_tokens: number
  reasoning_tokens: number
  qtd_msg: number | null
  workflow_name: string | null
  nicho: string | null
  cliente_id: string | null
  cliente_nome: string | null
  cost_usd: number | null
  cost_brl: number | null
  pricing_missing: boolean
}

export interface LlmLogsItemsPage {
  total: number
  limit: number
  offset: number
  items: LlmLogItem[]
}

export interface LlmFiltrosResponse {
  modelos: { value: string; count: number }[]
  workflows: { value: string; count: number }[]
  tenants: { cliente_id: string; nome: string; count: number }[]
}

export const llmLogsApi = {
  summary: (filters: LlmLogsFilters = {}) =>
    api
      .get<LlmLogsSummary>('/llm-logs/summary', { params: filters })
      .then((r) => r.data),

  items: (filters: LlmLogsFilters & { limit?: number; offset?: number } = {}) =>
    api
      .get<LlmLogsItemsPage>('/llm-logs/items', { params: filters })
      .then((r) => r.data),

  filtros: () =>
    api.get<LlmFiltrosResponse>('/llm-logs/filtros').then((r) => r.data),

  /**
   * Baixa CSV dos logs filtrados. Sem paginação — traz tudo que casa
   * com o filtro (até 10k linhas).
   */
  exportCsv: async (filters: LlmLogsFilters = {}): Promise<Blob> => {
    const r = await api.get('/llm-logs/export.csv', {
      params: filters,
      responseType: 'blob',
    })
    return r.data as Blob
  },
}
