/**
 * KPI Clusters — agrupamento COMERCIAL dos KPIs.
 *
 * Substitui a categorização técnica do backend (leads/analise/conversao/
 * operacional) por 6 blocos narrativos que seguem a jornada mental do
 * diretor comercial no dashboard.
 *
 * Ordem de leitura pensada para Rafael Moretti (persona Fase 1):
 *   1. PULSO        — "o que está acontecendo agora?"
 *   2. URGÊNCIA     — "onde agir hoje?"
 *   3. INTELIGÊNCIA — "o que a IA detectou?"
 *   4. CONVERSÃO    — "como estamos convertendo?"
 *   5. PERFIL       — "quem são nossos leads?"
 *   6. OPERACIONAL  — "como o time está performando?"
 *
 * Cada slug mapeia pra exatamente 1 cluster (sem sobreposição).
 */

export type KpiCluster =
  | 'pulso'
  | 'urgencia'
  | 'inteligencia'
  | 'conversao'
  | 'perfil'
  | 'operacional'

export interface ClusterMeta {
  id: KpiCluster
  label: string
  subtitle: string
  /** Cor do accent lateral do SectionHeader */
  color: string
  /** Ordem de renderização */
  order: number
}

export const CLUSTER_META: Record<KpiCluster, ClusterMeta> = {
  pulso: {
    id: 'pulso',
    label: 'PULSO',
    subtitle: 'O que está acontecendo agora',
    color: '#0b9692', // indigo brand
    order: 1,
  },
  urgencia: {
    id: 'urgencia',
    label: 'URGÊNCIA — AGE HOJE',
    subtitle: 'Sinais que precisam de atenção imediata',
    color: '#ef4444', // red-500
    order: 2,
  },
  inteligencia: {
    id: 'inteligencia',
    label: 'INTELIGÊNCIA IA',
    subtitle: 'Padrões que a IA detectou nas conversas',
    color: '#0e7490', // brand-500
    order: 3,
  },
  conversao: {
    id: 'conversao',
    label: 'CONVERSÃO',
    subtitle: 'Taxas e qualidade do pipeline',
    color: '#10E088', // signal-success
    order: 4,
  },
  perfil: {
    id: 'perfil',
    label: 'PERFIL DOS LEADS',
    subtitle: 'Quem são e de onde vêm',
    color: '#06b6d4', // cyan-500
    order: 5,
  },
  operacional: {
    id: 'operacional',
    label: 'OPERACIONAL',
    subtitle: 'Volume de mensagens e saúde do sistema',
    color: '#64748b', // slate-500
    order: 6,
  },
}

/**
 * Mapa canônico slug → cluster comercial.
 * Slug não listado cai em 'operacional' como fallback (visibilidade low).
 */
