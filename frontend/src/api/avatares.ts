import api from './client'

export type EntidadeTipo = 'leads' | 'grupos'

export interface SyncBatchPayload {
  ids: string[]
  force?: boolean
}

export interface SyncPendingPayload {
  limit?: number
}

export interface SyncResultItem {
  id: string
  status: 'ok' | 'skipped' | 'no_avatar' | 'failed'
  url?: string | null
  reason?: string | null
}

export interface SyncResponse {
  summary: {
    total: number
    ok: number
    skipped: number
    no_avatar: number
    failed: number
  }
  results: SyncResultItem[]
}

export const avataresApi = {
  /** Sync de IDs específicos (até 30). */
  syncBatch: (clienteId: string, tipo: EntidadeTipo, payload: SyncBatchPayload) =>
    api
      .post<SyncResponse>(`/avatares/${clienteId}/${tipo}/sync`, payload)
      .then((r) => r.data),

  /** Pega os primeiros N sem foto e sincroniza. Ideal pro botão "Sincronizar fotos". */
  syncPendentes: (clienteId: string, tipo: EntidadeTipo, limit = 30) =>
    api
      .post<SyncResponse>(`/avatares/${clienteId}/${tipo}/sync-pendentes`, { limit })
      .then((r) => r.data),
}
