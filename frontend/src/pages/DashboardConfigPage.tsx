import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dashboardApi, KpiCatalogo, KpiSelecao, getNichoCampos, getCamposWidget, updateNichoCampos, CampoDefinicao, getWidgets, updateWidget, deleteWidget, type AnaliseWidgetOut } from '../api/dashboard'
import WidgetBuilder from '../components/Dashboard/WidgetBuilder'
import { useTenantStore } from '../store/tenantStore'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Save, Loader2, Plus, Trash2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { EmptyState } from '../components/ds'

const TIPO_OPTS = ['string', 'number', 'boolean', 'date', 'select'] as const

function CamposSection({
  titulo,
  descricao,
  campos,
  onRemove,
  showAdd,
  onToggleAdd,
  newCampo,
  onNewCampoChange,
  onAdd,
}: {
  titulo: string
  descricao: string
  campos: CampoDefinicao[]
  onRemove: (nome: string) => void
  showAdd: boolean
  onToggleAdd: () => void
  newCampo: Partial<CampoDefinicao>
  onNewCampoChange: (c: Partial<CampoDefinicao>) => void
  onAdd: () => void
}) {
  const totalCampos = campos.length
  const MAX_CAMPOS = 8

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-200">{titulo}</p>
          <p className="text-xs text-gray-500 mt-0.5">{descricao}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-1.5 py-0.5 rounded font-bold"
            style={{
              background: totalCampos >= MAX_CAMPOS ? 'rgba(239,68,68,0.1)' : 'var(--bg-elevated)',
              color: totalCampos >= MAX_CAMPOS ? '#f87171' : 'var(--text-3)',
              border: `1px solid ${totalCampos >= MAX_CAMPOS ? 'rgba(239,68,68,0.25)' : 'var(--border-subtle)'}`,
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {totalCampos}/{MAX_CAMPOS}
          </span>
          {totalCampos < MAX_CAMPOS && (
            <button
              onClick={onToggleAdd}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: 'rgba(11,150,146,0.08)', color: '#25c8bd', border: '1px solid rgba(11,150,146,0.2)' }}
            >
              <Plus size={11} />
              Adicionar
            </button>
          )}
        </div>
      </div>

      {/* Lista de campos */}
      {campos.length === 0 ? (
        <p className="text-xs text-gray-600 py-2 text-center">Nenhum campo configurado</p>
      ) : (
        <div className="space-y-1.5">
          {campos.map((campo) => (
            <div
              key={campo.nome}
              className="flex items-center gap-3 px-3 py-2 rounded-lg"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex-1 min-w-0">
                <div>
                  <span className="text-xs font-medium text-gray-200">{campo.label}</span>
                  <span className="text-xs text-gray-600 ml-2" style={{ fontFamily: 'ui-monospace, monospace' }}>
                    {campo.nome}
                  </span>
                </div>
                {campo.descricao && (
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-3)' }}>{campo.descricao}</p>
                )}
              </div>
              <span
                className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ background: 'var(--bg-card)', color: 'var(--text-3)', border: '1px solid var(--border-subtle)' }}
              >
                {campo.tipo}
              </span>
              <button
                onClick={() => onRemove(campo.nome)}
                className="p-1 rounded text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Inline add form */}
      {showAdd && (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            placeholder="nome_campo"
            value={newCampo.nome ?? ''}
            onChange={(e) => onNewCampoChange({ ...newCampo, nome: e.target.value })}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs text-gray-200 placeholder-gray-600"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          />
          <input
            type="text"
            placeholder="Label exibido"
            value={newCampo.label ?? ''}
            onChange={(e) => onNewCampoChange({ ...newCampo, label: e.target.value })}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs text-gray-200 placeholder-gray-600"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          />
          <input
            type="text"
            placeholder="Descrição (ex: qual modelo o lead mencionou)"
            value={newCampo.descricao ?? ''}
            onChange={(e) => onNewCampoChange({ ...newCampo, descricao: e.target.value })}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs text-gray-200 placeholder-gray-600"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          />
          <select
            value={newCampo.tipo ?? 'string'}
            onChange={(e) => onNewCampoChange({ ...newCampo, tipo: e.target.value as CampoDefinicao['tipo'] })}
            className="px-2 py-1.5 rounded-lg text-xs text-gray-200"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          >
            {TIPO_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            onClick={onAdd}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white transition-colors flex-shrink-0"
          >
            OK
          </button>
        </div>
      )}
    </div>
  )
}

export default function DashboardConfigPage() {
  const { selectedTenant } = useTenantStore()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { tenantRole } = useTenantStore()
  const isAdmin = tenantRole === 'admin' || tenantRole === 'manager'

  const [selectedSlugs, setSelectedSlugs] = useState<KpiSelecao[]>([])
  const [dirty, setDirty] = useState(false)
  const [widgetBuilderOpen, setWidgetBuilderOpen] = useState(false)
  const [editingWidget, setEditingWidget] = useState<AnaliseWidgetOut | null>(null)

  // Nicho campos state
  const [camposKpi, setCamposKpi] = useState<CampoDefinicao[]>([])
  const [camposAnalise, setCamposAnalise] = useState<CampoDefinicao[]>([])
  const [camposDirty, setCamposDirty] = useState(false)
  const [newCampoKpi, setNewCampoKpi] = useState<Partial<CampoDefinicao>>({ tipo: 'string' })
  const [newCampoAnalise, setNewCampoAnalise] = useState<Partial<CampoDefinicao>>({ tipo: 'string' })
  const [showAddKpi, setShowAddKpi] = useState(false)
  const [showAddAnalise, setShowAddAnalise] = useState(false)

  const { data: catalogo = [] } = useQuery({
    queryKey: ['kpi-catalogo', selectedTenant?.nicho, selectedTenant?.id],
    queryFn: () => dashboardApi.getCatalogo(selectedTenant?.nicho, selectedTenant?.id),
    enabled: !!selectedTenant,
  })

  const { data: config } = useQuery({
    queryKey: ['dashboard-config', selectedTenant?.id],
    queryFn: () => dashboardApi.getConfig(selectedTenant!.id),
    enabled: !!selectedTenant,
  })

  const { data: nichoCampos } = useQuery({
    queryKey: ['nicho-campos', selectedTenant?.id],
    queryFn: () => getNichoCampos(selectedTenant!.id),
    enabled: !!selectedTenant && isAdmin,
  })

  // Lista read-only dos campos para alimentar o select do WidgetBuilder.
  // Disponível para qualquer membro com acesso ao tenant (gestor/admin), sem gate de isAdmin.
  const { data: camposWidget } = useQuery({
    queryKey: ['campos-widget', selectedTenant?.id],
    queryFn: () => getCamposWidget(selectedTenant!.id),
    enabled: !!selectedTenant,
    staleTime: 5 * 60_000,
  })

  const { data: widgets = [], refetch: refetchWidgets } = useQuery({
    queryKey: ['widgets', selectedTenant?.id],
    queryFn: () => getWidgets(selectedTenant!.id),
    enabled: !!selectedTenant,
  })

  const tenantId = selectedTenant?.id
  useEffect(() => {
    setSelectedSlugs([])
    setDirty(false)
    setCamposKpi([])
    setCamposAnalise([])
    setCamposDirty(false)
  }, [tenantId])

  useEffect(() => {
    if (config?.kpis?.length) {
      setSelectedSlugs(config.kpis.map((k: KpiSelecao) => ({
        slug: k.slug,
        ordem: k.ordem ?? 0,
        visivel: k.visivel ?? true,
      })))
    }
  }, [config])

  useEffect(() => {
    if (nichoCampos) {
      setCamposKpi(nichoCampos.campos_kpi ?? [])
      setCamposAnalise(nichoCampos.campos_analise ?? [])
      setCamposDirty(false)
    }
  }, [nichoCampos])

  const saveMutation = useMutation({
    mutationFn: () => dashboardApi.updateConfig(selectedTenant!.id, selectedSlugs, 'grid'),
    onSuccess: () => {
      toast.success('Dashboard configurado!')
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
      qc.invalidateQueries({ queryKey: ['dashboard-config'] })
      setDirty(false)
    },
    onError: () => toast.error('Erro ao salvar configuração'),
  })

  const saveCamposMutation = useMutation({
    mutationFn: () =>
      updateNichoCampos(selectedTenant!.id, {
        campos_kpi: camposKpi,
        campos_analise: camposAnalise,
      }),
    onSuccess: () => {
      toast.success('Campos de extração salvos!')
      qc.invalidateQueries({ queryKey: ['nicho-campos'] })
      setCamposDirty(false)
    },
    onError: () => toast.error('Erro ao salvar campos de extração'),
  })

  const toggleWidgetMutation = useMutation({
    mutationFn: ({ widgetId, ativo }: { widgetId: string; ativo: boolean }) =>
      updateWidget(selectedTenant!.id, widgetId, { ativo }),
    onSuccess: () => refetchWidgets(),
  })

  const deleteWidgetMutation = useMutation({
    mutationFn: ({ widgetId }: { widgetId: string }) =>
      deleteWidget(selectedTenant!.id, widgetId),
    onSuccess: () => { toast.success('Widget removido'); refetchWidgets() },
  })

  const addCampo = (tipo: 'kpi' | 'analise') => {
    const draft = tipo === 'kpi' ? newCampoKpi : newCampoAnalise
    if (!draft.nome?.trim() || !draft.label?.trim()) {
      toast.error('Preencha nome e label do campo')
      return
    }
    const campo: CampoDefinicao = {
      nome: draft.nome.trim().toLowerCase().replace(/\s+/g, '_'),
      tipo: (draft.tipo as CampoDefinicao['tipo']) || 'string',
      label: draft.label.trim(),
      obrigatorio: false,
      ...(draft.descricao?.trim() ? { descricao: draft.descricao.trim() } : {}),
    }
    if (tipo === 'kpi') {
      setCamposKpi(prev => [...prev, campo])
      setNewCampoKpi({ tipo: 'string' })
      setShowAddKpi(false)
    } else {
      setCamposAnalise(prev => [...prev, campo])
      setNewCampoAnalise({ tipo: 'string' })
      setShowAddAnalise(false)
    }
    setCamposDirty(true)
  }

  const removeCampo = (tipo: 'kpi' | 'analise', nome: string) => {
    if (tipo === 'kpi') setCamposKpi(prev => prev.filter(c => c.nome !== nome))
    else setCamposAnalise(prev => prev.filter(c => c.nome !== nome))
    setCamposDirty(true)
  }

  const toggleKpi = (slug: string) => {
    setDirty(true)
    setSelectedSlugs((prev) => {
      const exists = prev.find((s) => s.slug === slug)
      if (exists) return prev.filter((s) => s.slug !== slug)
      return [...prev, { slug, ordem: prev.length, visivel: true }]
    })
  }

  const isSelected = (slug: string) => selectedSlugs.some((s) => s.slug === slug)

  const grouped = catalogo.reduce<Record<string, KpiCatalogo[]>>((acc, kpi) => {
    const cat = kpi.categoria_kpi || 'outros'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(kpi)
    return acc
  }, {})

  const categoryLabels: Record<string, string> = {
    leads: 'Leads',
    conversao: 'Conversão',
    analise: 'Análise de Conversa',
    operacional: 'Operacional (Mensagens)',
    outros: 'Outros',
  }

  if (!selectedTenant) {
    return (
      <EmptyState
        variant="info"
        size="sm"
        title="Selecione uma empresa primeiro"
      />
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg text-gray-400 hover:text-white transition-colors"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="font-display text-xl font-bold text-white">Configurar Dashboard</h1>
            <p className="text-sm text-gray-500">Selecione os KPIs que deseja visualizar</p>
          </div>
        </div>

        <button
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            dirty
              ? 'bg-brand-600 hover:bg-brand-500 hover:shadow-glow-brand-md text-white'
              : 'text-gray-600 cursor-not-allowed'
          )}
          style={!dirty ? { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' } : undefined}
        >
          {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {/* Selected count banner */}
      <div
        className="rounded-xl px-4 py-3 flex items-center gap-3"
        style={{ background: 'rgba(11,150,146,0.06)', border: '1px solid rgba(11,150,146,0.15)' }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(11,150,146,0.15)', border: '1px solid rgba(11,150,146,0.25)' }}
        >
          <span className="text-sm font-bold text-brand-400">{selectedSlugs.length}</span>
        </div>
        <div>
          <p className="text-sm text-gray-300">
            <span className="text-brand-400 font-semibold">{selectedSlugs.length}</span> KPIs selecionados
          </p>
          <p className="text-xs text-gray-600">Clique nos cards abaixo para adicionar ou remover</p>
        </div>
      </div>

      {/* Campos de Extração por IA — apenas admin */}
      {isAdmin && (
        <div className="space-y-4">
          {/* Divisor */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs font-medium uppercase tracking-widest" style={{ fontFamily: 'ui-monospace, monospace', color: '#6b7280' }}>
              Campos de Extração por IA
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          {/* Explicação detalhada */}
          <div
            className="rounded-xl p-4 space-y-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            {/* Fluxo */}
            <div>
              <p className="text-xs font-semibold text-gray-300 mb-2">Como funciona</p>
              <div className="flex items-center gap-1.5 flex-wrap text-xs text-gray-500">
                <span className="px-2 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: '#58e2d8' }}>Conversa WhatsApp</span>
                <span>→</span>
                <span className="px-2 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>IA analisa</span>
                <span>→</span>
                <span className="px-2 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>extrai os campos abaixo</span>
                <span>→</span>
                <span className="px-2 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: '#34d399' }}>dashboard + widgets</span>
              </div>
            </div>

            {/* Dois tipos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg p-3 space-y-1" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-xs font-semibold text-gray-200">📊 KPIs de Extração</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Dados objetivos do negócio: valores numéricos, categorias fixas, booleanos. Alimentam os <strong className="text-gray-400">cards de KPI</strong> no topo do dashboard.
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-3)', fontFamily: 'ui-monospace, monospace' }}>
                  Ex: capital_disponivel · interesse_franquia · tem_ponto_comercial
                </p>
              </div>
              <div className="rounded-lg p-3 space-y-1" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-xs font-semibold text-gray-200">🔍 Campos de Análise</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Dados qualitativos e textuais: objeções, perfil de decisão, motivações. Alimentam os <strong className="text-gray-400">widgets de gráfico</strong> na seção Análise Qualitativa.
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-3)', fontFamily: 'ui-monospace, monospace' }}>
                  Ex: objecao_principal · perfil_decisao · motivo_interesse
                </p>
              </div>
            </div>

            {/* Tipos disponíveis */}
            <div>
              <p className="text-xs font-semibold text-gray-300 mb-2">Tipos de campo</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5">
                {[
                  { tipo: 'string', desc: 'Texto livre' },
                  { tipo: 'number', desc: 'Valor numérico' },
                  { tipo: 'boolean', desc: 'Sim / Não' },
                  { tipo: 'select', desc: 'Lista de opções' },
                  { tipo: 'date', desc: 'Data' },
                ].map(({ tipo, desc }) => (
                  <div key={tipo} className="rounded px-2 py-1.5 text-center" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                    <p className="text-xs font-medium text-gray-300" style={{ fontFamily: 'ui-monospace, monospace' }}>{tipo}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Aviso */}
            <div className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.18)' }}>
              <AlertTriangle size={13} className="text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-500 leading-relaxed">
                Alterações afetam todas as empresas do nicho <strong className="text-gray-400">{nichoCampos?.nicho ?? selectedTenant?.nicho}</strong>. Campos adicionados só valem para análises <strong className="text-gray-400">a partir da data de criação</strong> — conversas anteriores não são reprocessadas. Máximo de 8 campos por seção.
              </p>
            </div>
          </div>

          {/* campos_kpi */}
          <CamposSection
            titulo="KPIs de Extração"
            descricao="Dados numéricos e categóricos extraídos pela IA de cada conversa"
            campos={camposKpi}
            onRemove={(nome) => removeCampo('kpi', nome)}
            showAdd={showAddKpi}
            onToggleAdd={() => setShowAddKpi(v => !v)}
            newCampo={newCampoKpi}
            onNewCampoChange={setNewCampoKpi}
            onAdd={() => addCampo('kpi')}
          />

          {/* campos_analise */}
          <CamposSection
            titulo="Campos de Análise"
            descricao="Informações qualitativas extraídas das conversas"
            campos={camposAnalise}
            onRemove={(nome) => removeCampo('analise', nome)}
            showAdd={showAddAnalise}
            onToggleAdd={() => setShowAddAnalise(v => !v)}
            newCampo={newCampoAnalise}
            onNewCampoChange={setNewCampoAnalise}
            onAdd={() => addCampo('analise')}
          />

          {/* Salvar campos */}
          <div className="flex justify-end">
            <button
              onClick={() => saveCamposMutation.mutate()}
              disabled={!camposDirty || saveCamposMutation.isPending}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                camposDirty
                  ? 'bg-brand-600 hover:bg-brand-500 text-white'
                  : 'text-gray-600 cursor-not-allowed'
              )}
              style={!camposDirty ? { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' } : undefined}
            >
              {saveCamposMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saveCamposMutation.isPending ? 'Salvando...' : 'Salvar campos'}
            </button>
          </div>
        </div>
      )}

      {/* ── Widgets de Análise ─────────────────────────────────── */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Widgets de Análise</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Visualizações personalizadas na seção "Análise Qualitativa" do dashboard
            </p>
          </div>
          <button
            onClick={() => setWidgetBuilderOpen(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{
              background: 'rgba(11,150,146,0.12)',
              color: '#25c8bd',
              border: '1px solid rgba(11,150,146,0.25)',
            }}
          >
            + Novo Widget
          </button>
        </div>

        {widgets.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-4">Nenhum widget configurado</p>
        ) : (
          <div className="space-y-2">
            {widgets.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={w.ativo}
                    onChange={() =>
                      toggleWidgetMutation.mutate({ widgetId: w.id, ativo: !w.ativo })
                    }
                    className="cursor-pointer"
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{w.label}</p>
                    <p className="text-xs text-gray-500">
                      {w.tipo_grafico} · {w.operacao}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <button
                    onClick={() => setEditingWidget(w)}
                    className="text-xs px-2 py-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Remover widget?'))
                        deleteWidgetMutation.mutate({ widgetId: w.id })
                    }}
                    className="text-xs px-2 py-1 rounded text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WidgetBuilder modal */}
      {(widgetBuilderOpen || editingWidget) && (
        <WidgetBuilder
          clienteId={selectedTenant!.id}
          camposDisponiveis={[
            // Admin (que edita campos na seção "Campos do Nicho") vê a versão ao vivo;
            // gestor vê a versão read-only servida por /campos-widget.
            ...(nichoCampos?.campos_kpi ?? camposWidget?.campos_kpi ?? []),
            ...(nichoCampos?.campos_analise ?? camposWidget?.campos_analise ?? []),
          ]}
          widget={editingWidget ?? undefined}
          onSave={() => {
            setWidgetBuilderOpen(false)
            setEditingWidget(null)
            refetchWidgets()
          }}
          onClose={() => {
            setWidgetBuilderOpen(false)
            setEditingWidget(null)
          }}
        />
      )}

      {/* KPI Categories */}
      {Object.entries(grouped).map(([cat, kpis]) => (
        <div key={cat}>
          <div className="flex items-center gap-2 mb-3">
            <p
              className="text-xs font-medium uppercase tracking-widest"
              style={{ fontFamily: 'ui-monospace, monospace', color: '#6b7280' }}
            >
              {categoryLabels[cat] ?? cat}
            </p>
            <span
              className="text-xs px-1.5 py-0.5 rounded font-bold"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-3)', fontFamily: 'ui-monospace, monospace' }}
            >
              {kpis.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {kpis.map((kpi) => {
              const selected = isSelected(kpi.slug)
              return (
                <button
                  key={kpi.slug}
                  onClick={() => toggleKpi(kpi.slug)}
                  className="flex items-start gap-3 p-4 rounded-xl border text-left transition-all"
                  style={
                    selected
                      ? { background: 'rgba(11,150,146,0.08)', border: '1px solid rgba(11,150,146,0.35)' }
                      : { background: 'var(--bg-surface)', border: '1px solid var(--border)' }
                  }
                >
                  <div
                    className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors"
                    style={
                      selected
                        ? { background: 'var(--brand-500)', border: '1px solid #25c8bd' }
                        : { background: 'transparent', border: '1px solid var(--border-muted)' }
                    }
                  >
                    {selected && <Check size={11} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={clsx('text-sm font-medium', selected ? 'text-white' : 'text-gray-300')}>
                      {kpi.nome}
                    </p>
                    {kpi.descricao && (
                      <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{kpi.descricao}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--bg-card)', color: 'var(--text-3)', border: '1px solid var(--border-subtle)' }}
                      >
                        {kpi.tipo_calculo}
                      </span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--bg-card)', color: 'var(--text-3)', border: '1px solid var(--border-subtle)' }}
                      >
                        {kpi.formato}
                      </span>
                      {kpi.is_builtin && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(59,130,246,0.08)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
                        >
                          built-in
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