const SLUG_TO_CLUSTER: Record<string, KpiCluster> = {
  // ── PULSO — pulso geral da operação ───────────────────────────────────
  total_leads:                   'pulso',
  leads_identificados:           'pulso',
  leads_recorrentes:             'pulso',

  // ── URGÊNCIA — age hoje ───────────────────────────────────────────────
  leads_urgencia_alta:            'urgencia',
  leads_urgencia_media:           'urgencia',
  leads_urgencia_baixa:           'urgencia',
  pct_alta_urgencia:              'urgencia',
  urgencia_predominante:          'urgencia',
  tempo_primeira_resposta:        'urgencia',
  horario_medio_resposta:         'urgencia',
  analises_negativas:             'urgencia',
  leads_sem_etapa:                'urgencia',
  leads_com_followup:             'urgencia',

  // ── INTELIGÊNCIA — padrões detectados pela IA ─────────────────────────
  sentimento_predominante:        'inteligencia',
  intencao_predominante:          'inteligencia',
  motivo_nao_fechamento_predominante: 'inteligencia',
  melhoria_atendimento_freq:      'inteligencia',
  analises_positivas:             'inteligencia',
  analises_neutras:               'inteligencia',

  // ── CONVERSÃO — qualidade e fechamento ────────────────────────────────
  leads_ativos:                   'conversao',
  score_medio:                    'conversao',
  score_interesse_medio:          'conversao',
  score_fechamento_alto:          'conversao',
  leads_oportunidade_aberta:      'conversao',
  pct_leads_fechados:             'conversao',
  pct_leads_perdidos:             'conversao',
  pct_interesse_alto:             'conversao',
  pct_fechamento_alto:            'conversao',
  pct_sentimento_positivo:        'conversao',
  pct_leads_identificados:        'conversao',
  pct_leads_recorrentes:          'conversao',
  pct_media_urgencia:             'conversao',
  pct_baixa_urgencia:             'conversao',
  media_msgs_conversa:            'conversao',

  // ── PERFIL — quem são os leads ────────────────────────────────────────
  etapa_mais_comum:               'perfil',
  origem_mais_comum:              'perfil',
  regiao_predominante:            'perfil',
  perfil_lead_predominante:       'perfil',
  cidade_predominante:            'perfil',
  estado_predominante:            'perfil',
  genero_predominante:            'perfil',
  leads_com_cidade:               'perfil',

  // ── OPERACIONAL — volume e saúde ──────────────────────────────────────
  total_mensagens:                'operacional',
  msgs_recebidas:                 'operacional',
  msgs_enviadas:                  'operacional',
  pct_msgs_recebidas:             'operacional',
  pct_msgs_enviadas:              'operacional',
  dia_semana_predominante:        'operacional',
}

export function getCluster(slug: string): KpiCluster {
  return SLUG_TO_CLUSTER[slug] ?? 'operacional'
}

/**
 * Agrupa uma lista de KPIs por cluster.
 * Retorna na ordem canônica dos clusters (pulso → operacional).
 */
export function groupByCluster<T extends { slug: string }>(
  kpis: T[],
): Array<{ cluster: KpiCluster; meta: ClusterMeta; kpis: T[] }> {
  const buckets: Record<KpiCluster, T[]> = {
    pulso: [],
    urgencia: [],
    inteligencia: [],
    conversao: [],
    perfil: [],
    operacional: [],
  }
  for (const kpi of kpis) {
    buckets[getCluster(kpi.slug)].push(kpi)
  }
  return (Object.keys(buckets) as KpiCluster[])
    .filter(c => buckets[c].length > 0)
    .sort((a, b) => CLUSTER_META[a].order - CLUSTER_META[b].order)
    .map(c => ({ cluster: c, meta: CLUSTER_META[c], kpis: buckets[c] }))
}

/**
 * Slugs CRÍTICOS para o TopKpiStrip — 8 mais importantes comercialmente
 * em ordem de prioridade de leitura. Cobre as 4 perguntas-chave do diretor:
 * "quanto temos / o que tá quente / qual a pressão / taxa de fechamento".
 */
export const TOP_STRIP_CRITICAL_SLUGS: readonly string[] = [
  'total_leads',
  'leads_oportunidade_aberta',
  'score_fechamento_alto',
  'leads_recorrentes',
  'tempo_primeira_resposta',
  'leads_urgencia_alta',
  'pct_leads_fechados',
  'score_medio',
]

/**
 * Ordena uma lista de KPIs seguindo TOP_STRIP_CRITICAL_SLUGS.
 * KPIs fora da lista ficam no fim (preserva ordem original).
 */
export function orderTopStrip<T extends { slug: string }>(kpis: T[]): T[] {
  const bySlug = new Map(kpis.map(k => [k.slug, k]))
  const ordered: T[] = []
  for (const slug of TOP_STRIP_CRITICAL_SLUGS) {
    const kpi = bySlug.get(slug)
    if (kpi) {
      ordered.push(kpi)
      bySlug.delete(slug)
    }
  }
  // Complementa com os que sobraram se precisar preencher até 8
  return [...ordered, ...bySlug.values()]
}
