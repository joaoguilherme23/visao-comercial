import { useEffect } from 'react'

/**
 * Dispara `onEscape` ao pressionar ESC, apenas enquanto `enabled` for true.
 *
 * Respeita modais/popovers do Design System: se existir qualquer elemento com
 * `role="dialog"` ou `role="alertdialog"` no DOM, assume que ele deve tratar
 * o ESC primeiro e ignora. Também ignora eventos com `defaultPrevented`.
 *
 * Uso típico:
 *   useEscapeKey(focusMode, () => setFocusMode(false))
 */
export function useEscapeKey(enabled: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (e.defaultPrevented) return
      // Se há dialog aberto (Popover, ConfirmModal, etc), deixa ele tratar.
      if (
        document.querySelector('[role="dialog"]') ||
        document.querySelector('[role="alertdialog"]')
      ) {
        return
      }
      onEscape()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [enabled, onEscape])
}
