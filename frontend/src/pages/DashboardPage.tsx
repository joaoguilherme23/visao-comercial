// React + routing
import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

// Libs externas
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Users, Settings, RefreshCw, Loader2, X, Phone } from 'lucide-react'

// API clients
import {
  dashboardApi,
  KpiResult,
  getFunil,
  getObjecoes,
  getHorario,
  getHorarioRespostas,
  getHorarioLeads,
  getSentimentoHistorico,
  getMensagensVolume,
  getEvolucaoAnual,
  getDiaSemana,
  getEstadoDDD,
  getScoreFaixas,
  getLeadsRecentes,
  getWidgets,
  getComparativoNumeros,
  LeadRecenteItem,
  PeriodoParams,
} from '../api/dashboard'
import { conversasApi } from '../api/conversas'
import api from '../api/client'

// Stores
import { useTenantStore } from '../store/tenantStore'
import { useNotificationStore } from '../store/notificationStore'

// Design System
import { EmptyState } from '../components/ds'

// Dashboard — charts
import HistoricoChart from '../components/Dashboard/charts/HistoricoChart'

// Dashboard — widgets
import CategorySection from '../components/Dashboard/widgets/CategorySection'
import ClusterSection from '../components/Dashboard/widgets/ClusterSection'
import { groupByCluster } from '../components/Dashboard/kpiClusters'
import AlertCardsRow from '../components/Dashboard/widgets/AlertCardsRow'
import FunilPanel from '../components/Dashboard/widgets/FunilPanel'
import TopKpiStrip from '../components/Dashboard/widgets/TopKpiStrip'
import DynamicWidgetCard from '../components/Dashboard/widgets/DynamicWidgetCard'
import TemperaturaBarPanel from '../components/Dashboard/widgets/TemperaturaBarPanel'
import ObjecoesPanel from '../components/Dashboard/widgets/ObjecoesPanel'
import HorarioRespostasPanel from '../components/Dashboard/widgets/HorarioRespostasPanel'
import DiaSemanaPanel from '../components/Dashboard/widgets/DiaSemanaPanel'
import SentimentoHistoricoPanel from '../components/Dashboard/widgets/SentimentoHistoricoPanel'
import MensagensVolumePanel from '../components/Dashboard/widgets/MensagensVolumePanel'
import EvolucaoAnualPanel from '../components/Dashboard/widgets/EvolucaoAnualPanel'
import ScoreFaixasPanel from '../components/Dashboard/widgets/ScoreFaixasPanel'
import LeadDrillDrawer from '../components/Dashboard/widgets/LeadDrillDrawer'
import NotificacoesActionCard from '../components/Dashboard/widgets/NotificacoesActionCard'
import NovoLeadsCard from '../components/Dashboard/widgets/NovoLeadsCard'
import ConversaoChart from '../components/Dashboard/widgets/ConversaoChart'

// Dashboard — shared (primitivos)
import InfoTooltip from '../components/Dashboard/shared/InfoTooltip'
import SectionHeader from '../components/Dashboard/shared/SectionHeader'

// Dashboard — raiz (componentes standalone)
import BrazilMap from '../components/Dashboard/BrazilMap'
import HeatmapHour from '../components/Dashboard/HeatmapHour'
import { ComparativoNumeros } from '../components/Dashboard/ComparativoNumeros'

// Dashboard — types/utils
import type { LeadDrillFilter } from '../components/Dashboard/types'
import { defaultRange } from '../components/Dashboard/utils'

// Types globais
import { Mensagem, Notificacao } from '../types'

