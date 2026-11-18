/**
 * Paleta determinística de cores para identificar participantes em chats de
 * grupo. Estilo WhatsApp: cada número (ou nome, como fallback) mapeia sempre
 * para a mesma cor via hash.
 *
 * Cores selecionadas para:
 *   - Contraste aceitável sobre background escuro (var(--bg-card)).
 *   - Legibilidade mantida em tema claro (tons médios, nada muito pálido).
 *   - Sem conflito com cores semânticas do X9 (temperatura/sentimento) —
 *     evitamos red-500/green-500/orange-500 puros pra não soar como "quente"
 *     ou "positivo".
 */

/** Paleta fixa — 12 tons distintos, ordenados pra maximizar contraste visual. */
export const PARTICIPANT_PALETTE: readonly string[] = [
  '#60a5fa', // blue-400
  '#c084fc', // purple-400
  '#f472b6', // pink-400
  '#2dd4bf', // teal-400
  '#facc15', // yellow-400
  '#a78bfa', // violet-400
  '#38bdf8', // sky-400
  '#fb923c', // orange-400
  '#4ade80', // green-400
  '#e879f9', // fuchsia-400
  '#fbbf24', // amber-400
  '#22d3ee', // cyan-400
] as const

/**
 * Hash djb2 — 33 * h + char. Rápido, estável, bem distribuído para strings
 * curtas (nomes, números). Retorna inteiro não-negativo.
 */
function hashString(input: string): number {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    // eslint-disable-next-line no-bitwise
    hash = ((hash << 5) + hash) + input.charCodeAt(i)
    // eslint-disable-next-line no-bitwise
    hash |= 0 // força para int32
  }
  return Math.abs(hash)
}

/**
 * Retorna a cor do participante a partir de um identificador estável.
 *
 * Preferência: `participant_number` (sempre presente no backend); cai pra
 * `participant_name` quando número estiver vazio. Se ambos forem vazios,
 * retorna um cinza neutro (não deveria acontecer — backend exige ao menos um).
 */
export function getParticipantColor(
  identifier: string | null | undefined,
  fallback?: string | null,
): string {
  const key = (identifier ?? fallback ?? '').trim()
  if (!key) return '#94a3b8' // slate-400 neutro
  const idx = hashString(key) % PARTICIPANT_PALETTE.length
  return PARTICIPANT_PALETTE[idx]
}
