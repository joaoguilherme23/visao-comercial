import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Banknote,
  Brain,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Cpu,
  DollarSign,
  Hash,
  TrendingUp,
  AlertTriangle,
  Workflow,
  Flame,
} from 'lucide-react'
import { llmLogsApi, type LlmLogsFilters, type LlmTenantBreakdown } from '../api/llmLogs'
import { Pill, EmptyState } from '../components/ds'
import LlmDailyChart from '../components/Admin/LlmDailyChart'

/**
 * /admin/llm-logs — visão admin de consumo de tokens + custo das LLMs.
 *
 * Acesso: superadmin only (RequireSuperAdmin no App.tsx).
 *
 * Estrutura:
 *   1. Header: filtros (período, tenant, modelo, workflow) + câmbio aplicado
 *   2. 4 cards: gasto BRL / tokens total / chamadas / custo médio por call
 *   3. Breakdowns: por modelo, por tenant, por workflow
 *   4. Tabela paginada de chamadas individuais
 */
export default function LlmLogsPage() {
  // Período padrão: últimos 30 dias
  const defaultRange = useMemo(() => {
    const hoje = new Date()
    const ha30 = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000)
    return {
      data_inicio: ha30.toISOString().slice(0, 10),
      data_fim: hoje.toISOString().slice(0, 10),
    }
  }, [])

  const [filters, setFilters] = useState<LlmLogsFilters>(defaultRange)
  const [pageOffset, setPageOffset] = useState(0)
  const PAGE_SIZE = 30

  const summaryQ = useQuery({
    queryKey: ['llm-logs', 'summary', filters],
    queryFn: () => llmLogsApi.summary(filters),
    staleTime: 30_000,
  })

  const itemsQ = useQuery({
    queryKey: ['llm-logs', 'items', filters, pageOffset],
    queryFn: () =>
      llmLogsApi.items({ ...filters, limit: PAGE_SIZE, offset: pageOffset }),
    staleTime: 30_000,
  })

  const filtrosQ = useQuery({
    queryKey: ['llm-logs', 'filtros'],
    queryFn: () => llmLogsApi.filtros(),
    staleTime: 5 * 60_000,
  })

  const summary = summaryQ.data
  const items = itemsQ.data
  const filtros = filtrosQ.data

  function setFilter<K extends keyof LlmLogsFilters>(key: K, value: LlmLogsFilters[K]) {
    setFilters((s) => ({ ...s, [key]: value || undefined }))
    setPageOffset(0)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <header>
        <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
          <Brain size={18} style={{ color: 'var(--brand-500)' }} />
          Logs LLM
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
          Consumo de tokens e custo estimado das chamadas de IA.
          {summary && (
            <>
              {' · '}
              Câmbio aplicado: <strong>R$ {summary.usd_to_brl_rate.toFixed(2)}</strong>/USD
            </>
          )}
        </p>
        {summary?.has_pricing_gaps && (
          <div
            className="mt-2 rounded-lg p-2 text-xs flex items-start gap-2"
            style={{
              background: 'rgba(234,179,8,0.1)',
              border: '1px solid rgba(234,179,8,0.3)',
              color: 'var(--text-2)',
            }}
          >
            <AlertTriangle size={13} style={{ color: '#facc15' }} className="flex-shrink-0 mt-0.5" />
            <span>
              Algum modelo está sem pricing cadastrado. Verifique{' '}
              <code style={{ color: 'var(--text-1)' }}>llm_pricing.py</code> e adicione o prefix.
            </span>
          </div>
        )}

        {/* Banner: empresas que excederam limite hoje */}
        {summary && summary.tenants_over_budget_today > 0 && (
          <div
            className="mt-2 rounded-lg p-2 text-xs flex items-start gap-2"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: 'var(--text-2)',
            }}
          >
            <Flame size={13} style={{ color: '#ef4444' }} className="flex-shrink-0 mt-0.5" />
            <span>
              <strong style={{ color: '#ef4444' }}>
                {summary.tenants_over_budget_today}{' '}
                {summary.tenants_over_budget_today === 1 ? 'empresa excedeu' : 'empresas excederam'} o limite diário
              </strong>{' '}
              hoje. Veja "Por empresa" abaixo pra detalhes.
            </span>
          </div>
        )}
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <FieldDate
          label="Início"
          value={filters.data_inicio}
          onChange={(v) => setFilter('data_inicio', v)}
        />
        <FieldDate
          label="Fim"
          value={filters.data_fim}
          onChange={(v) => setFilter('data_fim', v)}
        />
        <FieldSelect
          label="Empresa"
          value={filters.cliente_id ?? ''}
          onChange={(v) => setFilter('cliente_id', v)}
          options={[
            { value: '', label: 'Todas' },
            ...(filtros?.tenants ?? []).map((t) => ({
              value: t.cliente_id,
              label: `${t.nome} (${t.count})`,
            })),
          ]}
        />
        <FieldSelect
          label="Modelo"
          value={filters.modelo ?? ''}
          onChange={(v) => setFilter('modelo', v)}
          options={[
            { value: '', label: 'Todos' },
            ...(filtros?.modelos ?? []).map((m) => ({
              value: m.value,
              label: `${m.value} (${m.count})`,
            })),
          ]}
        />
        <FieldSelect
          label="Workflow"
          value={filters.workflow ?? ''}
          onChange={(v) => setFilter('workflow', v)}
          options={[
            { value: '', label: 'Todos' },
            ...(filtros?.workflows ?? []).map((w) => ({
              value: w.value,
              label: `${w.value.slice(0, 40)} (${w.count})`,
            })),
          ]}
        />
      </div>

      {/* Cards */}
      {summaryQ.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-[var(--bg-elevated)] animate-pulse" />
          ))}
        </div>
      ) : !summary || summary.total_calls === 0 ? (
        <EmptyState
          variant="info"
          icon={Brain}
          title="Sem registros no período"
          description="Ajuste os filtros ou aguarde novas chamadas LLM serem logadas."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card
              icon={Banknote}
              label="Gasto total"
              value={
                summary.cost_brl != null
                  ? `R$ ${formatNumber(summary.cost_brl, 2)}`
                  : '—'
              }
              subtitle={
                summary.cost_usd != null
                  ? `US$ ${formatNumber(summary.cost_usd, 4)}`
                  : undefined
              }
              tier1
            />
            <Card
              icon={Hash}
              label="Tokens totais"
              value={formatNumber(summary.total_tokens, 0)}
              subtitle={`${formatNumber(summary.total_prompt_tokens, 0)} prompt · ${formatNumber(summary.total_completion_tokens, 0)} resposta`}
            />
            <Card
              icon={Activity}
              label="Chamadas"
              value={formatNumber(summary.total_calls, 0)}
              subtitle={
                summary.total_cached_tokens > 0
                  ? `${formatNumber(summary.total_cached_tokens, 0)} tokens cacheados`
                  : undefined
              }
            />
            <Card
              icon={TrendingUp}
              label="Custo médio/chamada"
              value={
                summary.avg_cost_brl_per_call != null
                  ? `R$ ${formatNumber(summary.avg_cost_brl_per_call, 4)}`
                  : '—'
              }
            />
          </div>

          {/* Gráfico temporal — barras de tokens + linha de custo */}
          <LlmDailyChart data={summary.daily} />

          {/* Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <BreakdownCard
              title="Por modelo"
              icon={Cpu}
              rows={summary.by_model.map((m) => ({
                key: m.model,
                primary: m.model,
                secondary: m.matched_pricing_key
                  ? `pricing: ${m.matched_pricing_key}`
                  : 'pricing: —',
                tokens: m.total_tokens,
                cost: m.cost_brl,
                pricingMissing: m.pricing_missing,
              }))}
            />
            <TenantsBudgetCard tenants={summary.by_tenant} />
            <BreakdownCard
              title="Por workflow"
              icon={Workflow}
              rows={summary.by_workflow.map((w) => ({
                key: w.workflow_name ?? '—',
                primary: w.workflow_name ?? '(sem workflow)',
                secondary: `${w.calls} chamadas`,
                tokens: w.total_tokens,
                cost: w.cost_brl,
              }))}
            />
          </div>
        </>
      )}

      {/* Tabela detalhada */}
      <div>
        <div className="flex items-baseline justify-between mb-2 gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
            Chamadas detalhadas
          </h3>
          <div className="flex items-center gap-3">
            {items && (
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                {items.total} no total
              </span>
            )}
            <ExportCsvButton filters={filters} disabled={!items || items.total === 0} />
          </div>
        </div>

        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  <Th>Data/hora</Th>
                  <Th>Empresa</Th>
                  <Th>Workflow</Th>
                  <Th>Modelo</Th>
                  <Th align="right">Tokens</Th>
                  <Th align="right">Custo</Th>
                </tr>
              </thead>
              <tbody>
                {itemsQ.isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="p-3">
                        <div className="h-4 rounded bg-[var(--bg-elevated)] animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : !items || items.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center" style={{ color: 'var(--text-3)' }}>
                      Nenhuma chamada no período/filtros selecionados
                    </td>
                  </tr>
                ) : (
                  items.items.map((it) => (
                    <tr
                      key={it.id}
                      style={{ borderTop: '1px solid var(--border)' }}
                    >
                      <Td>
                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-2)' }}>
                          <Calendar size={11} />
                          {formatDateTime(it.created_at)}
                        </div>
                      </Td>
                      <Td>
                        <span className="font-medium" style={{ color: 'var(--text-1)' }}>
                          {it.cliente_nome ?? '(—)'}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-xs" style={{ color: 'var(--text-2)' }}>
                          {it.workflow_name?.slice(0, 35) ?? '—'}
                        </span>
                      </Td>
                      <Td>
                        <code className="text-xs" style={{ color: 'var(--text-2)' }}>
                          {it.model ?? '—'}
                        </code>
                      </Td>
                      <Td align="right">
                        <div className="font-mono-data text-xs" style={{ color: 'var(--text-1)' }}>
                          {formatNumber(it.total_tokens, 0)}
                        </div>
                        <div className="font-mono-data text-[10px]" style={{ color: 'var(--text-3)' }}>
                          {formatNumber(it.prompt_tokens, 0)} + {formatNumber(it.completion_tokens, 0)}
                        </div>
                      </Td>
                      <Td align="right">
                        {it.pricing_missing ? (
                          <Pill tone="status:inactive" size="xs">sem pricing</Pill>
                        ) : (
                          <>
                            <div className="font-mono-data text-xs" style={{ color: 'var(--text-1)' }}>
                              R$ {formatNumber(it.cost_brl ?? 0, 4)}
                            </div>
                            <div className="font-mono-data text-[10px]" style={{ color: 'var(--text-3)' }}>
                              US$ {formatNumber(it.cost_usd ?? 0, 6)}
                            </div>
                          </>
                        )}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {items && items.total > PAGE_SIZE && (
            <div
              className="flex items-center justify-between px-4 py-3 text-xs"
              style={{ borderTop: '1px solid var(--border)', color: 'var(--text-3)' }}
            >
              <span>
                {pageOffset + 1}–{Math.min(pageOffset + PAGE_SIZE, items.total)} de {items.total}
              </span>
              <div className="flex gap-1">
                <button
                  disabled={pageOffset === 0}
                  onClick={() => setPageOffset(Math.max(0, pageOffset - PAGE_SIZE))}
                  className="px-2 py-1 rounded disabled:opacity-40"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-2)' }}
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  disabled={pageOffset + PAGE_SIZE >= items.total}
                  onClick={() => setPageOffset(pageOffset + PAGE_SIZE)}
                  className="px-2 py-1 rounded disabled:opacity-40"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-2)' }}
                  aria-label="Próxima página"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Card({
  icon: Icon,
  label,
  value,
  subtitle,
  tier1,
}: {
  icon: typeof Activity
  label: string
  value: string
  subtitle?: string
  tier1?: boolean
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'var(--bg-card)',
        border: tier1
          ? '1px solid var(--signal-success-500)'
          : '1px solid var(--border)',
        boxShadow: tier1 ? 'var(--glow-success-md)' : 'var(--card-shadow)',
      }}
    >
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
        <Icon size={12} />
        {label}
      </div>
      <p className="font-outfit font-bold" style={{ fontSize: '1.6rem', lineHeight: 1.2, color: 'var(--text-1)' }}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

function ExportCsvButton({
  filters,
  disabled,
}: {
  filters: LlmLogsFilters
  disabled: boolean
}) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const blob = await llmLogsApi.exportCsv(filters)
      // Cria link temporário e dispara download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const today = new Date().toISOString().slice(0, 10)
      a.download = `x9-llm-logs-${today}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erro ao exportar CSV:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={disabled || loading}
      className="px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text-2)',
      }}
      title="Baixa CSV de todas as chamadas (sem paginação) com os filtros atuais"
    >
      {loading ? (
        <span className="inline-block w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        <DollarSign size={12} />
      )}
      {loading ? 'Gerando...' : 'Exportar CSV'}
    </button>
  )
}


/**
 * Card especializado pra "Por empresa" — diferente do BreakdownCard genérico
 * porque mostra LIMITE DIÁRIO + GASTO-DE-HOJE + flag over_budget.
 * Quando tenant excede limite, vira vermelho + pill "Excedeu".
 */
function TenantsBudgetCard({ tenants }: { tenants: LlmTenantBreakdown[] }) {
  const totalTokens = tenants.reduce((acc, t) => acc + t.total_tokens, 0)
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div
        className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-3"
        style={{ color: 'var(--text-2)' }}
      >
        <Building2 size={12} />
        Por empresa
      </div>
      {tenants.length === 0 ? (
        <p className="text-xs py-2" style={{ color: 'var(--text-3)' }}>—</p>
      ) : (
        <ul className="space-y-2">
          {tenants.slice(0, 6).map((t) => {
            const pct = totalTokens > 0 ? (t.total_tokens / totalTokens) * 100 : 0
            const hasBudget = t.budget_brl_diario != null
            const today = t.cost_brl_today ?? 0
            const budgetPct = hasBudget && t.budget_brl_diario! > 0
              ? Math.min(100, (today / t.budget_brl_diario!) * 100)
              : 0
            return (
              <li key={t.cliente_id ?? '—'}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span
                      className="font-medium truncate"
                      style={{ color: t.over_budget ? '#ef4444' : 'var(--text-1)' }}
                    >
                      {t.cliente_nome ?? '(sem nome)'}
                    </span>
                    {t.over_budget && (
                      <Pill tone="status:inactive" icon={Flame} size="xs">
                        Excedeu
                      </Pill>
                    )}
                  </span>
                  <span
                    className="font-mono-data flex-shrink-0"
                    style={{ color: 'var(--text-2)' }}
                  >
                    {t.cost_brl != null ? `R$ ${formatNumber(t.cost_brl, 4)}` : '—'}
                  </span>
                </div>

                {/* Barra de tokens (período) */}
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="flex-1 rounded-full overflow-hidden"
                    style={{ background: 'var(--bg-elevated)', height: 4 }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: 'var(--brand-500)',
                      }}
                    />
                  </div>
                  <span
                    className="text-[10px] font-mono-data flex-shrink-0"
                    style={{ color: 'var(--text-3)' }}
                  >
                    {formatNumber(t.total_tokens, 0)} tokens
                  </span>
                </div>

                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {t.calls} chamadas · hoje{' '}
                  <strong
                    style={{
                      color: t.over_budget ? '#ef4444' : 'var(--text-2)',
                    }}
                  >
                    R$ {formatNumber(today, 4)}
                  </strong>
                  {hasBudget && (
                    <>
                      {' / '}R$ {formatNumber(t.budget_brl_diario!, 2)}
                    </>
                  )}
                  {!hasBudget && ' · sem limite'}
                </p>

                {/* Barra de progresso do orçamento (só se tem limite) */}
                {hasBudget && (
                  <div
                    className="mt-1 rounded-full overflow-hidden"
                    style={{ background: 'var(--bg-elevated)', height: 3 }}
                  >
                    <div
                      style={{
                        width: `${budgetPct}%`,
                        height: '100%',
                        background: t.over_budget
                          ? '#ef4444'
                          : budgetPct > 75
                            ? '#f97316'
                            : 'var(--signal-success-500)',
                        transition: 'width 200ms',
                      }}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}


function BreakdownCard({
  title,
  icon: Icon,
  rows,
}: {
  title: string
  icon: typeof Activity
  rows: Array<{
    key: string
    primary: string
    secondary: string
    tokens: number
    cost: number | null
    pricingMissing?: boolean
  }>
}) {
  const totalTokens = rows.reduce((acc, r) => acc + r.tokens, 0)
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-2)' }}>
        <Icon size={12} />
        {title}
      </div>
      {rows.length === 0 ? (
        <p className="text-xs py-2" style={{ color: 'var(--text-3)' }}>—</p>
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, 6).map((r) => {
            const pct = totalTokens > 0 ? (r.tokens / totalTokens) * 100 : 0
            return (
              <li key={r.key}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-medium truncate flex-1" style={{ color: 'var(--text-1)' }}>
                    {r.primary}
                  </span>
                  <span className="font-mono-data flex-shrink-0" style={{ color: 'var(--text-2)' }}>
                    {r.cost != null && !r.pricingMissing
                      ? `R$ ${formatNumber(r.cost, 4)}`
                      : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="flex-1 rounded-full overflow-hidden"
                    style={{ background: 'var(--bg-elevated)', height: 4 }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: 'var(--brand-500)',
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono-data flex-shrink-0" style={{ color: 'var(--text-3)' }}>
                    {formatNumber(r.tokens, 0)}
                  </span>
                </div>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-3)' }}>
                  {r.secondary}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function FieldDate({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | undefined
  onChange: (v: string | undefined) => void
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
        {label}
      </label>
      <input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="px-3 py-1.5 rounded-lg text-sm outline-none"
        style={{
          background: 'var(--input-bg)',
          border: '1px solid var(--input-border)',
          color: 'var(--text-1)',
        }}
      />
    </div>
  )
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string | undefined) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="min-w-[160px]">
      <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full px-3 py-1.5 rounded-lg text-sm outline-none"
        style={{
          background: 'var(--input-bg)',
          border: '1px solid var(--input-border)',
          color: 'var(--text-1)',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider"
      style={{ color: 'var(--text-2)', textAlign: align }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <td
      className="px-3 py-2.5"
      style={{ textAlign: align, verticalAlign: 'top' }}
    >
      {children}
    </td>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatNumber(n: number, fractionDigits: number): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
