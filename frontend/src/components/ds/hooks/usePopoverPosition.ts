import { RefObject, useEffect, useState } from 'react'

type Side = 'top' | 'bottom' | 'left' | 'right'
type Align = 'start' | 'center' | 'end'

interface Options {
  side: Side
  align: Align
  offset: number
  enabled: boolean
}

interface Position {
  top: number
  left: number
}

export function usePopoverPosition(
  triggerRef: RefObject<HTMLElement>,
  popoverRef: RefObject<HTMLElement>,
  opts: Options,
): Position {
  const [pos, setPos] = useState<Position>({ top: 0, left: 0 })

  useEffect(() => {
    if (!opts.enabled) return
    const update = () => {
      const t = triggerRef.current
      const p = popoverRef.current
      if (!t || !p) return
      const tr = t.getBoundingClientRect()
      const pw = p.offsetWidth
      const ph = p.offsetHeight
      const vw = window.innerWidth
      const vh = window.innerHeight

      let top = 0, left = 0
      if (opts.side === 'bottom') {
        top = tr.bottom + opts.offset
        left = opts.align === 'start' ? tr.left : opts.align === 'end' ? tr.right - pw : tr.left + (tr.width - pw) / 2
      } else if (opts.side === 'top') {
        top = tr.top - ph - opts.offset
        left = opts.align === 'start' ? tr.left : opts.align === 'end' ? tr.right - pw : tr.left + (tr.width - pw) / 2
      } else if (opts.side === 'right') {
        left = tr.right + opts.offset
        top = opts.align === 'start' ? tr.top : opts.align === 'end' ? tr.bottom - ph : tr.top + (tr.height - ph) / 2
      } else {
        left = tr.left - pw - opts.offset
        top = opts.align === 'start' ? tr.top : opts.align === 'end' ? tr.bottom - ph : tr.top + (tr.height - ph) / 2
      }
      // clamp viewport
      top = Math.max(8, Math.min(vh - ph - 8, top))
      left = Math.max(8, Math.min(vw - pw - 8, left))
      setPos({ top, left })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [triggerRef, popoverRef, opts.side, opts.align, opts.offset, opts.enabled])

  return pos
}
