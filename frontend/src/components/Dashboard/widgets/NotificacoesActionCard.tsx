import { useState } from 'react'
import { Bell } from 'lucide-react'
import { Notificacao } from '../../../types'
import { PRIORIDADE_LABEL } from '../constants'
import { brandColor } from '../../../lib/brandColor'

// ── NotificacoesActionCard — card de ações sugeridas acima dos Novos Leads ────
export default function NotificacoesActionCard({
  notifications,
  isRead,
  isDismissed,
  onClickNotif,
}: {
  notifications: Notificacao[]
  isRead: (id: string) => boolean
  isDismissed: (id: string) => boolean
  onClickNotif: (n: Notificacao) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = notifications.filter((n) => !isDismissed(n.id))
  if (visible.length === 0) return null

  const COLLAPSED_LIMIT = 6
  const shown = expanded ? visible : visible.slice(0, COLLAPSED_LIMIT)
  const overflow = visible.length - COLLAPSED_LIMIT

  return (
    <div
      className="card-surface rounded-xl p-4"
      style={{ borderTop: '2px solid var(--brand-500)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(11,150,146,0.15)' }}
          >
            <Bell size={16} style={{ color: '#25c8bd' }} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>
              Ações Sugeridas
            </p>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>
              {visible.length} alerta{visible.length !== 1 ? 's' : ''} requer{visible.length === 1 ? '' : 'em'} atenção
            </span>
          </div>
        </div>
        {overflow > 0 && (
          // @note: pill-botão interativa indigo (não semântica), não migrado pro DS
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all hover:-translate-y-0.5"
            style={{
              background: 'rgba(11,150,146,0.15)',
              color: '#25c8bd',
              border: '1px solid rgba(11,150,146,0.3)',
            }}
          >
            {expanded ? 'Mostrar menos' : `+${overflow} mais`}
          </button>
        )}
      </div>

      {/* Action chips */}
      <div className="flex flex-wrap gap-2">
        {shown.map((n) => {
          const read = isRead(n.id)
          const color = brandColor(n.cor_hex)
          return (
            <button
              key={n.id}
              onClick={() => onClickNotif(n)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm transition-all hover:-translate-y-0.5"
              style={{
                background: read ? 'var(--bg-elevated)' : `${color}12`,
                border: `1px solid ${read ? 'var(--border)' : color + '40'}`,
                color: 'var(--text-1)',
              }}
            >
              <span className="text-lg select-none">{n.icone}</span>
              <div className="text-left">
                <p className="text-xs font-semibold leading-tight" style={{ color }}>
                  {n.titulo}
                </p>
                <p className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {n.lead_nome || n.lead_whatsapp}
                </p>
              </div>
              {!read && (
                // @note: pill com cor dinâmica (n.cor_hex) vinda do backend, não migrado pro DS
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: color + '25', color }}
                >
                  {PRIORIDADE_LABEL[n.prioridade] ?? 'Alerta'}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
