// ── Tipos do DashboardPage ───────────────────────────────────────────────────
// Extraídos mecanicamente de DashboardPage.tsx.

// Filtro usado pelo LeadDrillDrawer e pelo estado `drill` da página.
// Passado como-is pra `getLeadsDrilldown` (api/dashboard).
export interface LeadDrillFilter {
  slug?: string
  temperatura?: string
  etapa?: string
  sigla?: string
  campo_filtro?: string
  valor_filtro?: string
  data_inicio?: string
  data_fim?: string
}
