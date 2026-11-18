import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Building2,
  TrendingUp,
  AlertTriangle,
  Flame,
  Clock,
  ArrowRight,
  ChevronRight,
} from 'lucide-react'
import { portfolioApi, type EmpresaPortfolio, type LeadQuente } from '../api/portfolio'
import { useTenantStore } from '../store/tenantStore'
import { useAuthStore } from '../store/authStore'
import { Pill, EmptyState } from '../components/ds'
import type { Tenant } from '../types'

/**
 * /portfolio — visão multi-empresa do gestor.
 *
 * Acesso: superadmin OU is_manager_multi=true.
 *
 * Estrutura:
 *   1. Header (saudação + total de empresas)
 *   2. KPIs agregados (4 cards: novos leads, oportunidades, urgência alta, tempo 1ª resposta)
 *   3. Grid de empresas (cards clicáveis com mini-stats)
 *   4. Top 10 leads quentes (cross-tenant, com badge da empresa)
 *
 * Click em empresa ou lead → seta selectedTenant + redireciona pro destino certo.
 */
export default function PortfolioPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { setSelectedTenant, setTenantRole } = useTenantStore()

  // Período padrão: últimos 30 dias (gestor olha "como tá agora", não histórico longo)
  const periodo = useMemo(() => {
    const hoje = new Date()
    const ha30 = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000)
    return {
      data_inicio: ha30.toISOString().slice(0, 10),
      data_fim: hoje.toISOString().slice(0, 10),
    }
  }, [])

  const empresasQ = useQuery({
    queryKey: ['portfolio', 'empresas'],
    queryFn: () => portfolioApi.empresas(),
    staleTime: 60_000,
  })

  const kpisQ = useQuery({
    queryKey: ['portfolio', 'kpis', periodo.data_inicio, periodo.data_fim],
    queryFn: () => portfolioApi.kpisAgregados(periodo),
    staleTime: 60_000,
  })

  const leadsQ = useQuery({
    queryKey: ['portfolio', 'leads-quentes'],
    queryFn: () => portfolioApi.leadsQuentes(10),
    staleTime: 60_000,
  })

  const empresas = empresasQ.data ?? []
  const kpis = kpisQ.data?.kpis ?? []
  const leads = leadsQ.data ?? []

  /** Troca tenant e redireciona — usado em click em empresa ou em lead. */
  function entrarNaEmpresa(emp: EmpresaPortfolio, destino = '/dashboard') {
    const tenant: Tenant = {
      id: emp.id,
      nome: emp.nome,
      slug: emp.slug,
      nicho: emp.nicho ?? undefined,
      timezone: 'America/Sao_Paulo',
      ativo: emp.ativo,
      created_at: '',
      updated_at: '',
    }
    setSelectedTenant(tenant)
    setTenantRole(emp.role)
    toast.success(`Você entrou em ${emp.nome}`, { duration: 2000 })
    navigate(destino)
  }

  function abrirConversa(lead: LeadQuente) {
    const emp = empresas.find((e) => e.id === lead.cliente_id)
    if (!emp) {
      toast.error('Empresa não encontrada')
      return
    }
    entrarNaEmpresa(emp, `/conversas?leadId=${lead.id}`)
  }

  if (empresasQ.isLoading) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 rounded bg-[var(--bg-elevated)] mb-2" />
          <div className="h-4 w-72 rounded bg-[var(--bg-elevated)] mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-[var(--bg-elevated)]" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (empresasQ.isError) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        <EmptyState
          variant="error"
          icon={AlertTriangle}
          title="Erro ao carregar portfolio"
          description="Verifique sua conexão e tente novamente"
          action={{ label: 'Tentar de novo', onClick: () => empresasQ.refetch(), variant: 'primary' }}
        />
      </div>
    )
  }

  if (empresas.length === 0) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        <EmptyState
          variant="info"
          icon={Building2}
          title="Você ainda não tem empresas"
          description="Aguarde um administrador atribuir acesso a uma empresa pra você."
        />
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-8">
      {/* ── Header ── */}
      <header>
        <h1 className="text-3xl font-bold text-[var(--text-1)]">
          Olá, {user?.nome?.split(' ')[0] ?? 'gestor'}
        </h1>
        <p className="text-sm text-[var(--text-3)] mt-1">
          Você gerencia <strong>{empresas.length}</strong>{' '}
          {empresas.length === 1 ? 'empresa' : 'empresas'} · últimos 30 dias
        </p>
      </header>

      {/* ── KPIs agregados ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-full" style={{ background: '#10E088' }} />
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#10E088' }}>
            Visão Consolidada
          </p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            · Total das suas {empresas.length} {empresas.length === 1 ? 'empresa' : 'empresas'}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpisQ.isLoading
            ? [0, 1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-[var(--bg-elevated)] animate-pulse" />
              ))
            : kpis.map((kpi) => (
                <div
                  key={kpi.slug}
                  className="rounded-2xl p-5"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--card-shadow)',
                  }}
                >
                  <p
                    className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: 'var(--text-3)' }}
                  >
                    {kpi.label}
                  </p>
                  <p
                    className="font-outfit font-bold"
                    style={{
                      fontSize: '2rem',
                      lineHeight: 1.1,
                      color: 'var(--text-1)',
                    }}
                  >
                    {kpi.agregado === null
                      ? '—'
                      : kpi.tipo === 'percent'
                        ? `${kpi.agregado.toFixed(1)}%`
                        : kpi.agregado.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>
                    {kpi.tipo_agregacao === 'sum' ? 'Soma das empresas' : kpi.tipo_agregacao === 'avg' ? 'Média entre empresas' : '—'}
                  </p>
                </div>
              ))}
        </div>
      </section>

      {/* ── Grid de empresas ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-full" style={{ background: '#0b9692' }} />
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0b9692' }}>
            Suas Empresas
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {empresas.map((emp) => (
            <button
              key={emp.id}
              onClick={() => entrarNaEmpresa(emp)}
              className="text-left rounded-2xl p-5 transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
                  style={{ background: 'var(--brand-glow)', color: 'var(--brand-500)' }}
                >
                  {emp.nome.trim().charAt(0).toUpperCase()}
                </div>
                <ChevronRight size={18} style={{ color: 'var(--text-3)' }} />
              </div>
              <h3 className="font-semibold text-[var(--text-1)] mb-1 truncate">
                {emp.nome.trim()}
              </h3>
              <div className="flex items-center gap-1.5 mb-4">
                {emp.nicho && (
                  <Pill tone="role:admin">{emp.nicho}</Pill>
                )}
                <Pill tone={emp.role === 'admin' ? 'role:admin' : emp.role === 'manager' ? 'role:manager' : 'role:viewer'}>
                  {emp.role}
                </Pill>
              </div>
              <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-2)' }}>
                <span className="flex items-center gap-1">
                  <TrendingUp size={14} /> {emp.total_leads_ativos} ativos
                </span>
                {emp.leads_urgencia_alta > 0 && (
                  <span className="flex items-center gap-1" style={{ color: '#ef4444' }}>
                    <Flame size={14} /> {emp.leads_urgencia_alta} urgentes
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Top leads quentes (cross-tenant) ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-full" style={{ background: '#ef4444' }} />
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ef4444' }}>
            Leads Mais Quentes
          </p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            · Top {leads.length} de todas as suas empresas
          </p>
        </div>

        {leadsQ.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-[var(--bg-elevated)] animate-pulse" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Nenhum lead com score nas suas empresas ainda.
          </p>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            {leads.map((lead, idx) => (
              <button
                key={lead.id}
                onClick={() => abrirConversa(lead)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--bg-elevated)] transition-colors text-left"
                style={{
                  borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    background:
                      lead.temperatura === 'alta'
                        ? '#ef4444'
                        : lead.temperatura === 'media'
                          ? '#f97316'
                          : 'var(--bg-elevated)',
                    color: lead.temperatura ? '#fff' : 'var(--text-2)',
                  }}
                >
                  {(lead.nome ?? lead.whatsapp).trim().charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-1)' }}>
                      {lead.nome ?? lead.whatsapp}
                    </span>
                    <Pill tone="status:active">{lead.cliente_nome.trim()}</Pill>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: 'var(--text-3)' }}>
                    {lead.score !== null && (
                      <span>Score {lead.score.toFixed(0)}</span>
                    )}
                    {lead.etapa_funil && <span>· {lead.etapa_funil}</span>}
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {new Date(lead.updated_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                <ArrowRight size={16} style={{ color: 'var(--text-3)' }} className="flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
