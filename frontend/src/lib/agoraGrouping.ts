import type { AgoraBoard, AgoraItem, AgoraMotivo } from '../api/agora'

/**
 * Fila "Agora" v2 — agrupamento temporal.
 *
 * Itens sao classificados em 5 faixas baseadas no timestamp de referencia
 * (ultima_entrada_em || followup_em) calculado em BRT (America/Sao_Paulo):
 *   today      — dia atual em BRT
 *   yesterday  — dia anterior em BRT
 *   thisWeek   — entre segunda da semana atual e anteontem (inclusive)
 *   thisMonth  — entre dia 1 do mes e segunda da semana
 *   older      — qualquer data anterior, ou sem referencia
 */

export type TimeBucket = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'older'

export interface TimeSection {
  key: TimeBucket
  label: string
  items: AgoraItem[]
}

/** Ordem fixa de renderizacao na UI. */
export const TIME_BUCKET_ORDER: TimeBucket[] = [
  'today',
  'yesterday',
  'thisWeek',
  'thisMonth',
  'older',
]

export const TIME_BUCKET_LABEL: Record<TimeBucket, string> = {
  today: 'HOJE',
  yesterday: 'ONTEM',
  thisWeek: 'ESSA SEMANA',
  thisMonth: 'ESSE MES',
  older: 'ANTERIORES',
}

/**
 * Formatador fixo em BRT. Emite 'YYYY-MM-DD' local (en-CA produz esse formato).
 * Usamos strings ordenaveis lexicograficamente para comparacao sem armadilhas
 * de fuso horario.
 */
const fmtBRT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Converte um ISO para dayKey BRT 'YYYY-MM-DD', ou null se invalido/ausente. */
export function dayKeyBRT(iso: string | null | undefined): string | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return null
    return fmtBRT.format(d)
  } catch {
    return null
  }
}

/** Retorna o dayKey BRT offset em dias a partir de `now`. */
function dayKeyOffset(now: Date, offsetDays: number): string {
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return fmtBRT.format(d)
}

/**
 * DayKey BRT da segunda-feira da semana atual.
 * Derivamos o weekday a partir do dayKey ja em BRT para evitar mismatches
 * com o fuso do browser.
 */
function startOfWeekBRT(now: Date): string {
  const todayBRTKey = fmtBRT.format(now)
  const [y, m, d] = todayBRTKey.split('-').map(Number)
  // Trabalhamos em UTC para ter getUTCDay coerente com os numeros que inserimos.
  const localBRTDate = new Date(Date.UTC(y, m - 1, d))
  const dow = localBRTDate.getUTCDay() // 0=dom, 1=seg, ... 6=sab
  const offset = dow === 0 ? -6 : -(dow - 1)
  localBRTDate.setUTCDate(localBRTDate.getUTCDate() + offset)
  const y2 = localBRTDate.getUTCFullYear()
  const m2 = String(localBRTDate.getUTCMonth() + 1).padStart(2, '0')
  const d2 = String(localBRTDate.getUTCDate()).padStart(2, '0')
  return `${y2}-${m2}-${d2}`
}

/** DayKey BRT do primeiro dia do mes corrente. */
function startOfMonthBRT(now: Date): string {
  const todayBRTKey = fmtBRT.format(now)
  const [y, m] = todayBRTKey.split('-')
  return `${y}-${m}-01`
}

/** Resolve a faixa temporal de um item a partir do timestamp de referencia. */
export function classifyItem(item: AgoraItem, now: Date): TimeBucket {
  const ref = item.ultima_entrada_em ?? item.followup_em
  const itemKey = dayKeyBRT(ref)
  if (!itemKey) return 'older'

  const todayKey = fmtBRT.format(now)
  const yesterdayKey = dayKeyOffset(now, -1)
  const weekStart = startOfWeekBRT(now)
  const monthStart = startOfMonthBRT(now)

  if (itemKey === todayKey) return 'today'
  if (itemKey === yesterdayKey) return 'yesterday'
  // "Essa semana" = dentro da semana atual mas anterior a ontem.
  if (itemKey >= weekStart && itemKey < yesterdayKey) return 'thisWeek'
  // "Esse mes" = dentro do mes atual mas anterior a semana corrente.
  if (itemKey >= monthStart && itemKey < weekStart) return 'thisMonth'
  return 'older'
}

/** Prioridade do motivo para tie-break estavel na ordenacao. */
const MOTIVO_PRIORITY: Record<AgoraMotivo, number> = {
  quente_sem_resposta: 0,
  followup_vencido: 1,
  esfriando: 2,
  sinal_ia: 3,
}

/** Timestamp de referencia em ms; itens sem referencia afundam para o final. */
function refTimestamp(item: AgoraItem): number {
  const ref = item.ultima_entrada_em ?? item.followup_em
  if (!ref) return -Infinity
  const t = new Date(ref).getTime()
  return isNaN(t) ? -Infinity : t
}

/**
 * Ordenacao dentro de uma secao:
 *   1) cronologico reverso (mais recente primeiro)
 *   2) urgencia_minutos desc (mais urgente primeiro)
 *   3) prioridade do motivo
 *   4) lead_id (determinismo)
 */
export function sortItemsInSection(items: AgoraItem[]): AgoraItem[] {
  return [...items].sort((a, b) => {
    const tDiff = refTimestamp(b) - refTimestamp(a)
    if (tDiff !== 0) return tDiff
    const uDiff = b.urgencia_minutos - a.urgencia_minutos
    if (uDiff !== 0) return uDiff
    const mDiff = MOTIVO_PRIORITY[a.motivo] - MOTIVO_PRIORITY[b.motivo]
    if (mDiff !== 0) return mDiff
    return a.lead_id.localeCompare(b.lead_id)
  })
}

/**
 * Agrupa os itens de todos os buckets do backend em secoes temporais.
 * Retorna sempre as 5 secoes, na ordem fixa — chamador filtra as vazias.
 */
export function groupByTimeBucket(
  board: AgoraBoard,
  now: Date = new Date(),
): TimeSection[] {
  const allItems = board.buckets.flatMap((b) => b.items)
  const grouped = new Map<TimeBucket, AgoraItem[]>()
  for (const item of allItems) {
    const bucket = classifyItem(item, now)
    const list = grouped.get(bucket) ?? []
    list.push(item)
    grouped.set(bucket, list)
  }
  return TIME_BUCKET_ORDER.map((key) => ({
    key,
    label: TIME_BUCKET_LABEL[key],
    items: sortItemsInSection(grouped.get(key) ?? []),
  }))
}
