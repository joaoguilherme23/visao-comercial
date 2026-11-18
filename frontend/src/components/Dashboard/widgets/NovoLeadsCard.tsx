import { useMemo } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Users, ChevronRight } from 'lucide-react'
import type { LeadRecenteItem } from '../../../api/dashboard'
import OpenConversaIconButton from '../../ui/OpenConversaIconButton'
import { Pill } from '../../ds'
import type { Tone } from '../../ds'
import { TEMP_DOT } from '../constants'

// ── NovoLeadsCard — card da Visão Geral com lista de leads recentes clicáveis ──
export default function NovoLeadsCard({ leads, onClickLead }: {
  leads?: LeadRecenteItem[]
  onClickLead: (lead: LeadRecenteItem) => void
}) {
  const list = useMemo(() => {
    const seen = new Set<string>()
    const arr: LeadRecenteItem[] = []
    for (const l of leads ?? []) {
      if (seen.has(l.id)) continue
      seen.add(l.id)
      arr.push(l)
      if (arr.length >= 50) break // evita listas enormes
    }
    return arr
  }, [leads])

  const tempPill = (temp?: string | null) => {
    const t = (temp || '').toLowerCase()
    const tones: Record<string, { tone: Tone; label: string }> = {
      quente: { tone: 'temperatura:quente', label: 'Quente' },
      morno:  { tone: 'temperatura:morno',  label: 'Morno' },
      frio:   { tone: 'temperatura:frio',   label: 'Frio' },
    }
    const s = tones[t] || { tone: 'neutral' as Tone, label: 'Sem temp.' }
    return (
      <Pill tone={s.tone} size="xs" className="font-semibold">
        {s.label}
      </Pill>
    )
  }

  return (
    <div
      className="card-surface rounded-xl p-4 flex flex-col gap-2"
      style={{ borderTop: '2px solid #22c55e' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#22c55e20' }}>
          <Users size={16} style={{ color: '#22c55e' }} />
        </div>
        <div className="flex flex-col">
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>
            Novos Leads
          </p>
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>últimas entradas no período</span>
        </div>
      </div>

      {!list || list.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum lead ainda</p>
      ) : (
        <div className="space-y-0.5 max-h-80 overflow-y-auto pr-1">
          {/* header row */}
          <div
            className="grid grid-cols-12 text-xs font-semibold uppercase tracking-wide px-2 py-1.5 text-gray-500 sticky top-0 z-10"
            style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)' }}
          >
            <span className="col-span-4">Lead · Tempo</span>
            <span className="col-span-3">Intenção / Etapa</span>
            <span className="col-span-3 text-center">Temperatura · Score</span>
            <span className="col-span-2 text-right pr-2">Abrir</span>
          </div>
          {list.map(lead => {
            const tempColor = TEMP_DOT[lead.temperatura ?? ''] ?? '#6b7280'
            const tempLabel = lead.temperatura ? lead.temperatura.charAt(0).toUpperCase() + lead.temperatura.slice(1) : 'Sem temp.'
            const createdAt = lead.created_at ? new Date(lead.created_at) : null
            const criadoHa = createdAt
              ? formatDistanceToNow(createdAt, { locale: ptBR, addSuffix: true })
              : '—'
            const horario = createdAt ? format(createdAt, 'dd/MM HH:mm', { locale: ptBR }) : '—'
            const intencao = lead.intencao || 'Sem intenção'
            return (
              <div key={lead.id} className="relative group">
              <button
                onClick={() => onClickLead(lead)}
                className="w-full grid grid-cols-12 items-center gap-3 px-2 py-1.5 rounded-lg transition-colors text-left"
                style={{ background: 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Nome + tempo */}
                <div className="col-span-4 flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tempColor }} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>
                      {lead.nome || lead.whatsapp}
                    </span>
                    <span className="text-[11px] text-gray-500">{criadoHa}</span>
                  </div>
                </div>

                {/* Intenção + etapa */}
                <div className="col-span-3 flex items-center gap-2 flex-wrap text-[11px] text-gray-600">
                  <Pill tone="neutral" variant="ghost" size="xs" className="font-semibold">
                    {intencao}
                  </Pill>
                  {lead.etapa_funil && (
                    <Pill tone="neutral" variant="ghost" size="xs" className="font-semibold">
                      {lead.etapa_funil}
                    </Pill>
                  )}
                  <Pill tone="neutral" variant="ghost" size="xs" className="font-semibold">
                    {horario}
                  </Pill>
                </div>

                {/* Temperatura + score */}
                <div className="col-span-3 flex items-center gap-2 justify-center">
                  {tempPill(lead.temperatura)}
                  {lead.score != null && (
                    // @note: pill com cor dinâmica por threshold de score, não migrado pro DS
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: 'var(--bg-surface)',
                        color: lead.score >= 7 ? '#4ade80' : lead.score >= 4 ? '#fb923c' : '#f87171',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      Score {lead.score.toFixed(0)}
                    </span>
                  )}
                </div>

                {/* CTA */}
                <div className="col-span-2 flex justify-end">
                  <ChevronRight size={12} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                </div>
              </button>
              {/* Ícone "Abrir conversa" — flutua sobre o botão, hover-only */}
              <OpenConversaIconButton
                leadId={lead.id}
                nome={lead.nome}
                className="absolute top-1/2 right-1 -translate-y-1/2 z-10"
              />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
