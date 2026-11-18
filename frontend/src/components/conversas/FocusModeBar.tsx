import { useEffect, useState } from 'react'
import { Clock, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Pill } from '../ds'
import { normalizeTemperatura } from '../../lib/semanticColors'
import type { ConversaPreview } from '../../types'

interface FocusModeBarProps {
  conversa: ConversaPreview
  /** ISO da última mensagem com direcao === 'entrada' (ou null se nunca). */
  ultimaEntradaEm: string | null
  onExit: () => void
}

/**
 * Sticky bar exibida no topo do ChatPanel em Modo Atendimento.
 * Mostra temperatura (pílula grande), score e um timer "Última resposta: há Xmin"
 * com cor dinâmica baseada no tempo decorrido. Re-renderiza a cada 60s para
 * manter o timer atualizado.
 */
export function FocusModeBar({ conversa, ultimaEntradaEm, onExit }: FocusModeBarProps) {
  // Tick local pra forçar re-render a cada minuto e manter o timer vivo.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const tempKey = normalizeTemperatura(conversa.temperatura)
  const score = conversa.score

  // Calcular cor e texto do timer.
  // < 5 min: verde (fresco) · < 30 min: cinza (ok) · < 2h: âmbar (fica esfriando) · >= 2h: vermelho (esfriou).
  let timerColor = 'var(--text-2)'
  let timerText = 'Nenhuma resposta do lead ainda'
  if (ultimaEntradaEm) {
    const date = new Date(ultimaEntradaEm)
    const minutes = (Date.now() - date.getTime()) / 60000
    if (minutes < 5) timerColor = '#22c55e'
    else if (minutes < 30) timerColor = 'var(--text-2)'
    else if (minutes < 120) timerColor = '#f59e0b'
    else timerColor = '#ef4444'
    timerText = `Última resposta: ${formatDistanceToNow(date, { addSuffix: true, locale: ptBR })}`
  }

  return (
    <div
      className="sticky top-0 z-10 flex items-center gap-3 px-4 py-2"
      style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {tempKey && (
        <Pill tone={`temperatura:${tempKey}`} size="md" dot>
          {conversa.temperatura}
        </Pill>
      )}
      {score != null && (
        <div className="flex items-center gap-1">
          <span style={{ color: '#facc15' }}>●</span>
          <span
            className="font-mono-data text-sm"
            style={{ color: 'var(--text-1)' }}
          >
            {score.toFixed(1)}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
            Score
          </span>
        </div>
      )}
      <div
        style={{
          borderLeft: '1px solid var(--border-subtle)',
          height: 20,
        }}
      />
      <div className="flex items-center gap-1.5" style={{ color: timerColor }}>
        <Clock size={14} />
        <span className="text-sm">{timerText}</span>
      </div>
      <div className="flex-1" />
      <button
        onClick={onExit}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
        style={{
          background: 'transparent',
          color: 'var(--text-2)',
          border: '1px solid var(--border-subtle)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        title="Sair do modo foco (Esc)"
      >
        <X size={14} />
        Sair
      </button>
    </div>
  )
}
