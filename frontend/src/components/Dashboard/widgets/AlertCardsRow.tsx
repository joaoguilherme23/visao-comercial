import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { AlertTriangle, Ban, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { dashboardApi, type KpiResult } from '../../../api/dashboard'
import { useTenantStore } from '../../../store/tenantStore'

/**
 * Banner de alertas no topo do dashboard.
 *
 * Padrão: filtra apenas últimos 7 dias (ignora alertas "antigos demais"
 * que viraram ruído). Toggle "Mostrar antigos" expande pra usar o KPI
 * do período do dashboard inteiro.
 *
 * Quando o toggle OFF, faz request própria com data_inicio=hoje-7d.
 * Quando ON, usa os kpis já calculados que vieram do período do dashboard.
 */
export default function AlertCardsRow({ kpis }: { kpis?: KpiResult[] }) {
  const [showOld, setShowOld] = useState(false)
  const { selectedTenant, selectedNumero } = useTenantStore()

  // Período de 7 dias — só usado quando showOld=false
  const last7d = useState(() => ({
    data_inicio: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    data_fim: format(new Date(), 'yyyy-MM-dd'),
  }))[0]

  // Query independente — só dispara quando showOld=false (padrão)
  const { data: kpis7d } = useQuery({
    queryKey: ['kpis-alertas-7d', selectedTenant?.id, selectedNumero?.numero ?? null],
    queryFn: () =>
      dashboardApi.getKpis(selectedTenant!.id, {
        ...last7d,
        ...(selectedNumero ? { telefone_bot: selectedNumero.numero } : {}),
      }),
    enabled: !!selectedTenant && !showOld,
    staleTime: 60_000,
  })

  // Fonte de dados depende do toggle
  const sourceKpis = showOld ? kpis : kpis7d

  const getValue = (slug: string): number => {
    const kpi = sourceKpis?.find((k) => k.slug === slug)
    if (!kpi) return 0
    return typeof kpi.valor === 'number' ? kpi.valor : parseFloat(String(kpi.valor)) || 0
  }

  const alerts = [
    { label: 'Leads sem etapa',     count: getValue('leads_sem_etapa'),    icon: AlertTriangle, activeColor: '#f59e0b' },
    { label: 'Leads bloqueados',    count: getValue('leads_bloqueados'),   icon: Ban,           activeColor: '#ef4444' },
    { label: 'Follow-ups vencidos', count: getValue('followups_vencidos'), icon: Clock,         activeColor: '#f97316' },
  ]

  const hasAnyAlert = alerts.some((a) => a.count > 0)

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-2.5"
      style={{
        background: hasAnyAlert ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.05)',
        border: `1px solid ${hasAnyAlert ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.15)'}`,
      }}
    >
      <span
        className="text-xs font-semibold uppercase tracking-wider flex-shrink-0"
        style={{ color: 'var(--text-3)' }}
      >
        Alertas
      </span>
      <span
        className="text-[10px] flex-shrink-0"
        style={{ color: 'var(--text-3)' }}
      >
        ({showOld ? 'todo o período' : 'últimos 7d'})
      </span>
      <div className="w-px h-4 flex-shrink-0" style={{ background: 'var(--border)' }} />
      {alerts.map(({ label, count, icon: Icon, activeColor }) => {
        const active = count > 0
        const color = active ? activeColor : '#22c55e'
        return (
          <div key={label} className="flex items-center gap-1.5 flex-shrink-0">
            <Icon size={13} style={{ color }} />
            <span className="text-xs" style={{ color: 'var(--text-2)' }}>
              {label}:
            </span>
            <span className="text-sm font-bold" style={{ color }}>
              {count.toLocaleString('pt-BR')}
            </span>
          </div>
        )
      })}

      {/* Spacer pra empurrar toggle pra direita */}
      <div className="flex-1" />

      {/* Toggle "ver antigos" / "voltar pra 7d" */}
      <button
        onClick={() => setShowOld((s) => !s)}
        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors flex-shrink-0"
        style={{
          background: 'transparent',
          color: 'var(--text-3)',
          border: '1px solid var(--border)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text-1)'
          e.currentTarget.style.background = 'var(--bg-elevated)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-3)'
          e.currentTarget.style.background = 'transparent'
        }}
        title={
          showOld
            ? 'Voltar pra alertas dos últimos 7 dias'
            : 'Mostrar alertas de todo o período do dashboard'
        }
      >
        {showOld ? (
          <>
            <ChevronUp size={11} />
            Recentes (7d)
          </>
        ) : (
          <>
            <ChevronDown size={11} />
            Mostrar antigos
          </>
        )}
      </button>
    </div>
  )
}
