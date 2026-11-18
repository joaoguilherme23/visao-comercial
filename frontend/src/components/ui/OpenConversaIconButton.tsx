import { Link } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import { linkToConversa } from '../../lib/leadLinks'

interface OpenConversaIconButtonProps {
  /** UUID do lead — vai pra URL `?leadId=<leadId>&highlight=1`. */
  leadId: string
  /** Nome do lead — usado no `aria-label`. */
  nome?: string | null
  /** Extra className pro wrapper externo (posicionamento absoluto, etc). */
  className?: string
  /**
   * Quando true (default), o botão fica invisível até o pai entrar em `:hover`
   * (requer que o pai tenha `className="group"`). Em telas touch — onde não
   * existe hover — sempre aparece via `@media (pointer: coarse)`.
   *
   * Quando false, fica sempre visível (use em listas/cards onde o hover já
   * mostra muita coisa).
   */
  hoverOnly?: boolean
}

/**
 * Botão circular 28×28 pra abrir a conversa de um lead. Usa <Link> do
 * react-router — permite Ctrl+click / middle-click pra abrir em nova aba.
 *
 * Implementação crítica:
 * - `stopPropagation` em `onClick` E `onPointerDown` pra não disparar o click
 *   do card pai nem o dnd-kit (que escuta pointerdown).
 * - `e.preventDefault()` NÃO é chamado — queremos a navegação do <Link>.
 */
export default function OpenConversaIconButton({
  leadId,
  nome,
  className,
  hoverOnly = true,
}: OpenConversaIconButtonProps) {
  const label = `Abrir conversa com ${nome?.trim() || 'lead'}`

  // Classes do próprio botão:
  //  - base: estilo visual
  //  - hoverOnly: opacity-0 + group-hover:opacity-100 (desktop)
  //               + override de opacidade em pointer:coarse (touch)
  const baseClasses =
    'inline-flex items-center justify-center rounded-full transition-all ' +
    'focus:outline-none focus:ring-2 focus:ring-offset-0'
  const hoverClasses = hoverOnly
    ? 'opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity open-conversa-btn-touch'
    : ''
  const finalClassName = [baseClasses, hoverClasses, className ?? ''].filter(Boolean).join(' ')

  return (
    <Link
      to={linkToConversa(leadId, { highlight: true })}
      aria-label={label}
      title={label}
      className={finalClassName}
      style={{
        width: 28,
        height: 28,
        background: 'rgba(11,150,146,0.12)',
        border: '1px solid rgba(11,150,146,0.25)',
        color: '#25c8bd',
      }}
      onClick={(e) => {
        // Impede que o click propague pro card pai (que também tem onClick pra
        // abrir modal/expandir) — o Link segue navegando normalmente.
        e.stopPropagation()
      }}
      onPointerDown={(e) => {
        // dnd-kit registra pointerdown pro drag — precisamos impedir que o
        // clique vire início de arrasto do card inteiro.
        e.stopPropagation()
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.background = 'rgba(11,150,146,0.22)'
        el.style.transform = 'scale(1.05)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.background = 'rgba(11,150,146,0.12)'
        el.style.transform = ''
      }}
    >
      <MessageSquare size={14} />
    </Link>
  )
}
