import api from './client'

// ---------------------------------------------------------------------------
// Tipos — espelham os schemas Pydantic do backend (backend/app/schemas/grupos.py).
// ---------------------------------------------------------------------------

/** Item da listagem de grupos do tenant. */
export interface GrupoListItem {
  id: string
  cliente_id: string
  whatsapp: string
  nome?: string | null
  temperatura?: string | null
  /** Foto sincronizada do WhatsApp (path relativo do backend). */
  foto_url?: string | null
  ultima_interacao?: string | null
  created_at?: string | null
  update_at?: string | null
  total_mensagens: number
  total_participantes: number
}

/**
 * Mensagem de grupo — bots (X9/AIA) já vêm filtrados pelo backend.
 * `direcao` hoje é string ('entrada' | 'saida'), mas mantemos flexível.
 */
export interface GrupoMensagem {
  id: string
  grupo_id: string
  cliente_id: string
  conteudo?: string | null
  participant_number?: string | null
  participant_name?: string | null
  direcao: string
  tipo: string
  provider_msg_id?: string | null
  enviada_em: string
}

/** Página de mensagens de um grupo. */
export interface GrupoMensagensPage {
  total: number
  limit: number
  offset: number
  items: GrupoMensagem[]
}

/** Participante agregado — totais/timestamps derivam das mensagens. */
export interface GrupoParticipante {
  participant_number: string
  participant_name?: string | null
  total_mensagens: number
  primeira_msg_em?: string | null
  ultima_msg_em?: string | null
}

/** Resposta do endpoint de participantes. */
export interface GrupoParticipantes {
  grupo_id: string
  total: number
  items: GrupoParticipante[]
}

// ---------------------------------------------------------------------------
// API client — 3 métodos que espelham os 3 endpoints do router de grupos.
// ---------------------------------------------------------------------------

export const gruposApi = {
  /** Lista todos os grupos do tenant (ordenação já vem do backend). */
  listGrupos: (clienteId: string): Promise<GrupoListItem[]> =>
    api.get<GrupoListItem[]>(`/grupos/${clienteId}`).then((r) => r.data),

  /** Mensagens paginadas de um grupo (bots já filtrados). */
  listMensagens: (
    clienteId: string,
    grupoId: string,
    params?: { limit?: number; offset?: number },
  ): Promise<GrupoMensagensPage> =>
    api
      .get<GrupoMensagensPage>(`/grupos/${clienteId}/${grupoId}/mensagens`, { params })
      .then((r) => r.data),

  /** Participantes agregados do grupo (bots já filtrados). */
  listParticipantes: (
    clienteId: string,
    grupoId: string,
  ): Promise<GrupoParticipantes> =>
    api
      .get<GrupoParticipantes>(`/grupos/${clienteId}/${grupoId}/participantes`)
      .then((r) => r.data),
}
