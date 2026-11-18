import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { feedApi } from '../../api/feed'
import type { SnoozePreset } from '../../types'
import { toastError } from '../../lib/toast'

const LEAVE_ANIMATION_MS = 480

/**
 * Encapsula as mutations de "Concluir", "Soneca" e "Desfazer" do feed.
 *
 * Como não temos framer-motion, a animação de saída é feita marcando o card
 * como `leaving` por ~500ms — durante esse tempo o CSS faz fade-out + slide.
 * Após a animação, invalidamos a query do feed pra remover oficialmente.
 *
 * Toast de "Desfazer" aparece por 5s pra concluir — se o usuário clicar
 * em "Desfazer", chama o endpoint e o card volta no próximo poll.
 */
export function useFeedActions(clienteId: string | undefined) {
  const qc = useQueryClient()
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set())

  const startLeaving = useCallback((leadId: string) => {
    setLeavingIds((prev) => {
      const next = new Set(prev)
      next.add(leadId)
      return next
    })
  }, [])

  const finishLeaving = useCallback(
    (leadId: string) => {
      // Após animação, invalida o feed pra refazer fetch e remover de fato
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['feed', clienteId] })
        setLeavingIds((prev) => {
          const next = new Set(prev)
          next.delete(leadId)
          return next
        })
      }, LEAVE_ANIMATION_MS)
    },
    [qc, clienteId]
  )

  const concluir = useCallback(
    async (leadId: string) => {
      if (!clienteId) return
      startLeaving(leadId)
      try {
        await feedApi.concluir(clienteId, leadId)
        toast(
          (t) => (
            <div className="flex items-center gap-3">
              <span>Marcado como concluído.</span>
              <button
                onClick={async () => {
                  toast.dismiss(t.id)
                  try {
                    await feedApi.desfazerConclusao(clienteId, leadId)
                    qc.invalidateQueries({ queryKey: ['feed', clienteId] })
                    toast.success('Card restaurado')
                  } catch (err) {
                    toastError(err, { fallback: 'Erro ao desfazer' })
                  }
                }}
                className="text-xs font-semibold underline"
                style={{ color: '#a5b4fc' }}
              >
                Desfazer
              </button>
            </div>
          ),
          { duration: 5000 }
        )
        finishLeaving(leadId)
      } catch (err) {
        // Reverte a animação se a request falhar
        setLeavingIds((prev) => {
          const next = new Set(prev)
          next.delete(leadId)
          return next
        })
        toastError(err, { fallback: 'Erro ao concluir' })
      }
    },
    [clienteId, startLeaving, finishLeaving, qc]
  )

  const snooze = useCallback(
    async (leadId: string, preset: SnoozePreset) => {
      if (!clienteId) return
      startLeaving(leadId)
      try {
        await feedApi.snooze(clienteId, leadId, preset)
        toast.success(snoozeLabel(preset))
        finishLeaving(leadId)
      } catch (err) {
        setLeavingIds((prev) => {
          const next = new Set(prev)
          next.delete(leadId)
          return next
        })
        toastError(err, { fallback: 'Erro ao sonecar' })
      }
    },
    [clienteId, startLeaving, finishLeaving]
  )

  return {
    leavingIds,
    concluir,
    snooze,
  }
}

function snoozeLabel(preset: SnoozePreset): string {
  switch (preset) {
    case '1h': return 'Sonecado por 1 hora'
    case '3h': return 'Sonecado por 3 horas'
    case '6h': return 'Sonecado por 6 horas'
    case '1d': return 'Sonecado até amanhã'
    case '3d': return 'Sonecado por 3 dias'
  }
}
