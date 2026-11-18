// ── Helpers do DashboardPage ─────────────────────────────────────────────────
// Extraídos mecanicamente de DashboardPage.tsx.
import { useState, useEffect } from 'react'
import { startOfMonth } from 'date-fns'
import type { DateRange } from '../../components/DateRangePicker'

// Hook para detectar breakpoint `lg` do Tailwind (>= 1024px).
// Usado no TopKpiStrip para sobrescrever o grid responsivo em desktop,
// permitindo exatamente N colunas iguais conforme a contagem de KPIs.
export function useIsLgUp(): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(min-width: 1024px)').matches
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return matches
}

export function splitValue(valor: number | string, formato: string) {
  if (typeof valor === 'string') return { number: valor, unit: '' }
  if (formato === 'percent') return { number: valor.toLocaleString('pt-BR'), unit: '%' }
  if (formato === 'currency') return { number: valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), unit: 'R$' }
  return { number: valor.toLocaleString('pt-BR'), unit: '' }
}

// Cor da hora do dia por faixa — usado no HorarioRespostasPanel.
export const HORA_COLOR = (hora: number): string => {
  if (hora < 6)  return '#0b9692' // madrugada
  if (hora < 12) return '#f59e0b' // manhã
  if (hora < 18) return '#f97316' // tarde
  return '#3b82f6'                // noite
}

// Range padrão do dashboard — dia 1 do mês corrente até hoje.
// Quem quiser ver período diferente usa o DateRangePicker.
export function defaultRange(): DateRange {
  const hoje = new Date()
  return { inicio: startOfMonth(hoje), fim: hoje }
}