// UI components
import { DateRangePicker, DateRange } from '../components/DateRangePicker'
import ExportPngButton from '../components/ui/ExportPngButton'
import OpenActions from '../components/ui/OpenActions'
import { KPICardSkeleton } from '../components/ui/skeletons'

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { selectedTenant, selectedNumero, setSelectedNumero } = useTenantStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const exportRef = useRef<HTMLDivElement>(null)
  const [dateRange, setDateRange] = useState<DateRange | null>(defaultRange)
  const [objecoesSomenteNaoConv, setObjecoesSomenteNaoConv] = useState(false)
  const [evolucaoAno, setEvolucaoAno] = useState<number>(new Date().getFullYear())
  const [evolucaoAgruparPor, setEvolucaoAgruparPor] = useState<'temperatura' | 'etapa'>('temperatura')
  const [openLead, setOpenLead] = useState<LeadRecenteItem | null>(null)
  const [drill, setDrill] = useState<{ title: string; filter: LeadDrillFilter } | null>(null)

  // ── Notificações: abrir modal ao clicar no sino ──────────────────────────────
  const {
    notifications: bellNotifs,
    pendingLead,
    clearPendingLead,
    isRead: isBellRead,
    isDismissed: isBellDismissed,
  } = useNotificationStore()

  useEffect(() => {
    if (!pendingLead || !selectedTenant) return
    const lead: LeadRecenteItem = {
      id: pendingLead.id,
      nome: pendingLead.nome ?? null,
      whatsapp: pendingLead.whatsapp,
      temperatura: null,
      score: null,
      etapa_funil: null,
      created_at: null,
    }
    queryClient.prefetchQuery({
      queryKey: ['dashboard-lead-detalhe', selectedTenant.id, lead.id],
      queryFn: () => conversasApi.getLeadDetalhe(selectedTenant.id, lead.id),
      staleTime: 60_000,
    })
    queryClient.prefetchQuery({
      queryKey: ['dashboard-lead-mensagens', selectedTenant.id, lead.id],
      queryFn: () => conversasApi.getMessages(selectedTenant.id, lead.id),
      staleTime: 30_000,
    })
    setOpenLead(lead)
    clearPendingLead()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLead])

  // Dashboard sempre precisa de um período; caso venha null usa o range padrão.
  const effectiveRange: DateRange = dateRange ?? defaultRange()
  const periodoParams: PeriodoParams = useMemo(() => ({
    data_inicio: format(effectiveRange.inicio, 'yyyy-MM-dd'),
    data_fim: format(effectiveRange.fim, 'yyyy-MM-dd'),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [dateRange])

  // Parâmetros com filtro de número — passado para todos os endpoints do dashboard
  const filtroParams = useMemo(() => ({
    ...periodoParams,
    ...(selectedNumero ? { telefone_bot: selectedNumero.numero } : {}),
  }), [periodoParams, selectedNumero])

  const { data: catalogo } = useQuery({
    queryKey: ['dashboard-catalogo', selectedTenant?.id, selectedTenant?.nicho],
    queryFn: () => dashboardApi.getCatalogo(selectedTenant?.nicho, selectedTenant?.id),
    enabled: !!selectedTenant,
    staleTime: 300_000,
  })

  const periodoLabel = useMemo(() => {
    const ini = format(effectiveRange.inicio, 'dd/MM/yyyy', { locale: ptBR })
    const fim = format(effectiveRange.fim, 'dd/MM/yyyy', { locale: ptBR })
    return `Período: ${ini} — ${fim}`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange])

  const { data: kpis, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['dashboard-kpis', selectedTenant?.id, filtroParams],
    queryFn: () => dashboardApi.getKpis(selectedTenant!.id, filtroParams),
    enabled: !!selectedTenant,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const descricaoMap = useMemo(() => {
    const map: Record<string, string | undefined> = {}
    catalogo?.forEach(k => {
      if (k.descricao) map[k.slug] = k.descricao
    })
    return map
  }, [catalogo])

  const kpisEnriched = useMemo(() => {
    if (!kpis) return undefined
    return kpis.map(k => ({
      ...k,
      descricao: k.descricao ?? descricaoMap[k.slug],
    }))
  }, [kpis, descricaoMap])

  const { data: temperatura } = useQuery({
    queryKey: ['dashboard-temperatura', selectedTenant?.id, filtroParams],
    queryFn: () => dashboardApi.getTemperatura(selectedTenant!.id, filtroParams),
    enabled: !!selectedTenant,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const { data: historico } = useQuery({
    queryKey: ['dashboard-historico', selectedTenant?.id, filtroParams],
    queryFn: () => dashboardApi.getHistorico(selectedTenant!.id, filtroParams),
    enabled: !!selectedTenant,
    staleTime: 60_000,
  })

  const { data: funil } = useQuery({
    queryKey: ['dashboard-funil', selectedTenant?.id, filtroParams],
    queryFn: () => getFunil(selectedTenant!.id, filtroParams),
    enabled: !!selectedTenant,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const { data: objecoes } = useQuery({
    queryKey: ['dashboard-objecoes', selectedTenant?.id, filtroParams, objecoesSomenteNaoConv],
    queryFn: () => getObjecoes(selectedTenant!.id, {
      ...filtroParams,
      somente_sem_conversao: objecoesSomenteNaoConv,
    }),
    enabled: !!selectedTenant,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const { data: horario } = useQuery({
    queryKey: ['dashboard-horario', selectedTenant?.id, filtroParams],
    queryFn: () => getHorario(selectedTenant!.id, filtroParams),
    enabled: !!selectedTenant,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const { data: horarioRespostas } = useQuery({
    queryKey: ['dashboard-horario-respostas', selectedTenant?.id, filtroParams],
    queryFn: () => getHorarioRespostas(selectedTenant!.id, filtroParams),
    enabled: !!selectedTenant,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const { data: horarioLeads } = useQuery({
    queryKey: ['dashboard-horario-leads', selectedTenant?.id, filtroParams],
    queryFn: () => getHorarioLeads(selectedTenant!.id, filtroParams),
    enabled: !!selectedTenant,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const { data: sentimentoHistorico } = useQuery({
    queryKey: ['dashboard-sentimento-historico', selectedTenant?.id, filtroParams],
    queryFn: () => getSentimentoHistorico(selectedTenant!.id, filtroParams),
    enabled: !!selectedTenant,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const { data: mensagensVolume } = useQuery({
    queryKey: ['dashboard-mensagens-volume', selectedTenant?.id, filtroParams],
    queryFn: () => getMensagensVolume(selectedTenant!.id, filtroParams),
    enabled: !!selectedTenant,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const { data: evolucaoAnual, isLoading: evolucaoLoading } = useQuery({
    queryKey: ['dashboard-evolucao-anual', selectedTenant?.id, evolucaoAno, evolucaoAgruparPor],
    queryFn: () => getEvolucaoAnual(selectedTenant!.id, evolucaoAno, evolucaoAgruparPor),
    enabled: !!selectedTenant,
    staleTime: 60_000,
  })

  const { data: leadsRecentes } = useQuery({
    queryKey: ['dashboard-leads-recentes', selectedTenant?.id, filtroParams],
    queryFn: () => getLeadsRecentes(selectedTenant!.id, filtroParams),
    enabled: !!selectedTenant,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const { data: modalLead } = useQuery({
    queryKey: ['dashboard-lead-detalhe', selectedTenant?.id, openLead?.id],
    queryFn: () => conversasApi.getLeadDetalhe(selectedTenant!.id, openLead!.id),
    enabled: !!selectedTenant && !!openLead,
    staleTime: 60_000,
  })

  const { data: modalMsgs } = useQuery({
    queryKey: ['dashboard-lead-mensagens', selectedTenant?.id, openLead?.id],
    queryFn: () => conversasApi.getMessages(selectedTenant!.id, openLead!.id),
    enabled: !!selectedTenant && !!openLead,
    staleTime: 30_000,
  })

  const { data: diaSemana } = useQuery({
    queryKey: ['dashboard-dia-semana', selectedTenant?.id, filtroParams],
    queryFn: () => getDiaSemana(selectedTenant!.id, filtroParams),
    enabled: !!selectedTenant,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const { data: estadoDDD } = useQuery({
    queryKey: ['dashboard-estado-ddd', selectedTenant?.id, filtroParams],
    queryFn: () => getEstadoDDD(selectedTenant!.id, filtroParams),
    enabled: !!selectedTenant,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const { data: scoreFaixas } = useQuery({
    queryKey: ['dashboard-score-faixas', selectedTenant?.id, filtroParams],
    queryFn: () => getScoreFaixas(selectedTenant!.id, filtroParams),
    enabled: !!selectedTenant,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const { data: allWidgets = [] } = useQuery({
    queryKey: ['widgets', selectedTenant?.id],
    queryFn: () => getWidgets(selectedTenant!.id),
    enabled: !!selectedTenant,
  })
  const widgetsAtivos = allWidgets.filter((w) => w.ativo)

  // Busca números do tenant para o seletor
  const { data: numerosDoTenant = [] } = useQuery({
    queryKey: ['numeros', selectedTenant?.id],
    queryFn: () => api.get(`/tenants/${selectedTenant!.id}/numeros`).then(r => r.data),
    enabled: !!selectedTenant,
  })

  // Comparativo — só ativo quando há 2+ números
  const { data: comparativoData = [], isLoading: comparativoLoading } = useQuery({
    queryKey: ['comparativo-numeros', selectedTenant?.id, periodoParams],
    queryFn: () => getComparativoNumeros(selectedTenant!.id, periodoParams),
    enabled: !!selectedTenant && numerosDoTenant.length >= 2,
  })

  // Slugs que têm painel dedicado — não exibir como KPI card simples
  const SLUGS_COM_PAINEL = new Set([
    'dia_semana_predominante',
    'regiao_predominante',
    'estado_predominante',
    'score_medio',
  ])

  // Group KPIs by category preserving order within each group (excluindo slugs com painel dedicado)
  const kpisByCategory = useMemo(() => {
    if (!kpisEnriched) return {}
    const grouped: Record<string, KpiResult[]> = {}
    for (const kpi of kpisEnriched) {
      if (SLUGS_COM_PAINEL.has(kpi.slug)) continue
      const cat = kpi.categoria_kpi ?? 'outros'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(kpi)
    }
    return grouped
  }, [kpisEnriched])

  // Categorias com seção própria no dashboard — não renderizar no bloco genérico
  const CATEGORY_ORDER    = ['analise', 'operacional']
  const EXCLUDED_CATS     = new Set(['leads', 'conversao'])
  const orderedCategories = useMemo(() => {
    const known = CATEGORY_ORDER.filter(c => kpisByCategory[c]?.length)
    const extra = Object.keys(kpisByCategory).filter(
      c => !CATEGORY_ORDER.includes(c) && !EXCLUDED_CATS.has(c)
    )
    return [...known, ...extra]
  }, [kpisByCategory])

  if (!selectedTenant) {
    return (
      <EmptyState
        variant="info"
        icon={Users}
        title="Selecione um tenant no topo para ver o dashboard"
      />
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-400 mb-2">Erro ao carregar KPIs</p>
          <button onClick={() => refetch()} className="text-sm text-blue-400 hover:text-blue-300">
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  const handleLeadClick = (lead: LeadRecenteItem) => {
    if (selectedTenant?.id) {
      queryClient.prefetchQuery({
        queryKey: ['dashboard-lead-detalhe', selectedTenant.id, lead.id],
        queryFn: () => conversasApi.getLeadDetalhe(selectedTenant.id, lead.id),
        staleTime: 60_000,
      })
      queryClient.prefetchQuery({
        queryKey: ['dashboard-lead-mensagens', selectedTenant.id, lead.id],
        queryFn: () => conversasApi.getMessages(selectedTenant.id, lead.id),
        staleTime: 30_000,
      })
    }
    setOpenLead(lead)
  }

  const handleNotifClick = (n: Notificacao) => {
    handleLeadClick({
      id: n.lead_id,
      nome: n.lead_nome ?? null,
      whatsapp: n.lead_whatsapp,
      temperatura: null,
      score: null,
      etapa_funil: null,
      created_at: null,
    })
  }

  return (
    <>
    {/* `key` força remount ao trocar de tenant — dispara animate-fade-in do wrapper */}
    <div key={selectedTenant.id} ref={exportRef} className="space-y-5 animate-fade-in">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">{selectedTenant.nome}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {selectedTenant.nicho ?? 'Dashboard'} · {selectedTenant.timezone}
          </p>
        </div>
        <div className="flex items-center gap-2" data-export-skip="1">
          {isFetching && !isLoading && <Loader2 size={14} className="animate-spin text-blue-400" />}
          <ExportPngButton
            targetRef={exportRef}
            filename={`dashboard-${selectedTenant.slug ?? selectedTenant.nome}`}
            watermark="Visão Comercial"
            watermarkSub={`${selectedTenant.nome} · ${periodoLabel.replace(/^Período:\s*/, '')}`}
          />
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Atualizar"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => navigate('/settings/dashboard')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <Settings size={14} />
            Configurar KPIs
          </button>
        </div>
      </div>

      {/* ── DateRangePicker + Alertas ─────────────────────────────── */}
      <DateRangePicker value={dateRange} onChange={setDateRange} />

      {/* Seletor de número */}
      {numerosDoTenant.length >= 2 && (
        <div className="flex items-center gap-2">
          <Phone size={14} style={{ color: 'var(--text-2)' }} />
          <select
            value={selectedNumero?.id ?? ''}
            onChange={e => {
              const found = numerosDoTenant.find((n: any) => n.id === e.target.value)
              setSelectedNumero(found ?? null)
            }}
            className="text-sm rounded-lg px-3 py-2 outline-none"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-1)',
            }}
          >
            <option value="">Todos os números</option>
            {numerosDoTenant.map((n: any) => (
              <option key={n.id} value={n.id}>
                {n.nome || n.numero}
              </option>
            ))}
          </select>
        </div>
      )}

      <AlertCardsRow kpis={kpisEnriched} />

      {/* ══════════════════════════════════════════════════════════════
          VISÃO GERAL — Top-8 KPIs em strip compacto
          ══════════════════════════════════════════════════════════════ */}
      {isLoading ? (
        <div className="space-y-4">
          <SectionHeader label="Visão Geral" color="#3b82f6" />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => <KPICardSkeleton key={i} />)}
          </div>
        </div>
      ) : kpisEnriched && kpisEnriched.length > 0 ? (
        <div className="space-y-2">
          <SectionHeader label="Visão Geral" color="#3b82f6" />
          <TopKpiStrip
            kpis={kpisEnriched ?? []}
            sparkData={historico}
            extraCard={
              <>
                <NotificacoesActionCard
                  notifications={bellNotifs}
                  isRead={isBellRead}
                  isDismissed={isBellDismissed}
                  onClickNotif={handleNotifClick}
                />
                <NovoLeadsCard
                  leads={leadsRecentes}
                  onClickLead={handleLeadClick}
                />
              </>
            }
            onDrill={(kpi) => setDrill({
              title: kpi.nome,
              filter: { slug: kpi.slug, data_inicio: periodoParams.data_inicio, data_fim: periodoParams.data_fim },
            })}
          />
        </div>
      ) : (
        <div className="card-surface">
          <EmptyState
            variant="empty"
            title="Seu dashboard está vazio"
            description="Nenhum KPI configurado ainda"
            action={{
              label: 'Configurar agora →',
              onClick: () => navigate('/settings/dashboard'),
              variant: 'primary',
            }}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ANÁLISE TEMPORAL — Histórico + Temperatura (Donut)
          ══════════════════════════════════════════════════════════════ */}
      <div className="space-y-2">
        <SectionHeader label="Análise Temporal" color="#22c55e" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            {historico && historico.length > 0 ? (
              <HistoricoChart data={historico} label="Novos Leads por Dia" />
            ) : (
              <div className="card-surface p-8 flex items-center justify-center" style={{ minHeight: 140 }}>
                <p className="text-gray-600 text-sm">Sem dados de histórico para o período</p>
              </div>
            )}
          </div>
          <TemperaturaBarPanel
            data={temperatura}
            onSelect={(temp) => setDrill({
              title: `Temperatura: ${temp}`,
              filter: { temperatura: temp, data_inicio: periodoParams.data_inicio, data_fim: periodoParams.data_fim },
            })}
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          QUALIFICAÇÃO & OPERAÇÃO — Funil + Horário
          ══════════════════════════════════════════════════════════════ */}
      <div className="space-y-2">
        <SectionHeader label="Qualificação & Operação" color="#0e7490" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <FunilPanel
            data={funil}
            onSelect={(etapa) => setDrill({
              title: `Etapa: ${etapa}`,
              filter: { etapa, data_inicio: periodoParams.data_inicio, data_fim: periodoParams.data_fim },
            })}
          />
          <HorarioRespostasPanel data={horarioRespostas} title="Horário de Respostas" tooltip="Distribuição por hora do dia das mensagens enviadas pelo agente (IA). Identifica os picos de atendimento automático." />
          <HorarioRespostasPanel data={horarioLeads} title="Horário de Mensagens dos Leads" tooltip="Distribuição por hora do dia das mensagens enviadas pelos leads. Indica os momentos em que os clientes mais interagem." />
        </div>

        {/* Heatmap compacto — leitura rápida dos picos sem eixo cartesiano */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card-surface p-5">
            <div className="flex items-center gap-1.5 mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Heatmap — Respostas IA</p>
              <InfoTooltip text="Intensidade de atividade da IA por hora do dia. Células mais escuras indicam maior volume. Leitura rápida para identificar picos sem gráfico cartesiano." />
            </div>
            <HeatmapHour data={horarioRespostas} color="#f59e0b" />
          </div>
          <div className="card-surface p-5">
            <div className="flex items-center gap-1.5 mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Heatmap — Mensagens dos Leads</p>
              <InfoTooltip text="Intensidade de interação dos leads por hora do dia. Use para decidir janelas ideais de campanha e disponibilidade humana." />
            </div>
            <HeatmapHour data={horarioLeads} color="#3b5bdb" />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          DISTRIBUIÇÃO — Dia da semana + Estado via DDD
          ══════════════════════════════════════════════════════════════ */}
      <div className="space-y-2">
        <SectionHeader label="Distribuição" color="#0ea5e9" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DiaSemanaPanel data={diaSemana} />
          <BrazilMap
            data={estadoDDD}
            onClickEstado={(item) => setDrill({
              title: `Leads — ${item.nome} (${item.sigla})`,
              filter: { sigla: item.sigla, data_inicio: periodoParams.data_inicio, data_fim: periodoParams.data_fim },
            })}
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SCORE DE QUALIFICAÇÃO
          ══════════════════════════════════════════════════════════════ */}
      <div className="space-y-2">
        <SectionHeader label="Score de Qualificação" color="#eab308" />
        <ScoreFaixasPanel
          data={scoreFaixas}
          clienteId={selectedTenant!.id}
          dataInicio={periodoParams.data_inicio}
          dataFim={periodoParams.data_fim}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════
          CONVERSÃO — Barras comparativas (atual vs anterior)
          ══════════════════════════════════════════════════════════════ */}
      {kpisByCategory['conversao']?.length > 0 && (
        <div className="space-y-2">
          <SectionHeader label="Conversão" color="#22c55e" />
          <ConversaoChart
            kpis={kpisByCategory['conversao']}
            onDrill={(kpi) => setDrill({
              title: kpi.nome,
              filter: { slug: kpi.slug, data_inicio: periodoParams.data_inicio, data_fim: periodoParams.data_fim },
            })}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MENSAGENS — Volume e automação
          ══════════════════════════════════════════════════════════════ */}
      <div className="space-y-2">
        <SectionHeader label="Mensagens" color="#f97316" />
        <MensagensVolumePanel data={mensagensVolume} />
      </div>

      {/* ══════════════════════════════════════════════════════════════
          VISÃO MACRO — Evolução Anual
          ══════════════════════════════════════════════════════════════ */}
      <div className="space-y-2">
        <SectionHeader label="Visão Macro" color="#f59e0b" />
        <EvolucaoAnualPanel
          data={evolucaoAnual}
          ano={evolucaoAno}
          onAnoChange={setEvolucaoAno}
          agruparPor={evolucaoAgruparPor}
          onAgruparPorChange={setEvolucaoAgruparPor}
          isLoading={evolucaoLoading}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════
          ANÁLISE QUALITATIVA — Objeções + Sentimento
          ══════════════════════════════════════════════════════════════ */}
      <div className="space-y-2">
        <SectionHeader label="Análise Qualitativa" color="#06b6d4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ObjecoesPanel
            data={objecoes}
            somenteNaoConvertidos={objecoesSomenteNaoConv}
            onToggle={setObjecoesSomenteNaoConv}
            periodoLabel={periodoLabel}
          />
          <SentimentoHistoricoPanel data={sentimentoHistorico} />
        </div>

        {/* ── Widgets Dinâmicos ─────────────────────────────────── */}
        {widgetsAtivos.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
            {widgetsAtivos.map((w) => (
              <DynamicWidgetCard
                key={w.id}
                widget={w}
                clienteId={selectedTenant!.id}
                periodoParams={periodoParams}
                onDrillItem={(campo, label, widgetLabel) => setDrill({
                  title: `${widgetLabel} — ${label}`,
                  filter: {
                    campo_filtro: campo,
                    valor_filtro: label,
                    data_inicio: periodoParams.data_inicio,
                    data_fim: periodoParams.data_fim,
                  },
                })}
              />
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          KPIs DETALHADOS — Agrupamento COMERCIAL por cluster
          (pulso → urgência → inteligência → conversão → perfil → operacional)
          ══════════════════════════════════════════════════════════════ */}
      {kpisEnriched && kpisEnriched.length > 0 && (
        <div className="space-y-6">
          {groupByCluster(kpisEnriched.filter(k => !SLUGS_COM_PAINEL.has(k.slug))).map(({ cluster, meta, kpis }) => (
            <ClusterSection
              key={cluster}
              meta={meta}
              kpis={kpis}
              sparkData={historico}
              onDrill={(kpi) => setDrill({
                title: kpi.nome,
                filter: { slug: kpi.slug, data_inicio: periodoParams.data_inicio, data_fim: periodoParams.data_fim },
              })}
            />
          ))}
        </div>
      )}

      {/* Comparativo de Números — visível apenas quando há 2+ números */}
      {numerosDoTenant.length >= 2 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#087f7c20' }}>
              <Phone size={16} style={{ color: '#087f7c' }} />
            </div>
            <div>
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                Comparativo por Número
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-2)' }}>
                Desempenho individual de cada número WhatsApp
              </p>
            </div>
          </div>
          <ComparativoNumeros data={comparativoData} isLoading={comparativoLoading} />
        </section>
      )}

      {/* ── Agent info ──────────────────────────────────────────────── */}
      {selectedTenant.nome_agente && (
        <div className="card-surface p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Agente</h3>
          <p className="text-lg font-medium text-white">{selectedTenant.nome_agente}</p>
        </div>
      )}
    </div>

    {/* Conversa modal */}
    {openLead && (
      <>
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setOpenLead(null)} />
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="w-full max-w-4xl max-h-[80vh] rounded-2xl shadow-xl overflow-hidden flex flex-col"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div className="min-w-0">
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>Conversa do lead</p>
                <p className="text-lg font-semibold truncate" style={{ color: 'var(--text-1)' }}>
                  {openLead.nome || openLead.whatsapp}
                </p>
                <OpenActions
                  leadId={openLead.id}
                  excludeCurrent="dashboard"
                  className="mt-1.5"
                />
              </div>
              <button
                onClick={() => setOpenLead(null)}
                className="p-1 rounded-lg transition-colors flex-shrink-0 ml-3"
                style={{ color: 'var(--text-3)' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Chat bubbles */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: 'var(--bg-card)' }}>
                {modalMsgs?.length
                  ? modalMsgs.map((m: Mensagem) => {
                      const isOut = m.direcao === 'saida'
                      return (
                        <div key={m.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className="max-w-[75%] rounded-2xl px-3 py-2 text-sm"
                            style={
                              isOut
                                ? { background: '#3b5bdb', color: '#ffffff' }
                                : { background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-1)' }
                            }
                          >
                            <p className="whitespace-pre-wrap break-words">{m.conteudo || m.tipo}</p>
                            <p
                              className="text-[10px] text-right mt-1"
                              style={{ color: isOut ? 'rgba(255,255,255,0.6)' : 'var(--text-3)' }}
                            >
                              {format(new Date(m.enviada_em), 'dd/MM HH:mm')}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  : <p className="text-sm" style={{ color: 'var(--text-3)' }}>Nenhuma mensagem</p>}
              </div>

              {/* Insights sidebar */}
              <div
                className="w-80 p-4 overflow-y-auto"
                style={{ borderLeft: '1px solid var(--border)' }}
              >
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-1)' }}>Insights</p>
                {modalLead ? (
                  <div className="space-y-2 text-sm" style={{ color: 'var(--text-1)' }}>
                    <div><span style={{ color: 'var(--text-3)' }}>Temperatura: </span>{modalLead.temperatura || '—'}</div>
                    <div><span style={{ color: 'var(--text-3)' }}>Etapa: </span>{modalLead.etapa_funil || '—'}</div>
                    <div><span style={{ color: 'var(--text-3)' }}>Score: </span>{modalLead.score != null ? modalLead.score.toFixed(1) : '—'}</div>
                    {modalLead.analise?.intencao && (
                      <div><span style={{ color: 'var(--text-3)' }}>Intenção: </span>{modalLead.analise.intencao}</div>
                    )}
                    {modalLead.analise?.sentimento && (
                      <div><span style={{ color: 'var(--text-3)' }}>Sentimento: </span>{modalLead.analise.sentimento}</div>
                    )}
                    {modalLead.analise?.resumo_curto && (
                      <div className="pt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Resumo</p>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
                          {modalLead.analise.resumo_curto}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-3)' }}>Carregando...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    )}
    {drill && selectedTenant && (
      <LeadDrillDrawer
        title={drill.title}
        clienteId={selectedTenant.id}
        filter={drill.filter}
        onClose={() => setDrill(null)}
        onClickLead={(lead) => {
          setDrill(null)
          handleLeadClick(lead as unknown as LeadRecenteItem)
        }}
      />
    )}
    </>
  )
}
