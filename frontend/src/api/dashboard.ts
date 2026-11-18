import api from './client'

const OIDC_ENABLED = import.meta.env.VITE_OIDC_ENABLED === 'true'

export interface KpiCatalogo {
  id: string
  slug: string
  nome: string
  descricao?: string
  icone?: string
  cor?: string
  tipo_calculo: string
  config_calculo: Record<string, unknown>
  formato: string
  nichos_compativeis?: string[]
  categoria_kpi?: string
  is_builtin: boolean
  cliente_id?: string
  ordem_padrao?: number
  ativo: boolean
  created_at: string
}

export interface KpiSelecao {
  slug: string
  ordem: number
  visivel: boolean
}

export interface DashboardConfig {
  id: string
  cliente_id: string
  updated_by: string
  kpis: KpiSelecao[]
  layout: string
  created_at?: string
  updated_at?: string
}

export interface KpiResult {
  slug: string
  nome: string
  descricao?: string
  valor: number | string
  formato: string
  icone?: string
  cor?: string
  categoria_kpi?: string
  ordem: number
  variacao_pct?: number | null
  valor_anterior?: number | null
}

export interface TemperaturaResult {
  quente: number
  morno: number
  frio: number
  sem_temperatura: number
  total: number
}

export interface HistoricoPoint {
  data: string
  novos_leads: number
}

export interface PeriodoParams {
  data_inicio?: string
  data_fim?: string
  telefone_bot?: string
}

export interface FunilItem {
  etapa: string
  total: number
  pct: number
}

export interface ObjecaoItem {
  motivo: string
  total: number
  pct: number
}

export interface HorarioItem {
  faixa: string
  label: string
  total: number
  pct: number
}

export interface HorarioRespostaItem {
  hora: number
  label: string
  total: number
  pct: number
}

export interface SentimentoHistoricoItem {
  periodo: string
  positivo: number
  neutro: number
  negativo: number
  misto: number
}

export const dashboardApi = {
  getCatalogo: (nicho?: string, clienteId?: string) => {
    if (OIDC_ENABLED && !clienteId) {
      return Promise.reject(new Error('Tenant é obrigatório para o catálogo OIDC'))
    }
    const path = OIDC_ENABLED ? `/dashboard/${clienteId}/catalogo` : '/dashboard/catalogo'
    return api.get<KpiCatalogo[]>(path, {
      params: { ...(nicho ? { nicho } : {}), ...(clienteId ? { cliente_id: clienteId } : {}) },
    }).then((r) => r.data)
  },

  getConfig: (clienteId: string) =>
    api.get<DashboardConfig>(`/dashboard/${clienteId}/config`).then((r) => r.data),

  updateConfig: (clienteId: string, kpis: KpiSelecao[], layout = 'grid') =>
    api.put<DashboardConfig>(`/dashboard/${clienteId}/config`, { kpis, layout }).then((r) => r.data),

  getKpis: (clienteId: string, periodo?: PeriodoParams) =>
    api.get<KpiResult[]>(`/dashboard/${clienteId}/kpis`, {
      params: { ...(periodo || {}) },
    }).then((r) => r.data),

  getTemperatura: (clienteId: string, periodo?: PeriodoParams) =>
    api.get<TemperaturaResult>(`/dashboard/${clienteId}/temperatura`, {
      params: { ...(periodo || {}) },
    }).then((r) => r.data),

  getHistorico: (clienteId: string, periodo?: PeriodoParams) =>
    api.get<HistoricoPoint[]>(`/dashboard/${clienteId}/historico`, {
      params: { ...(periodo || {}) },
    }).then((r) => r.data),

  previewKpi: (clienteId: string, kpi: Partial<KpiCatalogo>) =>
    api.post<{ valor: unknown; formato: string }>(`/dashboard/${clienteId}/preview`, kpi).then((r) => r.data),
}

export const getFunil = (clienteId: string, params?: PeriodoParams) =>
  api.get<FunilItem[]>(`/dashboard/${clienteId}/funil`, {
    params: { ...(params || {}) },
  }).then((r) => r.data)

export const getObjecoes = (
  clienteId: string,
  params?: PeriodoParams & { somente_sem_conversao?: boolean },
) =>
  api.get<ObjecaoItem[]>(`/dashboard/${clienteId}/objecoes`, {
    params: { ...(params || {}) },
  }).then((r) => r.data)

export const getHorario = (clienteId: string, params?: PeriodoParams) =>
  api.get<HorarioItem[]>(`/dashboard/${clienteId}/horario`, {
    params: { ...(params || {}) },
  }).then((r) => r.data)

export const getHorarioRespostas = (clienteId: string, params?: PeriodoParams) =>
  api.get<HorarioRespostaItem[]>(`/dashboard/${clienteId}/horario-respostas`, {
    params: { ...(params || {}) },
  }).then((r) => r.data)

export const getHorarioLeads = (clienteId: string, params?: PeriodoParams) =>
  api.get<HorarioRespostaItem[]>(`/dashboard/${clienteId}/horario-leads`, {
    params: { ...(params || {}) },
  }).then((r) => r.data)

