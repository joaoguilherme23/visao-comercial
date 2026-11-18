import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ImageDown, Loader2, RefreshCw } from 'lucide-react'
import { avataresApi, type EntidadeTipo } from '../../api/avatares'
import { useAuthStore } from '../../store/authStore'
import { useTenantStore } from '../../store/tenantStore'

/**
 * Botão "Sincronizar fotos do WhatsApp" — chama POST /avatares/.../sync-pendentes
 * pegando os primeiros N registros sem foto da empresa atual.
 *
 * Visível só pra superadmin OU admin do tenant (espelha require_admin_in_tenant
 * no backend; outros papéis recebem 403 e não veem o botão).
 *
 * Onde usar: Header das telas /conversas (tipo="leads") e /grupos (tipo="grupos").
 */
export default function SyncFotosButton({
  tipo,
  invalidateKeys = [],
  limit = 30,
  size = 'sm',
}: {
  tipo: EntidadeTipo
  /** Query keys do React Query a invalidar ao terminar (ex: ['conversas', tenantId]). */
  invalidateKeys?: unknown[][]
  /** Quantidade máxima por chamada. Default 30. */
  limit?: number
  size?: 'sm' | 'xs'
}) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const { selectedTenant, tenantRole } = useTenantStore()
  const [showLastSummary, setShowLastSummary] = useState<string | null>(null)

  const allowed =
    !!selectedTenant &&
    (user?.is_superadmin || (user?.is_manager_multi && tenantRole === 'admin'))

  const mutation = useMutation({
    mutationFn: () =>
      avataresApi.syncPendentes(selectedTenant!.id, tipo, limit),
    onSuccess: (data) => {
      const s = data.summary
      const msg = `Sincronizadas: ${s.ok} · Sem foto: ${s.no_avatar} · Já tinham: ${s.skipped}${s.failed > 0 ? ` · Erros: ${s.failed}` : ''}`
      setShowLastSummary(msg)
      if (s.ok > 0) {
        toast.success(`${s.ok} foto${s.ok === 1 ? '' : 's'} sincronizada${s.ok === 1 ? '' : 's'}`)
      } else if (s.skipped === s.total && s.total > 0) {
        toast(`Todas as ${s.total} já tinham foto`, { icon: '✓' })
      } else if (s.no_avatar === s.total) {
        toast(`Nenhuma foto pública nas ${s.total} verificadas`, { icon: 'ℹ️' })
      } else {
        toast(msg)
      }
      // Invalida queries pra UI re-renderizar com fotos novas
      for (const key of invalidateKeys) {
        qc.invalidateQueries({ queryKey: key })
      }
    },
    onError: () => {
      toast.error('Erro ao sincronizar fotos')
    },
  })

  if (!allowed) return null

  const padCls = size === 'xs' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-xs'

  return (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className={`${padCls} rounded-lg font-medium flex items-center gap-1.5 transition-colors disabled:opacity-60`}
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text-2)',
      }}
      title={
        showLastSummary ??
        `Buscar fotos do WhatsApp das ${tipo === 'leads' ? 'pessoas' : 'grupos'} desta empresa que ainda não tem avatar (até ${limit} por vez).`
      }
    >
      {mutation.isPending ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <ImageDown size={13} />
      )}
      <span className="hidden sm:inline">
        {mutation.isPending ? 'Sincronizando...' : 'Sincronizar fotos'}
      </span>
    </button>
  )
}
