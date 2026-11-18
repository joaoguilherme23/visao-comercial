import { cloneElement, isValidElement, ReactElement, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePopoverPosition } from './hooks/usePopoverPosition'

type Side = 'top' | 'bottom' | 'left' | 'right'
type Align = 'start' | 'center' | 'end'

export interface PopoverProps {
  trigger: ReactElement
  children: React.ReactNode
  side?: Side
  align?: Align
  offset?: number
  width?: number | 'auto'
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
  open?: boolean
  className?: string
  portal?: boolean
  'aria-label'?: string
}

export function Popover({
  trigger,
  children,
  side = 'bottom',
  align = 'start',
  offset = 8,
  width = 'auto',
  onOpenChange,
  defaultOpen = false,
  open: controlledOpen,
  className = '',
  portal = true,
  'aria-label': ariaLabel,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen

  const triggerRef = useRef<HTMLElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  const pos = usePopoverPosition(triggerRef, popoverRef, {
    side, align, offset, enabled: isOpen,
  })

  // Click outside
  useEffect(() => {
    if (!isOpen) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      if (popoverRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Clone trigger com props aria
  type TriggerProps = {
    ref?: React.Ref<HTMLElement>
    onClick?: (e: React.MouseEvent) => void
    'aria-haspopup'?: string
    'aria-expanded'?: boolean
  }
  const triggerWithProps = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<TriggerProps>, {
        ref: triggerRef,
        onClick: (e: React.MouseEvent) => {
          const props = (trigger as ReactElement<TriggerProps>).props
          props.onClick?.(e)
          setOpen(!isOpen)
        },
        'aria-haspopup': 'dialog',
        'aria-expanded': isOpen,
      })
    : trigger

  const content = isOpen ? (
    <div
      ref={popoverRef}
      className={`rounded-xl shadow-lg ${className}`}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: width === 'auto' ? undefined : width,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
        zIndex: 50,
        animation: 'slideDown 120ms ease-out',
      }}
      role="dialog"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  ) : null

  return (
    <>
      {triggerWithProps}
      {content ? (portal ? createPortal(content, document.body) : content) : null}
    </>
  )
}
