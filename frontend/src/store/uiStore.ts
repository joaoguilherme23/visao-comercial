import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  /**
   * Modo Atendimento — quando true, Sidebar/Header ficam ocultos e o ChatPanel
   * vira o centro da tela. Não persiste entre sessões (reset a cada reload).
   */
  focusMode: boolean
  setFocusMode: (v: boolean) => void
  exitFocusMode: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      focusMode: false,
      setFocusMode: (v) => set({ focusMode: v }),
      exitFocusMode: () => set({ focusMode: false }),
    }),
    {
      name: 'x9-ui',
      // Persistir APENAS sidebarCollapsed; focusMode é efêmero por design.
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    }
  )
)
