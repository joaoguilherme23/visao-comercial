import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { variacaoForDelta } from '../../lib/semanticColors'
import { Pill } from '../ds/Pill'

interface VariationPillProps {
  /** Delta em percentual (ex: 12.5 = +12,5%). */
  value: number | null | undefined
  /** Abaixo desse valor absoluto, trata como 'flat'. Default: 0.5%. */
  flatThreshold?: number
  /** Tamanho do ícone + texto. Default: 'sm'. */
  size?: 'xs' | 'sm'
  /**
   * Se true, inverte a polaridade — útil pra métricas onde "caiu" é positivo
   * (ex: tempo médio de resposta, % de leads perdidos).
   */
  inverse?: boolean
}

/**
 * Pílula que mostra variação percentual com cor semântica (up/down/flat).
 * Wrapper thin sobre <Pill tone="variacao:*"> — preserva API externa.
 */
export default function VariationPill({
  value,
  flatThreshold = 0.5,
  size = 'sm',
  inverse = false,
}: VariationPillProps) {
  if (value == null) return null

  const direction = variacaoForDelta(value, flatThreshold)
  // Inverte apenas a percepção de cor — o sinal numérico fica como veio.
  const colorKey: 'up' | 'down' | 'flat' =
    inverse && direction === 'up' ? 'down'
    : inverse && direction === 'down' ? 'up'
    : direction

  const Icon =
    direction === 'up' ? TrendingUp
    : direction === 'down' ? TrendingDown
    : Minus

  const text = `${value >= 0 ? '+' : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

  return (
    <Pill
      tone={`variacao:${colorKey}`}
      size={size}
      icon={Icon}
      mono
      className="font-semibold"
    >
      {text}
    </Pill>
  )
}
