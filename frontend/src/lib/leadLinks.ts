/**
 * Helpers puros pra montar as URLs de deep-linking de um lead.
 *
 * Contrato do sistema:
 *   - `/conversas?leadId=<uuid>`        → abre a conversa direto (opcional &highlight=1)
 *   - `/kanban?leadId=<uuid>`           → abre o modal do lead no Kanban (opcional &highlight=1)
 *   - `/dashboard`                      → home do dashboard (sem params)
 *
 * Validação: leadId precisa ser string não-vazia. Se vier vazio/undefined,
 * retornamos a rota base — garante que <Link> nunca quebra e mantém UX previsível.
 */

interface LinkOptions {
  /** Adiciona `?highlight=1` na URL — gatilho pro ring-pulse nas telas de destino. */
  highlight?: boolean
}

function appendParams(base: string, leadId: string, opts?: LinkOptions): string {
  const params = new URLSearchParams()
  params.set('leadId', leadId)
  if (opts?.highlight) params.set('highlight', '1')
  return `${base}?${params.toString()}`
}

export function linkToConversa(leadId: string, opts?: LinkOptions): string {
  if (!leadId || typeof leadId !== 'string' || leadId.trim() === '') {
    return '/conversas'
  }
  return appendParams('/conversas', leadId, opts)
}

export function linkToKanban(leadId: string, opts?: LinkOptions): string {
  if (!leadId || typeof leadId !== 'string' || leadId.trim() === '') {
    return '/kanban'
  }
  return appendParams('/kanban', leadId, opts)
}

export function linkToDashboard(): string {
  return '/dashboard'
}