export const getSentimentoHistorico = (clienteId: string, params?: PeriodoParams) =>
  api.get<SentimentoHistoricoItem[]>(`/dashboard/${clienteId}/sentimento-historico`, {
    params: { ...(params || {}) },
  }).then((r) => r.data)

// ── Mensagens Volume ──────────────────────────────────────────────────────────

export interface MensagensResumo {
  total_ia: number
  total_lead: number
  total_geral: number
  pct_automacao: number
}

export interface MensagensDiaItem {
  data: string
  ia: number
  lead: number
  total: number
}

export interface MensagensVolumeResult {
  resumo: MensagensResumo
  serie: MensagensDiaItem[]
}

// ── Evolucao Anual ────────────────────────────────────────────────────────────

export interface EvolucaoAnualItem {
  periodo: string
  mes: number
  semana: number
  [key: string]: number | string
}

export interface EvolucaoAnualResult {
  ano: number
  agrupar_por: string
  chaves: string[]
  cores: Record<string, string>
  serie: EvolucaoAnualItem[]
}

export const getMensagensVolume = (clienteId: string, params?: PeriodoParams): Promise<MensagensVolumeResult> =>
  api.get(`/dashboard/${clienteId}/mensagens-volume`, { params }).then(r => r.data)

export const getEvolucaoAnual = (
  clienteId: string,
  ano: number,
  agrupar_por: 'temperatura' | 'etapa',
): Promise<EvolucaoAnualResult> =>
  api.get(`/dashboard/${clienteId}/evolucao-anual`, { params: { ano, agrupar_por } }).then(r => r.data)

// ── Dia da Semana ─────────────────────────────────────────────────────────────

export interface DiaSemanaItem {
  dia: number
  label: string
  nome: string
  total: number
  pct: number
}

export const getDiaSemana = (clienteId: string, params?: PeriodoParams): Promise<DiaSemanaItem[]> =>
  api.get(`/dashboard/${clienteId}/dia-semana`, { params }).then(r => r.data)

// ── Estado via DDD ────────────────────────────────────────────────────────────

export interface EstadoDDDItem {
  sigla: string
  nome: string
  total: number
  pct: number
}

export const getEstadoDDD = (clienteId: string, params?: PeriodoParams): Promise<EstadoDDDItem[]> =>
  api.get(`/dashboard/${clienteId}/estado-ddd`, { params }).then(r => r.data)

// ── Score de Qualificação — Faixas ────────────────────────────────────────────

export interface ScoreFaixaItem {
  faixa: string
  label: string
  cor: string
  total: number
  pct: number
}

export const getScoreFaixas = (clienteId: string, params?: PeriodoParams): Promise<ScoreFaixaItem[]> =>
  api.get(`/dashboard/${clienteId}/score-faixas`, { params }).then(r => r.data)

export interface LeadScoreItem {
  id: string
  nome: string | null
  whatsapp: string
  score: number | null
  etapa_funil: string | null
  temperatura: string | null
  created_at: string | null
}

export interface MensagemItem {
  id: string
  direcao: string
  tipo: string
  conteudo: string | null
  enviada_em: string
  enviado_por: string | null
}

export const getLeadsPorScoreFaixa = (
  clienteId: string,
  scoreMin: number,
  scoreMax: number,
  dataInicio?: string,
  dataFim?: string,
  limit = 50,
  offset = 0,
): Promise<LeadScoreItem[]> =>
  api.get(`/dashboard/${clienteId}/leads-score-faixa`, {
    params: { score_min: scoreMin, score_max: scoreMax, data_inicio: dataInicio, data_fim: dataFim, limit, offset },
  }).then(r => r.data)

export const getLeadMensagens = (
  clienteId: string,
  leadId: string,
  limit = 100,
): Promise<MensagemItem[]> =>
  api.get(`/kanban/${clienteId}/leads/${leadId}/messages`, {
    params: { limit },
  }).then(r => r.data)

export interface LeadRecenteItem {
  id: string
  nome: string | null
  whatsapp: string
  temperatura: string | null
  score: number | null
  etapa_funil: string | null
  created_at: string | null
  intencao?: string | null
}

export const getLeadsRecentes = (
  clienteId: string,
  params?: PeriodoParams,
): Promise<LeadRecenteItem[]> =>
  api.get(`/dashboard/${clienteId}/leads-recentes`, { params }).then(r => r.data)

export interface LeadDrillItem extends LeadScoreItem {}

export const getLeadsDrilldown = (
  clienteId: string,
  params: { slug?: string; temperatura?: string; etapa?: string; sigla?: string; campo_filtro?: string; valor_filtro?: string; data_inicio?: string; data_fim?: string; limit?: number; offset?: number },
): Promise<LeadDrillItem[]> =>
  api.get(`/dashboard/${clienteId}/leads-drilldown`, { params }).then(r => r.data)

// ── Nicho Campos (IA Extraction Fields) ──────────────────────────────────────

