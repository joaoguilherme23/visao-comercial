import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

const HIGHLIGHT_CLASS = 'ring-highlight'
const ANIMATION_DURATION_MS = 2400 // 3 pulsos de 800ms
// Dados do Kanban/Conversas são fetched async — a lista pode demorar ~1s
// pra chegar. Damos até 5s procurando o alvo antes de desistir.
const DOM_WAIT_TIMEOUT_MS = 5000

/**
 * Aplica um ring-pulse visual em um elemento identificado por
 * `data-lead-id={targetLeadId}` quando a URL contém `?leadId=<target>&highlight=1`.
 *
 * Fluxo:
 * 1. Se `highlight=1` E `leadId === targetLeadId`:
 *    - procura `[data-lead-id="<target>"]` no DOM; se não existir, observa
 *      mutações por até 5s até o alvo aparecer (render async de lista/modal)
 *    - scrolla o elemento pro centro (smooth)
 *    - aplica `.ring-highlight` por 2.4s
 *    - após a animação, remove a classe e limpa `highlight` da URL (leadId fica)
 * 2. `prefers-reduced-motion`: só scrolla, sem animação.
 * 3. Cleanup: se o componente desmontar, remove timers/observer e a classe.
 *
 * Uso típico:
 *   useHighlightRing(selectedConversa?.lead_id)
 *   // E no DOM do item-alvo:
 *   <div data-lead-id={leadId}>...</div>
 */
export function useHighlightRing(targetLeadId: string | null | undefined): void {
  const [searchParams, setSearchParams] = useSearchParams()
  const highlight = searchParams.get('highlight') === '1'
  const urlLeadId = searchParams.get('leadId')

  // Mantém a referência atual de setSearchParams sem disparar re-execuções
  // do efeito — react-router retorna uma nova função a cada render.
  const setSearchParamsRef = useRef(setSearchParams)
  useEffect(() => {
    setSearchParamsRef.current = setSearchParams
  }, [setSearchParams])

  useEffect(() => {
    if (!highlight || !targetLeadId || urlLeadId !== targetLeadId) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let cleanupTimer: number | null = null
    let giveUpTimer: number | null = null
    let observer: MutationObserver | null = null
    let appliedEl: HTMLElement | null = null
    let done = false

    const selector = `[data-lead-id="${CSS.escape(targetLeadId)}"]`

    const applyTo = (el: HTMLElement) => {
      if (done) return
      done = true
      if (observer) observer.disconnect()
      if (giveUpTimer !== null) window.clearTimeout(giveUpTimer)

      appliedEl = el

      // Scroll sempre — mesmo com reduced-motion (pra revelar o alvo).
      try {
        el.scrollIntoView({
          block: 'center',
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
        })
      } catch {
        /* jsdom / browsers antigos — ignora */
      }

      if (!prefersReducedMotion && typeof el.animate === 'function') {
        // Web Animations API: roda fora do ciclo de re-render do React —
        // não é sobrescrita quando o componente re-renderiza e o React
        // reescreve `className`. 3 pulsos de 800ms = 2400ms totais.
        try {
          el.animate(
            [
              { borderColor: 'var(--brand-500)' },
              { borderColor: 'var(--brand-500)' },
              { borderColor: 'var(--border)' },
            ],
            {
              duration: 800,
              iterations: 3,
              easing: 'ease-out',
            },
          )
        } catch {
          /* fallback pra CSS class se animate() explodir (browsers antigos) */
          el.classList.add(HIGHLIGHT_CLASS)
        }
      }

      // Após animação: remove classe (se aplicada como fallback) e tira
      // `highlight` da URL (leadId fica). `replace: true` pra não poluir
      // history. Só limpa se a URL ainda bate com o target.
      cleanupTimer = window.setTimeout(
        () => {
          el.classList.remove(HIGHLIGHT_CLASS)
          const current = new URLSearchParams(window.location.search)
          if (current.get('highlight') === '1' && current.get('leadId') === targetLeadId) {
            const next = new URLSearchParams(current)
            next.delete('highlight')
            setSearchParamsRef.current(next, { replace: true })
          }
        },
        prefersReducedMotion ? 50 : ANIMATION_DURATION_MS,
      )
    }

    // 1ª tentativa: procura imediatamente (caso o alvo já esteja no DOM).
    const immediate = document.querySelector<HTMLElement>(selector)
    if (immediate) {
      applyTo(immediate)
    } else {
      // 2ª estratégia: observa o DOM até o alvo aparecer, com timeout de 5s.
      observer = new MutationObserver(() => {
        const el = document.querySelector<HTMLElement>(selector)
        if (el) applyTo(el)
      })
      observer.observe(document.body, { childList: true, subtree: true })

      giveUpTimer = window.setTimeout(() => {
        if (!done && observer) {
          observer.disconnect()
          done = true
        }
      }, DOM_WAIT_TIMEOUT_MS)
    }

    return () => {
      if (cleanupTimer !== null) window.clearTimeout(cleanupTimer)
      if (giveUpTimer !== null) window.clearTimeout(giveUpTimer)
      if (observer) observer.disconnect()
      if (appliedEl) appliedEl.classList.remove(HIGHLIGHT_CLASS)
    }
    // setSearchParams NÃO está nas deps de propósito — é uma função nova a
    // cada render do react-router v6 e causaria re-execução infinita do
    // efeito (removendo a classe imediatamente após adicionar). Usamos
    // `setSearchParamsRef.current` dentro do timeout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight, targetLeadId, urlLeadId])
}
