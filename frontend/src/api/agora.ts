import api from './client'

/**
 * Bucket "motivo" — sempre 4, na ordem:
 *   quente_sem_resposta → followup_vencido → esfriando → sinal_ia
 * O backend ecoa a ordem; a UI só filtra os que tiverem items > 0.
 */
export type AgoraMotivo =
  | 'quente_sem_resposta'
  | 'followup_vencido'
  | 'esfriando'
  | 'sinal_ia'

/** Tipo do sinal detectado pela IA — dispara cor/ícone próprios no card. */
export type SinalIaTipo = 'preco' | 'prazo' | 'condicoes' | 'duvida_aberta'

export interface AgoraItem {
  lead_id: string
  nome: string | null
  whatsapp: string
  /** 'quente' | 'morno' | 'frio' | null — vem direto do backend, sem normalizar. */
  temperatura: string | null
  /** 0..10 */
  score: number | null
  etapa_funil: string | null
  motivo: AgoraMotivo
  sinal_ia_tipo: SinalIaTipo | null
  /** Ex.: "3h 22min sem resposta" — pronto pra renderizar. */
  urgencia_label: string
  urgencia_minutos: number
  /** Última msg truncada ~120 chars; null quando não há contexto. */
  contexto_curto: string | null
  ultima_entrada_em: string | null
  /** Só preenchido em `followup_vencido`. */
  followup_em: string | null
  bloqueado: boolean
  ativo: boolean
}

export interface AgoraBucket {
  motivo: AgoraMotivo
  total: number
  items: AgoraItem[]
}

export interface AgoraBoard {
  cliente_id: string
  gerado_em: string
  horas_quente_aplicado: number
  total_geral: number
  /** Sempre 4 buckets na ordem fixa. Caller filtra os vazios ao renderizar. */
  buckets: AgoraBucket[]
}

export interface AgoraParams {
  horas_quente?: number
  limit_por_bucket?: number
}

export const agoraApi = {
  /**
   * Busca a fila "Agora" do tenant.
   * Endpoint: GET /api/v1/agora/{cliente_id}
   */
  getBoard: (clienteId: string, params?: AgoraParams) =>
    api.get<AgoraBoard>(`/agora/${clienteId}`, { params }).then((r) => r.data),
}
