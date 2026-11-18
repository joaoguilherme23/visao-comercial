import { useState } from 'react'
import { TrendingDown } from 'lucide-react'
import { LeadScoreItem } from '../../../api/dashboard'
import { TEMP_COLORS } from '../constants'
import LeadAvatar from '../../ui/LeadAvatar'
import ChannelIcon from '../../ui/ChannelIcon'
import OpenConversaIconButton from '../../ui/OpenConversaIconButton'
import MensagensLead from './MensagensLead'

export default function LeadRow({
  lead,
  clienteId,
  onClickLead,
}: {
  lead: LeadScoreItem
  clienteId: string
  onClickLead?: (lead: LeadScoreItem) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const tempColor = TEMP_COLORS[lead.temperatura ?? ''] ?? '#6b7280'
  const scoreVal = lead.score ?? 0

  return (
    <div className="group relative rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
        onClick={() => onClickLead ? onClickLead(lead) : setExpanded(v => !v)}
      >
        {/* Avatar colorido pela temperatura + score flutuante no canto */}
        <div className="relative shrink-0">
          <LeadAvatar
            name={lead.nome}
            fallback={lead.whatsapp}
            temperatura={lead.temperatura}
            size={36}
          />
          <span
            className="absolute -bottom-1 -right-1 rounded-full text-[9px] font-bold flex items-center justify-center font-mono-data"
            style={{
              width: 18, height: 18,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: '#eab308',
            }}
            title="Score"
          >
            {scoreVal.toFixed(0)}
          </span>
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {lead.nome ?? lead.whatsapp}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <ChannelIcon channel="whatsapp" size={10} />
            <span className="text-[10px] text-gray-500 font-mono-data truncate">{lead.whatsapp}</span>
            {lead.etapa_funil && (
              <span className="text-[10px] text-gray-500">· {lead.etapa_funil}</span>
            )}
            {lead.temperatura && (
              <span className="text-[10px] font-medium capitalize" style={{ color: tempColor }}>
                ● {lead.temperatura}
              </span>
            )}
          </div>
        </div>
        {/* Expand icon — desloca pra dar espaço ao botão de conversa */}
        <div className="shrink-0 text-gray-600 transition-transform mr-9" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}>
          <TrendingDown size={14} />
        </div>
      </button>
      {/* Deep link "Abrir conversa" — fora do <button> pra manter HTML válido */}
      <OpenConversaIconButton
        leadId={lead.id}
        nome={lead.nome}
        className="absolute top-1/2 right-3 -translate-y-1/2 z-10"
      />
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <MensagensLead clienteId={clienteId} leadId={lead.id} />
        </div>
      )}
    </div>
  )
}
