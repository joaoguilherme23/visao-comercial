import api from './client'

export interface EmpresaPortfolio {
  id: string
  nome: string
  slug: string
  nicho: string | null
  ativo: boolean
  role: 'admin' | 'manager' | 'viewer'
  total_leads_ativos: number
  leads_urgencia_alta: number
}

export interface KpiPorEmpresa {
  cliente_id: string
  cliente_nome: string
  valor: number | string | null
}

export interface KpiAgregado {
  slug: string
  label: string
  descricao: string
  tipo: string | null
  tipo_agregacao: 'sum' | 'avg' | 'n/a'
  agregado: number | null
  por_empresa: KpiPorEmpresa[]
}

export interface KpisAgregadosResponse {
  periodo: { inicio: string | null; fim: string | null }
  total_empresas: number
  kpis: KpiAgregado[]
}

export interface LeadQuente {
  id: string
  nome: string | null
  whatsapp: string
  score: number | null
  temperatura: string | null
  etapa_funil: string | null
  updated_at: string
  cliente_id: string
  cliente_nome: string
  cliente_slug: string
}

export const portfolioApi = {
  /** Lista compacta das empresas do gestor com mini-stats. */
  empresas: () =>
    api.get<EmpresaPortfolio[]>('/portfolio/empresas').then((r) => r.data),

  /** KPIs agregados (subset) das N empresas. */
  kpisAgregados: (params?: { data_inicio?: string; data_fim?: string }) =>
    api
      .get<KpisAgregadosResponse>('/portfolio/kpis-agregados', { params })
      .then((r) => r.data),

  /** Top N leads por score (de todas as empresas). */
  leadsQuentes: (limit = 10) =>
    api
      .get<LeadQuente[]>('/portfolio/leads-quentes', { params: { limit } })
      .then((r) => r.data),
}
