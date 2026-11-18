/**
 * KPI Tiers (Fase 2 brand).
 * Tier 1 = hero de conversao/intencao → sparkline verde + Outfit 800.
 * Tier 2 = operacional normal → Outfit 800 sem sombra.
 */
export const TIER_1_SLUGS: ReadonlySet<string> = new Set([
  'pct_leads_fechados',
  'pct_fechamento_alto',
  'pct_interesse_alto',
  'score_fechamento_alto',
  'leads_oportunidade_aberta',
])

export function isTier1(slug: string | undefined | null): boolean {
  return !!slug && TIER_1_SLUGS.has(slug)
}
