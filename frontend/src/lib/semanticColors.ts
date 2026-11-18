/**
 * Mapa único de cores semânticas do X9.
 * Sempre consulte aqui antes de hardcodar cor em componente.
 *
 * Regra: cor expressa significado, não estilo decorativo.
 *   - Quente/morno/frio → temperatura do lead
 *   - Positivo/neutro/negativo → sentimento
 *   - Up/down/flat → variação de métrica
 *   - Rápido/médio/lento → latência (tempo até resposta etc)
 *   - Low/mid/high → intensidade de conversão (escala indigo/brand)
 */

export type Temperatura = 'quente' | 'morno' | 'frio'
export type Sentimento = 'positivo' | 'neutro' | 'negativo'
export type Variacao = 'up' | 'down' | 'flat'
export type Latencia = 'rapido' | 'medio' | 'lento'
export type Conversao = 'low' | 'mid' | 'high'

// Tons principais (hex fechado — referencia direta)
export const semanticColors = {
  temperatura: {
    quente: '#ef4444', // red-500
    morno:  '#f97316', // orange-500
    frio:   '#3b82f6', // blue-500
  },
  sentimento: {
    positivo: '#22c55e', // green-500
    neutro:   '#94a3b8', // slate-400
    negativo: '#ef4444', // red-500
  },
  variacao: {
    up:   '#4ade80', // green-400
    down: '#f87171', // red-400
    flat: '#94a3b8', // slate-400
  },
  latencia: {
    rapido: '#22c55e', // green-500
    medio:  '#facc15', // yellow-400
    lento:  '#ef4444', // red-500
  },
  conversao: {
    low:  '#92f2e9', // brand-200
    mid:  '#25c8bd', // brand-400
    high: '#0c7776', // brand-700
  },
} as const

// Versões soft (alpha) pra backgrounds de pílulas e badges
export const semanticColorsSoft = {
  temperatura: {
    quente: 'rgba(239,68,68,0.12)',
    morno:  'rgba(249,115,22,0.12)',
    frio:   'rgba(59,130,246,0.12)',
  },
  sentimento: {
    positivo: 'rgba(34,197,94,0.12)',
    neutro:   'rgba(148,163,184,0.12)',
    negativo: 'rgba(239,68,68,0.12)',
  },
  variacao: {
    up:   'rgba(74,222,128,0.15)',
    down: 'rgba(248,113,113,0.15)',
    flat: 'rgba(148,163,184,0.12)',
  },
} as const

/**
 * Normaliza strings diversas ('Quente', 'QUENTE', 'hot') em categorias válidas.
 * Retorna null se não reconhecer.
 */
export function normalizeTemperatura(v: string | null | undefined): Temperatura | null {
  if (!v) return null
  const s = v.toString().trim().toLowerCase()
  if (s === 'quente' || s === 'hot') return 'quente'
  if (s === 'morno' || s === 'warm') return 'morno'
  if (s === 'frio' || s === 'cold') return 'frio'
  return null
}

export function normalizeSentimento(v: string | null | undefined): Sentimento | null {
  if (!v) return null
  const s = v.toString().trim().toLowerCase()
  if (s === 'positivo' || s === 'positive') return 'positivo'
  if (s === 'negativo' || s === 'negative') return 'negativo'
  if (s === 'neutro' || s === 'neutral') return 'neutro'
  return null
}

/**
 * Decide cor de variação a partir de um delta numérico.
 * `threshold` padrão = 0.5% (considera "flat" deltas menores que isso).
 */
export function variacaoForDelta(delta: number, threshold = 0.5): Variacao {
  if (delta > threshold) return 'up'
  if (delta < -threshold) return 'down'
  return 'flat'
}

/**
 * Decide cor de latência a partir de ms/segundos.
 * Caller passa os breakpoints; útil pra "tempo até primeira resposta".
 */
export function latenciaForValue(value: number, opts: { fast: number; slow: number }): Latencia {
  if (value <= opts.fast) return 'rapido'
  if (value >= opts.slow) return 'lento'
  return 'medio'
}
