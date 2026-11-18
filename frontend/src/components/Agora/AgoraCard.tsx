import { Link } from 'react-router-dom'
import { Flame, Clock, Snowflake, Lightbulb, MessageSquare, Kanban as KanbanIcon } from 'lucide-react'
import type { AgoraItem, AgoraMotivo, SinalIaTipo } from '../../api/agora'
import LeadAvatar from '../ui/LeadAvatar'
import { linkToConversa, linkToKanban } from '../../lib/leadLinks'
import { normalizeTemperatura } from '../../lib/semanticColors'
import { Pill } from '../ds'
import type { Tone } from '../ds'

/**
 * Cor principal por motivo — usada na borda lateral, icone e urgencia.
 * sinal_ia usa signal-success (#10E088) conforme brand Fase 2 Tier 1.
 */
const MOTIVO_COLOR: Record<AgoraMotivo, string> = {
  quente_sem_resposta: '#ef4444', // red-500
  followup_vencido: '#f59e0b', // amber-500
  esfriando: '#f97316', // orange-500
  sinal_ia: '#10E088', // signal-success-500 (brand Fase 2 Tier 1)
}

/** Label curto do motivo, exibido em bold como prefixo da linha de urgencia. */
const MOTIVO_LABEL_CURTO: Record<AgoraMotivo, string> = {
  quente_sem_resposta: 'Quente',
  followup_vencido: 'Follow-up',
  esfriando: 'Esfriando',
  sinal_ia: 'Sinal IA',
}

/** Ícone da urgência por motivo. */
function UrgencyIcon({ motivo }: { motivo: AgoraMotivo }) {
  const color = MOTIVO_COLOR[motivo]
  const props = { size: 12, style: { color }, 'aria-hidden': true as const }
  switch (motivo) {
    case 'quente_sem_resposta':
      return <Flame {...props} />
    case 'followup_vencido':
      return <Clock {...props} />
    case 'esfriando':
      return <Snowflake {...props} />
    case 'sinal_ia':
      return <Lightbulb {...props} />
  }
}

/** Label amigável pro sinal_ia_tipo. */
function labelSinalIa(tipo: SinalIaTipo | null): string | null {
  switch (tipo) {
    case 'preco':
      return '💰 perguntou preço'
    case 'prazo':
      return '⏱ perguntou prazo'
    case 'condicoes':
      return '📋 perguntou condições'
    case 'duvida_aberta':
      return '❓ dúvida em aberto'
    default:
      return null
  }
}

interface AgoraCardProps {
  item: AgoraItem
}

/**
 * Card de item da fila "Agora" — peça central da UX.
 * Layout horizontal: avatar (40) · bloco info (nome, pílulas, urgência, contexto) · ações.
 * Mobile: remove o botão Kanban (só aparece em ≥ sm).
 *
 * `data-lead-id` é essencial pro useHighlightRing funcionar quando o usuário
 * volta pra /agora via deep link (?leadId=X&highlight=1).
 */
export function AgoraCard({ item }: AgoraCardProps) {
  const motivoColor = MOTIVO_COLOR[item.motivo]
  const motivoPrefix = MOTIVO_LABEL_CURTO[item.motivo]
  const tempKey = normalizeTemperatura(item.temperatura)
  const tempTone: Tone | null = tempKey ? `temperatura:${tempKey}` : null
  const hasGoldenScore = item.score != null && item.score >= 7
  const sinalIaLabel = labelSinalIa(item.sinal_ia_tipo)
  // Para sinal_ia com tipo conhecido, o complemento eh o sinal detectado;
  // caso contrario eh a propria urgencia_label do backend.
  const urgenciaComplement =
    item.motivo === 'sinal_ia' && sinalIaLabel ? sinalIaLabel : item.urgencia_label

  // Sinal IA recebe borda success (Tier 1 do brand — momento de marca)
  const isSinalIa = item.motivo === 'sinal_ia'

  return (
    <div
      data-lead-id={item.lead_id}
      className={`agora-card ${isSinalIa ? 'agora-card--signal' : ''} rounded-xl p-4 flex items-center gap-4 transition-all`}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${isSinalIa ? 'rgba(16,224,136,0.35)' : 'var(--border-subtle)'}`,
        borderLeft: `4px solid ${motivoColor}`,
        borderRadius: '12px',
      }}
    >
      <style>{`
        .agora-card:hover {
          border-color: var(--brand-500);
        }
        .agora-card--signal:hover {
          border-color: rgba(16,224,136,0.55);
        }
      `}</style>

      {/* Avatar com anel por temperatura */}
      <div className="shrink-0">
        <LeadAvatar
          name={item.nome}
          fallback={item.whatsapp}
          temperatura={item.temperatura}
          size={40}
        />
      </div>

      {/* Coluna central — info */}
      <div className="flex-1 min-w-0">
        {/* Linha 1: nome + pílulas */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-semibold truncate"
            style={{ color: 'var(--text-1)', maxWidth: '100%' }}
          >
            {item.nome || item.whatsapp}
          </span>

          {/* Pílula temperatura */}
          {tempTone && (
            <Pill tone={tempTone} size="xs" dot className="capitalize">
              {item.temperatura}
            </Pill>
          )}

          {/* Pílula etapa (ghost) */}
          {item.etapa_funil && (
            <Pill tone="neutral" variant="ghost" size="xs">
              {item.etapa_funil}
            </Pill>
          )}

          {/* Badge dourado de score ≥ 7 */}
          {hasGoldenScore && (
            <Pill
              tone="status:pending"
              size="xs"
              mono
              className="font-bold"
              title={`Score ${item.score!.toFixed(1)}`}
            >
              ★ {item.score!.toFixed(1)}
            </Pill>
          )}
        </div>

        {/* Linha 2: prefixo do motivo (bold) + complemento (urgencia ou sinal) */}
        <div
          className="flex items-center gap-1.5 mt-1 text-xs font-mono-data min-w-0"
          style={{ color: motivoColor }}
        >
          <UrgencyIcon motivo={item.motivo} />
          <span className="truncate">
            <span style={{ fontWeight: 600 }}>{motivoPrefix}</span>
            <span style={{ opacity: 0.5, margin: '0 0.4em' }}>·</span>
            <span style={{ fontWeight: 400 }}>{urgenciaComplement}</span>
          </span>
        </div>

        {/* Linha 3: contexto truncado em itálico */}
        {item.contexto_curto && (
          <p
            className="mt-1 text-[13px] italic truncate"
            style={{ color: 'var(--text-3)' }}
            title={item.contexto_curto}
          >
            "{item.contexto_curto}"
          </p>
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Primária: Visualizar conversa (sempre visível) */}
        <Link
          to={linkToConversa(item.lead_id, { highlight: true })}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: 'rgba(11,150,146,0.15)',
            border: '1px solid rgba(11,150,146,0.35)',
            color: '#25c8bd',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(11,150,146,0.25)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(11,150,146,0.15)'
          }}
          title="Abrir conversa"
        >
          <MessageSquare size={14} />
          <span>Visualizar conversa</span>
        </Link>

        {/* Secundária: Kanban — só desktop */}
        <Link
          to={linkToKanban(item.lead_id, { highlight: true })}
          className="hidden sm:inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
          style={{
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-3)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-elevated)'
            e.currentTarget.style.color = 'var(--text-1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-3)'
          }}
          title="Ver no Kanban"
          aria-label="Abrir no Kanban"
        >
          <KanbanIcon size={14} />
        </Link>
      </div>
    </div>
  )
}
