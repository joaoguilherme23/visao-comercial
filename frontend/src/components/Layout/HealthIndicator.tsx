import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, WifiOff } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { tenantsApi } from '../../api/tenants'
import { useTenantStore } from '../../store/tenantStore'
import { NumeroBot } from '../../types'

/**
 * Indicador compacto de saúde do bot no header — mostra quantos números
 * estão conectados e há quanto tempo foi a última sincronização.
 *
 * Estados:
 *  - verde  : todos conectados
 *  - amarelo: alguns desconectados
 *  - vermelho: nenhum número conectado (ou todos offline)
 *  - cinza  : sem números cadastrados
 *
 * Usa flags de recebimento e a última atividade; não infere conectividade atual.
 */
export default function HealthIndicator() {
  const { selectedTenant } = useTenantStore()

  const { data: numeros = [], isLoading } = useQuery({
    queryKey: ['tenant-numeros', selectedTenant?.id],
    queryFn: () => tenantsApi.getNumeros(selectedTenant!.id),
    enabled: !!selectedTenant,
    // Polling leve — 60s basta pra "last sync" parecer vivo sem matar a rede.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  })

  if (!selectedTenant || isLoading) return null

  const ativos = numeros.filter((n: NumeroBot) => n.ativo)
  const sincronizados = ativos.filter((n: NumeroBot) => n.sync_enabled)
  const nenhum = ativos.length === 0

  // Última sync = max(updated_at) entre números ativos. Se nenhum, null.
  const lastSyncIso = ativos
    .map((n: NumeroBot) => n.last_message_at ?? n.last_analysis_at)
    .filter(Boolean)
    .sort()
    .pop()

  const lastSyncLabel = (() => {
    if (!lastSyncIso) return null
    try {
      return formatDistanceToNow(new Date(lastSyncIso), { addSuffix: true, locale: ptBR })
    } catch {
      return null
    }
  })()

  const { color, bg, border, Icon, label } = (() => {
    if (nenhum)      return { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.25)', Icon: WifiOff,       label: 'Sem números' }
    if (sincronizados.length === ativos.length) return { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)', Icon: CheckCircle2, label: `${sincronizados.length}/${ativos.length} recebimento habilitado` }
    if (sincronizados.length > 0) return { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', Icon: AlertTriangle, label: `${sincronizados.length}/${ativos.length} recebimento habilitado` }
    return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', Icon: WifiOff, label: 'Recebimento desabilitado' }
  })()

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs"
      style={{ background: bg, border: `1px solid ${border}`, color }}
      title={lastSyncLabel ? `Última atividade ${lastSyncLabel}` : 'Estado de recebimento'}
    >
      <Icon size={12} className={sincronizados.length === ativos.length && !nenhum ? 'animate-pulse-soft' : ''} />
      <span className="font-semibold">{label}</span>
      {lastSyncLabel && (
        <span className="font-mono-data opacity-70 hidden lg:inline">· sync {lastSyncLabel}</span>
      )}
    </div>
  )
}
