import { brandColor } from '../../lib/brandColor'
import { useMemo, useState } from 'react'
import { Bell, BellRing, Check, History, ChevronUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useNotificationStore } from '../../store/notificationStore'
import { Notificacao } from '../../types'
import { linkToConversa } from '../../lib/leadLinks'
import { isOld } from '../../lib/notifications'
import { Pill, EmptyState, Popover } from '../ds'

function relativeTime(isoString: string): string {
  try {
    return formatDistanceToNow(new Date(isoString), { addSuffix: true, locale: ptBR })
  } catch {
    return ''
  }
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [showOld, setShowOld] = useState(false)
  const navigate = useNavigate()

  const {
    notifications,
    unreadCount: unreadCountRaw,
    markRead,
    markAllRead,
    isRead,
    isDismissed,
    setPendingLead,
  } = useNotificationStore()

  // Lista base (sem dispensadas)
  const allVisible = useMemo(
    () => notifications.filter((n) => !isDismissed(n.id)),
    [notifications, isDismissed],
  )

  // Separa em recentes (<=7d) e antigas (>7d)
  const recentes = useMemo(() => allVisible.filter((n) => !isOld(n)), [allVisible])
  const antigas = useMemo(() => allVisible.filter((n) => isOld(n)), [allVisible])

  // Lista efetiva — depende do toggle
  const visible = showOld ? allVisible : recentes

  // Badge no sino conta APENAS não-lidas dos últimos 7d (antigas viram ruído)
  const unreadCount = useMemo(
    () => recentes.filter((n) => !isRead(n.id)).length,
    [recentes, isRead],
  )
  // Mantém referência ao count total pra debug, mas frontend só mostra o "recente"
  void unreadCountRaw

  /**
   * Resolve o destino da notificação. Os 5 tipos atuais
   * (`lead_novo`, `lead_quente_sem_resposta`, `potencial_fechamento`,
   * `followup_vencido`, `sem_resposta_24h`) são todos sobre mensagens do lead
   * → direcionam para `/conversas?leadId=X&highlight=1`. Tipos "dashboard" /
   * "revisar" são fallback pro fluxo antigo (modal no Dashboard).
   */
  function resolveTarget(n: Notificacao): 'conversa' | 'dashboard' {
    const tipo = String(n.tipo ?? '').toLowerCase()
    if (tipo.includes('dashboard') || tipo.includes('revisar')) return 'dashboard'
    return 'conversa'
  }

  const handleClick = (n: Notificacao) => {
    markRead(n.id)
    setOpen(false)
    // `setPendingLead` continua — mantém compatibilidade com o modal antigo do
    // Dashboard caso o tipo caia no fallback.
    setPendingLead({ id: n.lead_id, nome: n.lead_nome, whatsapp: n.lead_whatsapp })

    const target = resolveTarget(n)
    if (target === 'conversa') {
      navigate(linkToConversa(n.lead_id, { highlight: true }))
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      side="bottom"
      align="end"
      width={320}
      aria-label="Notificações"
      trigger={
        <button
          className="relative p-2 rounded-lg transition-colors"
          style={{
            color: unreadCount > 0 ? '#25c8bd' : 'var(--text-3)',
            background: open ? 'var(--bg-elevated)' : 'transparent',
          }}
          aria-label={`Notificações${unreadCount > 0 ? ` — ${unreadCount} não lidas` : ''}`}
        >
          {unreadCount > 0 ? <BellRing size={18} /> : <Bell size={18} />}
          {unreadCount > 0 && (
            <Pill
              tone="status:danger"
              variant="solid"
              size="xs"
              mono
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 justify-center px-1 leading-none animate-pulse-soft"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Pill>
          )}
        </button>
      }
    >
      <div className="flex flex-col overflow-hidden rounded-xl" style={{ maxHeight: '440px' }}>
        {/* Cabeçalho */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <span className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
            Notificações
            {unreadCount > 0 && (
              <Pill tone="status:danger" size="xs">
                {unreadCount}
              </Pill>
            )}
          </span>
          {visible.length > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs flex items-center gap-1 transition-colors"
              style={{ color: 'var(--text-3)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-1)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-3)')}
            >
              <Check size={11} />
              Marcar todas como lidas
            </button>
          )}
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1">
          {visible.length === 0 ? (
            <EmptyState
              variant="empty"
              size="sm"
              icon={Bell}
              title={showOld ? 'Nenhuma notificação' : 'Sem notificações nos últimos 7 dias'}
              description={
                !showOld && antigas.length > 0
                  ? `${antigas.length} ${antigas.length === 1 ? 'antiga disponível' : 'antigas disponíveis'}`
                  : undefined
              }
            />
          ) : (
            visible.map((n) => {
              const read = isRead(n.id)
              return (
                <div
                  key={n.id}
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors relative"
                  style={{
                    background: read ? 'transparent' : 'rgba(11,150,146,0.04)',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onClick={() => handleClick(n)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = read ? 'transparent' : 'rgba(11,150,146,0.04)')
                  }
                >
                  {/* Barra de prioridade à esquerda */}
                  {!read && (
                    <div
                      className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r"
                      style={{ background: brandColor(n.cor_hex) }}
                    />
                  )}

                  {/* Ícone */}
                  <span className="text-lg flex-shrink-0 mt-0.5 select-none">{n.icone}</span>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: brandColor(n.cor_hex) }}>
                      {n.titulo}
                    </p>
                    <p
                      className="text-xs mt-0.5 leading-relaxed"
                      style={{
                        color: 'var(--text-2)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {n.descricao}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-4)' }}>
                      {relativeTime(n.criado_em)}
                    </p>
                  </div>

                  {/* Ponto de não lida */}
                  {!read && (
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                      style={{ background: brandColor(n.cor_hex) }}
                    />
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Toggle: mostrar antigas / recolher */}
        {(antigas.length > 0 || showOld) && (
          <div
            className="flex-shrink-0 px-3 py-2"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <button
              onClick={() => setShowOld((s) => !s)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: 'transparent',
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
            >
              {showOld ? (
                <>
                  <ChevronUp size={12} />
                  Mostrar só recentes (7d)
                </>
              ) : (
                <>
                  <History size={12} />
                  Mostrar {antigas.length} {antigas.length === 1 ? 'antiga' : 'antigas'}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </Popover>
  )
}
