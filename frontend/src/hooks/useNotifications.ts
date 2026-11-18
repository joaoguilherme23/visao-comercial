import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { notificacoesApi } from '../api/notificacoes'
import { useNotificationStore } from '../store/notificationStore'
import { useTenantStore } from '../store/tenantStore'
import { Notificacao } from '../types'
import { isOld } from '../lib/notifications'

const REFETCH_INTERVAL = 30_000 // 30 segundos

export function useNotifications() {
  const { selectedTenant } = useTenantStore()
  const clienteId = selectedTenant?.id

  const { setNotifications, previousIds, isDismissed } = useNotificationStore()

  // Evita disparar toasts na primeira carga (evita flood ao abrir o app)
  const isFirstLoadRef = useRef(true)

  const { data, isLoading, error } = useQuery({
    queryKey: ['notificacoes', clienteId],
    queryFn: () => notificacoesApi.list(clienteId!),
    enabled: !!clienteId,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (!data) return

    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false
      setNotifications(data)
      return
    }

    // Detecta novas notificações: IDs presentes agora mas não no poll anterior.
    // Filtra também por idade — notificações com mais de 7 dias NUNCA viram toast,
    // mesmo que pareçam "novas" pra store (isso acontece em F5/reload, pois o
    // store não persiste `previousIds` e zera a cada reload).
    const newNotifs = data
      .filter((n: Notificacao) => !previousIds.has(n.id))
      .filter((n: Notificacao) => !isOld(n))

    // Dispara toasts para novas (máx 3 + overflow)
    const toastable = newNotifs
      .filter((n: Notificacao) => !isDismissed(n.id))
      .slice(0, 3)

    toastable.forEach((n: Notificacao) => {
      toast(`${n.icone} ${n.titulo}: ${n.descricao}`, {
        id: `notif-${n.id}`,   // previne toast duplicado no StrictMode
        duration: 5000,
      })
    })

    if (newNotifs.length > 3) {
      toast(`+${newNotifs.length - 3} novas notificações`, {
        id: 'notif-overflow',
        duration: 4000,
      })
    }

    setNotifications(data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])
  // previousIds excluído intencionalmente: queremos o valor no momento em que
  // data muda, não re-executar quando previousIds muda.

  return { isLoading, error }
}
