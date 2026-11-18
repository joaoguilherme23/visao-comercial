// ── Constantes do DashboardPage ──────────────────────────────────────────────
// Extraídas mecanicamente de DashboardPage.tsx. Não unifica duplicatas
// (`TEMP_COLORS` e `TEMP_DOT` permanecem separadas propositalmente).
import {
  Users, Flame, Thermometer, Snowflake,
  CheckCircle2, XCircle, Target, Brain, Gauge,
  UserCheck, Ban, Star, Layers, GitBranch,
  TrendingUp, Smile, MessageSquare, ThumbsUp, ThumbsDown,
  Minus, CheckCircle, Clock, AlertTriangle, Zap,
  MessageCircle, ArrowDownLeft, ArrowUpRight, Mic,
  RefreshCw, Hash, Image as ImageIcon, X,
  CalendarCheck, MapPin, Map, UserCog,
  Moon, Sunrise, Sun, Sunset,
} from 'lucide-react'
import { semanticColors } from '../../lib/semanticColors'

// ── Icons ────────────────────────────────────────────────────────────────────
export const ICON_MAP: Record<string, React.ElementType> = {
  Users, Flame, Thermometer, Snowflake,
  CheckCircle2, XCircle, Target, Brain, Gauge,
  UserCheck, Ban, Star, Layers, GitBranch,
  TrendingUp, Smile, MessageSquare, ThumbsUp, ThumbsDown,
  Minus, CheckCircle, Clock, AlertTriangle, Zap,
  MessageCircle, ArrowDownLeft, ArrowUpRight, Mic,
  RefreshCw, Hash, Image: ImageIcon, X,
  CalendarCheck, MapPin, Map, UserCog,
  users: Users, flame: Flame, thermometer: Thermometer, snowflake: Snowflake,
  target: Target, brain: Brain, gauge: Gauge, smile: Smile, refreshcw: RefreshCw,
}

// ── Category labels ───────────────────────────────────────────────────────────
export const CATEGORY_LABELS: Record<string, string> = {
  leads:       'Leads',
  conversao:   'Conversão',
  analise:     'Análise',
  operacional: 'Operacional',
}

export const CATEGORY_COLORS: Record<string, string> = {
  leads:       '#3b82f6',
  conversao:   '#22c55e',
  analise:     '#0e7490',
  operacional: '#f97316',
}

// ── HorarioPanel — metadados por faixa do dia ────────────────────────────────
export const FAIXA_META: Record<string, { icon: React.ElementType; color: string }> = {
  madrugada: { icon: Moon,    color: '#0b9692' },
  manha:     { icon: Sunrise, color: '#f59e0b' },
  tarde:     { icon: Sun,     color: '#f97316' },
  noite:     { icon: Sunset,  color: '#3b82f6' },
}

// ── DiaSemanaPanel — abreviações ─────────────────────────────────────────────
export const DIA_SEMANA_ABBR: Record<string, string> = {
  'Segunda': 'Seg', 'Terça': 'Ter', 'Quarta': 'Qua',
  'Quinta': 'Qui', 'Sexta': 'Sex', 'Sábado': 'Sáb', 'Domingo': 'Dom',
}

// ── ScoreDrawer — alias pra quem lê por string direto (ex: `lead.temperatura`).
// A fonte de verdade é lib/semanticColors.temperatura.
export const TEMP_COLORS: Record<string, string> = {
  quente: semanticColors.temperatura.quente,
  morno:  semanticColors.temperatura.morno,
  frio:   semanticColors.temperatura.frio,
}

// ── NotificacoesActionCard — rótulos por prioridade ──────────────────────────
export const PRIORIDADE_LABEL: Record<number, string> = {
  1: 'Crítico',
  2: 'Alto',
  3: 'Médio',
}

// ── NovoLeadsCard — TEMP_DOT vem de lib/semanticColors (fonte única de verdade).
export const TEMP_DOT: Record<string, string> = {
  quente: semanticColors.temperatura.quente,
  morno:  semanticColors.temperatura.morno,
  frio:   semanticColors.temperatura.frio,
}

// ── Conversão Chart — slugs/cores de urgência e ordem do funil ───────────────
export const URGENCIA_SLUGS = new Set(['pct_alta_urgencia', 'pct_media_urgencia', 'pct_baixa_urgencia'])
export const URGENCIA_COLORS: Record<string, string> = {
  pct_alta_urgencia:  '#ef4444',
  pct_media_urgencia: '#f97316',
  pct_baixa_urgencia: '#3b82f6',
}
export const FUNNEL_ORDER  = ['pct_leads_identificados', 'pct_sentimento_positivo', 'pct_interesse_alto', 'pct_fechamento_alto', 'pct_leads_fechados']
export const FUNNEL_COLORS = ['#3b82f6', '#06b6d4', '#0e7490', '#f59e0b', '#22c55e']