export interface CampoDefinicao {
  nome: string
  tipo: 'string' | 'number' | 'boolean' | 'date' | 'select'
  label: string
  obrigatorio?: boolean
  opcoes?: string[]
  descricao?: string
}

export interface NichoCampos {
  nicho: string
  campos_kpi: CampoDefinicao[]
  campos_analise: CampoDefinicao[]
}

export const getNichoCampos = (clienteId: string): Promise<NichoCampos> =>
  api.get(`/dashboard/${clienteId}/nicho-campos`).then(r => r.data)

export const updateNichoCampos = (
  clienteId: string,
  body: { campos_kpi: CampoDefinicao[]; campos_analise: CampoDefinicao[] },
): Promise<NichoCampos> =>
  api.put(`/dashboard/${clienteId}/nicho-campos`, body).then(r => r.data)

/**
 * Retorna a lista read-only dos campos de extração disponíveis para o nicho do tenant.
 * Usado pelo WidgetBuilder para popular o select de "Campo" — acessível por qualquer
 * membro com acesso ao tenant (gestor/admin).
 */
export const getCamposWidget = (clienteId: string): Promise<NichoCampos> =>
  api.get(`/dashboard/${clienteId}/campos-widget`).then(r => r.data)

// ── Analise Widgets ──────────────────────────────────────────────────────────

export interface AnaliseWidgetOut {
  id: string
  cliente_id: string | null
  nicho: string | null
  label: string
  descricao: string | null
  campo: string
  operacao: string
  limite: number
  filtros: Record<string, unknown>[]
  somente_sem_conversao: boolean
  tipo_grafico: string
  cor: string | null
  ordem: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface WidgetDataItem {
  label: string
  value: number | string
  pct?: number
}

export interface AnaliseWidgetDataOut {
  id: string
  label: string
  tipo_grafico: string
  operacao: string
  campo: string
  cor: string | null
  data: WidgetDataItem[]
  total_base: number
}

export interface AnaliseWidgetCreate {
  label: string
  descricao?: string
  campo: string
  operacao: string
  limite?: number
  filtros?: Record<string, unknown>[]
  somente_sem_conversao?: boolean
  tipo_grafico: string
  cor?: string
  ordem?: number
}

export interface AnaliseWidgetUpdate {
  label?: string
  descricao?: string
  campo?: string
  operacao?: string
  limite?: number
  filtros?: Record<string, unknown>[]
  somente_sem_conversao?: boolean
  tipo_grafico?: string
  cor?: string
  ordem?: number
  ativo?: boolean
}

export const WIDGET_COMPAT: Record<string, string[]> = {
  top_n:   ['bar', 'pie', 'donut', 'table', 'treemap', 'funnel', 'column'],
  count:   ['bar', 'pie', 'donut', 'line', 'area', 'metric', 'table', 'treemap', 'funnel', 'column'],
  avg:     ['bar', 'line', 'area', 'metric', 'column'],
  sum:     ['bar', 'line', 'area', 'metric', 'column'],
  min:     ['bar', 'line', 'area', 'metric', 'column'],
  max:     ['bar', 'line', 'area', 'metric', 'column'],
  percent: ['bar', 'pie', 'donut', 'metric', 'table', 'treemap', 'funnel', 'column'],
}

export const getWidgets = (clienteId: string): Promise<AnaliseWidgetOut[]> =>
  api.get(`/dashboard/${clienteId}/widgets`).then((r) => r.data)

export const createWidget = (
  clienteId: string,
  body: AnaliseWidgetCreate,
): Promise<AnaliseWidgetOut> =>
  api.post(`/dashboard/${clienteId}/widgets`, body).then((r) => r.data)

export const updateWidget = (
  clienteId: string,
  widgetId: string,
  body: AnaliseWidgetUpdate,
): Promise<AnaliseWidgetOut> =>
  api.patch(`/dashboard/${clienteId}/widgets/${widgetId}`, body).then((r) => r.data)

export const deleteWidget = (
  clienteId: string,
  widgetId: string,
): Promise<void> =>
  api.delete(`/dashboard/${clienteId}/widgets/${widgetId}`).then(() => undefined)

export const getWidgetData = (
  clienteId: string,
  widgetId: string,
  params?: PeriodoParams,
): Promise<AnaliseWidgetDataOut> =>
  api
    .get(`/dashboard/${clienteId}/widgets/${widgetId}/data`, { params })
    .then((r) => r.data)

// ── Comparativo de Números ────────────────────────────────────────────────────

export interface ComparativoNumeroItem {
  numero_id: string
  numero: string
  nome: string
  total_leads: number
  total_fechados: number
  taxa_conversao: number
  quente: number
  morno: number
  frio: number
  score_medio: number | null
  total_mensagens: number
}

export const getComparativoNumeros = (
  clienteId: string,
  params?: PeriodoParams,
): Promise<ComparativoNumeroItem[]> =>
  api.get(`/dashboard/${clienteId}/comparativo-numeros`, { params }).then(r => r.data)
