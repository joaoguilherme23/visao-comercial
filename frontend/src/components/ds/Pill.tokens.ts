import { semanticColors, Temperatura, Sentimento, Variacao } from '../../lib/semanticColors'

export type Tone =
  | `temperatura:${Temperatura}`
  | `sentimento:${Sentimento}`
  | `variacao:${Variacao}`
  | 'status:active' | 'status:inactive' | 'status:pending' | 'status:danger' | 'status:success'
  | 'role:admin' | 'role:manager' | 'role:viewer'
  | 'neutral'

export type Variant = 'solid' | 'soft' | 'ghost'

export interface PillStyle {
  bg: string
  color: string
  border: string
}

function getBaseColor(tone: Tone): string {
  // Extrai a cor base para cada tone
  if (tone.startsWith('temperatura:')) {
    const k = tone.split(':')[1] as Temperatura
    return semanticColors.temperatura[k]
  }
  if (tone.startsWith('sentimento:')) {
    const k = tone.split(':')[1] as Sentimento
    return semanticColors.sentimento[k]
  }
  if (tone.startsWith('variacao:')) {
    const k = tone.split(':')[1] as Variacao
    return semanticColors.variacao[k]
  }
  // status:*
  if (tone === 'status:active' || tone === 'status:success') return semanticColors.sentimento.positivo
  if (tone === 'status:inactive') return '#f87171'  // red-400
  if (tone === 'status:pending') return '#facc15'   // yellow-400
  if (tone === 'status:danger') return '#ef4444'
  // role:*
  if (tone === 'role:admin') return '#25c8bd'
  if (tone === 'role:manager') return '#a5b4fc'
  if (tone === 'role:viewer') return '#94a3b8'
  // neutral
  return 'var(--text-2)'
}

export function pillStyle(tone: Tone, variant: Variant): PillStyle {
  if (tone === 'neutral') {
    return {
      bg: variant === 'solid' ? 'var(--bg-elevated)' : 'transparent',
      color: 'var(--text-2)',
      border: variant === 'ghost' ? '1px solid var(--border-subtle)' : '1px solid transparent',
    }
  }
  const base = getBaseColor(tone)
  if (variant === 'solid') {
    return { bg: base, color: '#ffffff', border: `1px solid ${base}` }
  }
  if (variant === 'ghost') {
    return { bg: 'transparent', color: base, border: `1px solid ${base}60` }
  }
  // soft (default)
  return { bg: `${base}1f`, color: base, border: `1px solid ${base}33` }
}
