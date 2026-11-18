// ── Helpers compartilhados de notificações ──────────────────────────────────
// Regra: notificação "antiga" = criada há mais de 7 dias.
// Usado em NotificationBell (filtro do sino) e useNotifications (filtro de toasts).

import { subDays } from 'date-fns'
import type { Notificacao } from '../types'

/** Notificação é "antiga" se criada há mais de 7 dias. */
export function isOld(n: Notificacao): boolean {
  try {
    return new Date(n.criado_em) < subDays(new Date(), 7)
  } catch {
    return false
  }
}
