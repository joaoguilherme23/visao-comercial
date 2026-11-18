import { create } from 'zustand'
import { Notificacao } from '../types'

// ---------------------------------------------------------------------------
// localStorage helpers — ler/escrever diretamente, sem Zustand persist
// O estado de leitura é simples booleans por ID — não precisa de rehydration
// ---------------------------------------------------------------------------

const LS_READ = (id: string) => `x9-notif-read:${id}`
const LS_DISMISSED = (id: string) => `x9-notif-dismissed:${id}`

function _isRead(id: string): boolean {
  return localStorage.getItem(LS_READ(id)) === '1'
}

function _isDismissed(id: string): boolean {
  return localStorage.getItem(LS_DISMISSED(id)) === '1'
}

function _cleanupStaleKeys(activeIds: Set<string>) {
  // Remove chaves de IDs que não estão mais na lista ativa
  const toDelete: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    if (key.startsWith('x9-notif-read:') || key.startsWith('x9-notif-dismissed:')) {
      const id = key.split(':').slice(2).join(':')
      if (!activeIds.has(id)) toDelete.push(key)
    }
  }
  toDelete.forEach((k) => localStorage.removeItem(k))
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface NotificationState {
  notifications: Notificacao[]
  /** IDs do ciclo de poll anterior — usado para diff de novas notificações */
  previousIds: Set<string>
  unreadCount: number
  /** Lead pendente a ser aberto no modal do Dashboard */
  pendingLead: { id: string; nome?: string | null; whatsapp: string } | null

  setNotifications: (notifs: Notificacao[]) => void
  markRead: (id: string) => void
  markAllRead: () => void
  dismiss: (id: string) => void
  isRead: (id: string) => boolean
  isDismissed: (id: string) => boolean
  setPendingLead: (lead: { id: string; nome?: string | null; whatsapp: string }) => void
  clearPendingLead: () => void
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  previousIds: new Set<string>(),
  unreadCount: 0,
  pendingLead: null,

  setNotifications: (notifs) => {
    const activeIds = new Set(notifs.map((n) => n.id))
    _cleanupStaleKeys(activeIds)

    const unread = notifs.filter((n) => !_isRead(n.id) && !_isDismissed(n.id))
    set({
      notifications: notifs,
      previousIds: activeIds,
      unreadCount: unread.length,
    })
  },

  markRead: (id) => {
    localStorage.setItem(LS_READ(id), '1')
    const { notifications } = get()
    const unread = notifications.filter((n) => !_isRead(n.id) && !_isDismissed(n.id))
    set({ unreadCount: unread.length })
  },

  markAllRead: () => {
    const { notifications } = get()
    notifications.forEach((n) => localStorage.setItem(LS_READ(n.id), '1'))
    set({ unreadCount: 0 })
  },

  dismiss: (id) => {
    localStorage.setItem(LS_DISMISSED(id), '1')
    const { notifications } = get()
    const unread = notifications.filter((n) => !_isRead(n.id) && !_isDismissed(n.id))
    set({ unreadCount: unread.length })
  },

  isRead: _isRead,
  isDismissed: _isDismissed,

  setPendingLead: (lead) => set({ pendingLead: lead }),
  clearPendingLead: () => set({ pendingLead: null }),
}))
