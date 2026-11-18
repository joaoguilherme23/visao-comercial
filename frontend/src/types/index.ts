export type UserRole = 'admin' | 'manager' | 'viewer'

// ---------------------------------------------------------------------------
// Notificações
// ---------------------------------------------------------------------------

export type NotificacaoTipo =
  | 'lead_quente_sem_resposta'
  | 'potencial_fechamento'
  | 'lead_novo'
  | 'followup_vencido'
  | 'sem_resposta_24h'

export interface Notificacao {
  id: string               // 24-char sha1 slug estável entre polls
  tipo: NotificacaoTipo
  titulo: string
  descricao: string
  lead_id: string
  lead_nome?: string
  lead_whatsapp: string
  prioridade: number       // 1 | 2 | 3
  icone: string
  cor_hex: string
  criado_em: string        // ISO datetime
  gerado_em: string
}

export interface User {
  id: string
  email: string
  nome: string
  is_active?: boolean
  is_superadmin: boolean
  /**
   * "Gestor multi-empresa" — flag ortogonal ao superadmin.
   * Habilita acesso a /portfolio (visão agregada das N empresas
   * que ele tem acesso via UserTenant). Não permite criar empresa.
   */
  is_manager_multi: boolean
  /**
   * Forçar troca de senha no próximo login. Setado automaticamente quando
   * cliente cria um consultor com senha provisória. Frontend redireciona
   * pra /change-password antes de qualquer rota protegida enquanto true.
   */
  must_change_password: boolean
  avatar_url?: string
}

/** Item do array `contatos` do Tenant. */
export interface ContatoEmpresa {
  tipo: 'comercial' | 'financeiro' | 'suporte' | 'outro'
  telefone?: string | null
  email?: string | null
}

export interface Tenant {
  id: string
  nome: string
  slug: string
  nicho?: string
  plano?: string
  timezone: string
  nome_agente?: string
  ativo: boolean
  /**
   * Limite diário de gasto LLM em R$. NULL = sem limite.
   * Usado pra alerta visual em /admin/llm-logs (não bloqueia chamadas).
   */
  budget_brl_diario?: number | null
  // ── Dados cadastrais (migration 0013) ──────────────────────────────────
  cnpj?: string | null
  razao_social?: string | null
  endereco_cep?: string | null
  endereco_logradouro?: string | null
  endereco_numero?: string | null
  endereco_complemento?: string | null
  endereco_bairro?: string | null
  endereco_cidade?: string | null
  endereco_uf?: string | null
  contatos?: ContatoEmpresa[]
  responsavel_nome?: string | null
  responsavel_cargo?: string | null
  responsavel_email?: string | null
  responsavel_telefone?: string | null
  /** Logo da empresa — path relativo (ex: /avatars/tenants/<id>/<ts>.jpg). */
  foto_url?: string | null
  created_at: string
  updated_at: string
  config?: Record<string, unknown>
}

export interface TenantConnection {
  id: string
  cliente_id: string
  tipo: string
  nome: string
  config: Record<string, unknown>
  ativo: boolean
  status: string
  ultimo_ping?: string
  created_at: string
}

export interface AnaliseCard {
  id: string
  resumo_curto?: string
  sentimento?: string
  score_interesse?: number
  intencao?: string
  proximo_passo?: string
  created_at: string
}

export interface KpiCard {
  veiculo_interesse?: string
  marca?: string
  modelo?: string
  urgencia?: string
  score_fechamento?: number
  proximo_contato?: string
  dados?: Record<string, unknown>
}

export interface KanbanCard {
  id: string
  whatsapp: string
  nome?: string
  temperatura?: string
  score?: number
  etapa_funil?: string
  bloqueado: boolean
  /** Foto sincronizada do WhatsApp (path relativo do backend). */
  foto_url?: string | null
  created_at: string
  updated_at: string
  nicho?: string
  ultima_analise?: AnaliseCard
  kpi?: KpiCard
  kpi_generico?: Record<string, unknown>
}

export interface KanbanColumn {
  etapa: string
  total: number
  cards: KanbanCard[]
}

export interface KanbanBoard {
  columns: KanbanColumn[]
  total_leads: number
}

