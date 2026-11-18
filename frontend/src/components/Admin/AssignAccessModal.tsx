import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { X, Search, Building2, UserCheck, Loader2 } from 'lucide-react'
import { usersApi, type UserAdminListItem } from '../../api/users'
import { tenantsApi } from '../../api/tenants'
import type { UserRole } from '../../types'

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string }[] = [
  { value: 'admin',   label: 'Admin',   desc: 'Configura empresa, gerencia equipe' },
  { value: 'manager', label: 'Consultor', desc: 'Atende leads, vê dashboard. Não configura.' },
  { value: 'viewer',  label: 'Visualizador', desc: 'Só vê, não edita nada' },
]

interface Props {
  /** Pré-selecionar um usuário (vindo do drawer "+ Atribuir empresa"). */
  initialUserId?: string
  /** Pré-selecionar uma empresa (vindo de algum contexto). */
  initialClienteId?: string
  onClose: () => void
}

/**
 * Modal pra atribuir um usuário existente a uma empresa, com search/filtro.
 *
 * Substitui o form inline antigo do UserManager. Layout limpo em 2 etapas
 * + step do role com cards descritivos.
 */
export default function AssignAccessModal({
  initialUserId,
  initialClienteId,
  onClose,
}: Props) {
  const qc = useQueryClient()
  const [userId, setUserId] = useState(initialUserId ?? '')
  const [clienteId, setClienteId] = useState(initialClienteId ?? '')
  const [role, setRole] = useState<UserRole>('manager')
  const [userQuery, setUserQuery] = useState('')
  const [empresaQuery, setEmpresaQuery] = useState('')

  const { data: users = [] } = useQuery({
    queryKey: ['users', 'admin-list'],
    queryFn: usersApi.adminList,
  })
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: tenantsApi.list,
  })

  // Filtros — usuários sem busca quando initialUserId vem
  const usersFilteredAll = useMemo(() => {
    return users.filter((u) => !u.is_superadmin)
  }, [users])

  const usersFiltered = useMemo(() => {
    const q = userQuery.trim().toLowerCase()
    if (!q) return usersFilteredAll
    return usersFilteredAll.filter(
      (u) => u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
  }, [usersFilteredAll, userQuery])

  const tenantsFiltered = useMemo(() => {
    const q = empresaQuery.trim().toLowerCase()
    if (!q) return tenants
    return tenants.filter(
      (t) => t.nome.toLowerCase().includes(q) || (t.nicho ?? '').toLowerCase().includes(q)
    )
  }, [tenants, empresaQuery])

  const userSelecionado = users.find((u) => u.id === userId)
  const tenantSelecionado = tenants.find((t) => t.id === clienteId)

  // Detecta se usuário já tem acesso ativo a essa empresa
  const jaTemAcesso = useMemo(() => {
    if (!userSelecionado || !clienteId) return null
    return userSelecionado.tenants.find((t) => t.cliente_id === clienteId && t.is_active)
  }, [userSelecionado, clienteId])

  const mutation = useMutation({
    mutationFn: () =>
      usersApi.assignTenant({ user_id: userId, cliente_id: clienteId, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'admin-list'] })
      qc.invalidateQueries({ queryKey: ['consultores', clienteId] })
      toast.success('Acesso atribuído!')
      onClose()
    },
    onError: () => toast.error('Erro ao atribuir acesso'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) {
      toast.error('Selecione um usuário')
      return
    }
    if (!clienteId) {
      toast.error('Selecione uma empresa')
      return
    }
    mutation.mutate()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
              <UserCheck size={18} style={{ color: 'var(--brand-500)' }} />
              Atribuir acesso à empresa
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              Dá acesso a um usuário existente em uma empresa específica
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--text-3)' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Step 1: Usuário ── */}
          <Section title="1. Quem ganha acesso?" hint={`${usersFilteredAll.length} usuários no sistema`}>
            <SearchInput
              value={userQuery}
              onChange={setUserQuery}
              placeholder="Buscar por nome ou email..."
            />
            <SelectableList
              items={usersFiltered.map((u) => ({
                id: u.id,
                primary: u.nome,
                secondary: u.email,
                tag: u.is_manager_multi ? 'Cliente' : `${u.tenants.length} empresa${u.tenants.length === 1 ? '' : 's'}`,
              }))}
              selectedId={userId}
              onSelect={setUserId}
              emptyText="Nenhum usuário encontrado"
            />
          </Section>

          {/* ── Step 2: Empresa ── */}
          <Section title="2. Em qual empresa?" hint={`${tenants.length} empresas`}>
            <SearchInput
              value={empresaQuery}
              onChange={setEmpresaQuery}
              placeholder="Buscar empresa por nome ou nicho..."
            />
            <SelectableList
              items={tenantsFiltered.map((t) => ({
                id: t.id,
                primary: t.nome.trim(),
                secondary: t.nicho ?? '—',
                tag: t.ativo ? 'Ativa' : 'Inativa',
                tagDimmed: !t.ativo,
              }))}
              selectedId={clienteId}
              onSelect={setClienteId}
              emptyText="Nenhuma empresa encontrada"
            />
          </Section>

          {/* ── Aviso de conflito ── */}
          {jaTemAcesso && (
            <div
              className="rounded-lg p-3 text-xs flex items-start gap-2"
              style={{
                background: 'rgba(234,179,8,0.10)',
                border: '1px solid rgba(234,179,8,0.30)',
                color: 'var(--text-2)',
              }}
            >
              <span className="font-semibold" style={{ color: '#facc15' }}>⚠</span>
              <div>
                <p className="font-medium" style={{ color: 'var(--text-1)' }}>
                  {userSelecionado?.nome} já é{' '}
                  <strong>{ROLE_OPTIONS.find((r) => r.value === jaTemAcesso.role)?.label}</strong> em{' '}
                  <strong>{tenantSelecionado?.nome}</strong>
                </p>
                <p>
                  Atribuir agora vai <strong>atualizar o role pra "{ROLE_OPTIONS.find((r) => r.value === role)?.label}"</strong>.
                </p>
              </div>
            </div>
          )}

          {/* ── Step 3: Role ── */}
          <Section title="3. Que tipo de acesso?">
            <div className="grid grid-cols-3 gap-2">
              {ROLE_OPTIONS.map((r) => {
                const selected = role === r.value
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className="text-left rounded-lg p-3 transition-all"
                    style={{
                      background: selected ? 'var(--brand-glow)' : 'var(--bg-elevated)',
                      border: `1px solid ${selected ? 'var(--brand-500)' : 'var(--border)'}`,
                    }}
                  >
                    <p
                      className="font-semibold text-sm mb-0.5"
                      style={{ color: selected ? 'var(--brand-500)' : 'var(--text-1)' }}
                    >
                      {r.label}
                    </p>
                    <p className="text-xs leading-tight" style={{ color: 'var(--text-3)' }}>
                      {r.desc}
                    </p>
                  </button>
                )
              })}
            </div>
          </Section>

          {/* ── Footer ── */}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg"
              style={{ color: 'var(--text-2)' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!userId || !clienteId || mutation.isPending}
              className="px-5 py-2 text-sm rounded-lg font-medium text-white flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'var(--gradient-brand)',
                boxShadow: 'var(--glow-brand-sm)',
              }}
            >
              {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
              {jaTemAcesso ? 'Atualizar role' : 'Atribuir acesso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
          {title}
        </h3>
        {hint && (
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>
            {hint}
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="relative">
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2"
        style={{ color: 'var(--text-3)' }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
        style={{
          background: 'var(--input-bg)',
          border: '1px solid var(--input-border)',
          color: 'var(--text-1)',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--brand-500)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--input-border)')}
      />
    </div>
  )
}

interface SelectableItem {
  id: string
  primary: string
  secondary: string
  tag?: string
  tagDimmed?: boolean
}

function SelectableList({
  items,
  selectedId,
  onSelect,
  emptyText,
}: {
  items: SelectableItem[]
  selectedId: string
  onSelect: (id: string) => void
  emptyText: string
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm py-3 text-center" style={{ color: 'var(--text-3)' }}>
        {emptyText}
      </p>
    )
  }
  return (
    <div
      className="rounded-lg overflow-hidden max-h-48 overflow-y-auto"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
      }}
    >
      {items.map((item, idx) => {
        const selected = item.id === selectedId
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className="w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors"
            style={{
              background: selected ? 'var(--brand-glow)' : 'transparent',
              borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
            }}
            onMouseEnter={(e) => {
              if (!selected) e.currentTarget.style.background = 'var(--bg-base)'
            }}
            onMouseLeave={(e) => {
              if (!selected) e.currentTarget.style.background = 'transparent'
            }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{
                background: selected ? 'var(--brand-500)' : 'var(--bg-card)',
                color: selected ? '#fff' : 'var(--text-2)',
              }}
            >
              {item.primary.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium truncate"
                style={{ color: selected ? 'var(--brand-500)' : 'var(--text-1)' }}
              >
                {item.primary}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>
                {item.secondary}
              </p>
            </div>
            {item.tag && (
              <span
                className="text-xs px-2 py-0.5 rounded flex-shrink-0"
                style={{
                  background: item.tagDimmed ? 'transparent' : 'var(--bg-card)',
                  color: 'var(--text-3)',
                  border: '1px solid var(--border)',
                }}
              >
                {item.tag}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