export interface KanbanStats {
  total_leads: number
  quentes: number
  mornos: number
  frios: number
  fechados: number
  perdidos: number
}

export interface AnaliseDetalhe {
  resumo_completo?: string
  observacoes?: unknown
  objecoes?: unknown
  duvidas?: unknown
  memoria?: unknown
}

export interface AnaliseLeadExtra {
  genero?: string
  oportunidade_aberta?: boolean
  motivo_nao_fechamento?: string
  motivo_desistencia?: string
  melhoria_atendimento?: string
  melhoria_negociacao?: string
  frases_ditas_lead?: string[]
  frases_chave_negativas?: string[]
}

export interface AnaliseFull {
  id: string
  lead_id: string
  data_ref?: string
  versao: number
  resumo_curto?: string
  sentimento?: string
  score_interesse?: number
  intencao?: string
  proximo_passo?: string
  modelo_ia?: string
  tokens_consumidos?: number
  total_msgs?: number
  created_at: string
  detalhe?: AnaliseDetalhe
  kpi?: KpiCard
  lead_extra?: AnaliseLeadExtra
}

export interface TenantUser {
  id: string
  user_id: string
  email: string
  nome: string
  role: UserRole
  is_active: boolean
}

export interface Mensagem {
  id: string
  lead_id: string
  direcao: 'entrada' | 'saida'
  tipo: 'text' | 'texto' | 'audio' | 'imagem' | 'video' | 'documento'
  conteudo?: string
  midia_url?: string
  enviada_em: string
  enviado_por?: 'Studio' | 'IA' | 'Cliente' | string | null
}

export interface ConversaPreview {
  lead_id: string
  whatsapp: string
  nome?: string
  ultima_mensagem?: string
  tipo_ultima?: 'text' | 'texto' | 'audio' | 'imagem' | 'video' | 'documento'
  direcao_ultima?: 'entrada' | 'saida'
  enviada_em?: string
  // Usados pra renderizar avatar colorido por temperatura + badge de score na lista
  temperatura?: string | null
  score?: number | null
  /** Foto sincronizada do WhatsApp (path relativo do backend). */
  foto_url?: string | null
}

/** Resposta paginada de /kanban/{id}/conversations. */
export interface ConversasListResponse {
  items: ConversaPreview[]
  total: number
  has_more: boolean
  next_offset: number | null
}

export interface NumeroBot {
  id: string
  cliente_id: string
  numero: string
  nome: string | null
  ativo: boolean
  provider_instance_id: string | null
  sync_enabled: boolean
  analysis_enabled: boolean
  sync_state: string | null
  last_message_at: string | null
  last_analysis_at: string | null
  connection_generation: string
  created_at: string
  updated_at: string
}

export interface UazapiStatus {
  status: 'connected' | 'connecting' | 'disconnected'
  qr_code?: string | null
  pairing_code?: string | null
  phone?: string | null
  phone_matches_registered?: boolean | null
  sync_enabled?: boolean
  sync_state?: string | null
}

// ---------------------------------------------------------------------------
// Feed (página /feed) — lista vertical de leads ordenados por urgência
// ---------------------------------------------------------------------------

export interface FeedCard {
  id: string
  whatsapp: string
  nome?: string | null
  temperatura?: string | null
  score?: number | null
  etapa_funil?: string | null
  bloqueado: boolean
  foto_url?: string | null
  created_at: string
  updated_at: string
  nicho?: string | null
  ultima_analise?: AnaliseCard
  kpi?: KpiCard
  kpi_generico?: Record<string, unknown>
  acao_requerida: boolean
  urgencia_score: number
  comentarios_count: number
}

/** Presets aceitos pelo POST /feed/.../snooze (precisa bater com SNOOZE_PRESETS_HOURS no backend). */
export type SnoozePreset = '1h' | '3h' | '6h' | '1d' | '3d'

export interface FeedListResponse {
  items: FeedCard[]
  total: number
  has_more: boolean
  next_offset: number | null
}

export interface ComentarioLead {
  id: string
  lead_id: string
  user_id: string
  autor_nome: string
  texto: string
  created_at: string
}
