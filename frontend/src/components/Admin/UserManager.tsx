import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Search,
  ChevronDown,
  Shield,
  Briefcase,
  KeyRound,
  Building2,
  UserPlus,
  Loader2,
  X,
  Mail,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { usersApi, type UserAdminListItem } from '../../api/users'
import type { UserRole } from '../../types'
import { Pill } from '../ds'
import AssignAccessModal from './AssignAccessModal'
import UserDetailDrawer from './UserDetailDrawer'

type TipoFilter = 'todos' | 'cliente' | 'consultor' | 'super_admin'

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Consultor',
  viewer: 'Visualizador',
}

/**
 * Tela admin de Usuários — visão hierárquica.
 *
 * Cada linha de usuário expande mostrando as empresas que ele tem acesso.
 * Click em ⚙ abre Drawer lateral com tabs Dados/Empresas/Atividade.
 */
export default function UserManager() {
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('todos')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [drawerUser, setDrawerUser] = useState<UserAdminListItem | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showAssign, setShowAssign] = useState(false)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', 'admin-list'],
    queryFn: usersApi.adminList,
    staleTime: 30_000,
  })

  // Counts pra header
  const counts = useMemo(() => {
    const total = users.length
    const clientes = users.filter((u) => u.is_manager_multi && !u.is_superadmin).length
    const supers = users.filter((u) => u.is_superadmin).length
    const consultores = total - clientes - supers
    return { total, clientes, consultores, supers }
  }, [users])

  // Filtros
  const filtered = useMemo(() => {
    let list = users
    if (tipoFilter === 'cliente') {
      list = list.filter((u) => u.is_manager_multi && !u.is_superadmin)
    } else if (tipoFilter === 'consultor') {
      list = list.filter((u) => !u.is_manager_multi && !u.is_superadmin)
    } else if (tipoFilter === 'super_admin') {
      list = list.filter((u) => u.is_superadmin)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (u) =>
          u.nome.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.tenants.some((t) => t.cliente_nome.toLowerCase().includes(q))
      )
    }
    return list
  }, [users, search, tipoFilter])

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
          Usuários
          {counts.total > 0 && (
            <Pill tone="role:admin" size="xs" className="font-bold align-middle">
              {counts.total}
            </Pill>
          )}
          <span className="text-xs font-normal" style={{ color: 'var(--text-3)' }}>
            · {counts.supers} super admin · {counts.clientes} clientes · {counts.consultores} consultores
          </span>
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAssign(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-muted)',
              color: 'var(--text-2)',
            }}
          >
            <UserPlus size={14} /> Atribuir acesso
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium"
            style={{
              background: 'var(--gradient-brand)',
              boxShadow: 'var(--glow-brand-sm)',
            }}
          >
            <Plus size={14} /> Novo usuário
          </button>
        </div>
      </div>

      {/* ── Search + filtros ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[260px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-3)' }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, email ou empresa..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              color: 'var(--text-1)',
            }}
          />
        </div>
        <div className="flex gap-1">
          {(
            [
              { value: 'todos', label: 'Todos' },
              { value: 'cliente', label: 'Clientes' },
              { value: 'consultor', label: 'Consultores' },
              { value: 'super_admin', label: 'Super Admin' },
            ] as { value: TipoFilter; label: string }[]
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTipoFilter(opt.value)}
              className="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
              style={{
                background: tipoFilter === opt.value ? 'var(--brand-glow)' : 'var(--bg-elevated)',
                color: tipoFilter === opt.value ? 'var(--brand-500)' : 'var(--text-2)',
                border: `1px solid ${tipoFilter === opt.value ? 'var(--brand-500)' : 'var(--border)'}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lista accordion ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-[var(--bg-elevated)] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Nenhum usuário encontrado
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              expanded={expandedId === u.id}
              onToggle={() => setExpandedId(expandedId === u.id ? null : u.id)}
              onOpen={() => setDrawerUser(u)}
            />
          ))}
        </div>
      )}

      {/* Modais */}
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
      {showAssign && <AssignAccessModal onClose={() => setShowAssign(false)} />}
      {drawerUser && (
        <UserDetailDrawer user={drawerUser} onClose={() => setDrawerUser(null)} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

function UserRow({
  user,
  expanded,
  onToggle,
  onOpen,
}: {
  user: UserAdminListItem
  expanded: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  const isCliente = user.is_manager_multi && !user.is_superadmin
  const tipoTone = user.is_superadmin ? 'role:admin' : isCliente ? 'status:active' : 'role:viewer'
  const tipoIcon = user.is_superadmin ? Shield : isCliente ? Briefcase : undefined
  const tipoLabel = user.is_superadmin ? 'Super Admin' : isCliente ? 'Cliente' : 'Consultor'

  const showExpand = !user.is_superadmin && user.tenants.length > 0

  return (
    <div
      className="rounded-xl overflow-hidden transition-colors"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="p-4 flex items-center gap-4">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
          style={{ background: 'var(--brand-glow)', color: 'var(--brand-500)' }}
        >
          {user.nome.charAt(0).toUpperCase()}
        </div>

        {/* Nome + email + pills */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="font-medium" style={{ color: 'var(--text-1)' }}>
              {user.nome}
            </p>
            <Pill tone={tipoTone} icon={tipoIcon} size="xs">
              {tipoLabel}
            </Pill>
            {user.must_change_password && (
              <Pill tone="status:active" icon={KeyRound} size="xs">
                Aguardando senha
              </Pill>
            )}
            {!user.is_active && (
              <Pill tone="status:inactive" size="xs">
                Inativo
              </Pill>
            )}
          </div>
          <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>
            {user.email}
          </p>
        </div>

        {/* Contador empresas */}
        <div className="flex items-center gap-1.5 text-xs flex-shrink-0" style={{ color: 'var(--text-2)' }}>
          <Building2 size={13} style={{ color: 'var(--text-3)' }} />
          {user.is_superadmin
            ? `Vê todas (${user.total_empresas})`
            : `${user.tenants.length} empresa${user.tenants.length === 1 ? '' : 's'}`}
        </div>

        {/* Expandir */}
        {showExpand && (
          <button
            onClick={onToggle}
            aria-label={expanded ? 'Recolher empresas' : 'Expandir empresas'}
            className="p-1.5 rounded transition-transform flex-shrink-0"
            style={{
              color: 'var(--text-3)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            <ChevronDown size={16} />
          </button>
        )}

        {/* Ação ⚙ */}
        <button
          onClick={onOpen}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
          style={{
            background: 'var(--bg-elevated)',
            color: 'var(--text-2)',
            border: '1px solid var(--border)',
          }}
        >
          Detalhes
        </button>
      </div>

      {/* Expansão: empresas */}
      {expanded && showExpand && (
        <div
          className="px-4 pb-3 pt-1 space-y-1"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {user.tenants.map((t) => (
            <div
              key={t.user_tenant_id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg"
              style={{ background: 'var(--bg-elevated)' }}
            >
              <div
                className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ background: 'var(--brand-glow)', color: 'var(--brand-500)' }}
              >
                {t.cliente_nome.trim().charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                  {t.cliente_nome.trim()}
                </span>
                {t.cliente_nicho && (
                  <span className="text-xs ml-2" style={{ color: 'var(--text-3)' }}>
                    · {t.cliente_nicho}
                  </span>
                )}
              </div>
              <Pill
                tone={t.role === 'admin' ? 'role:admin' : t.role === 'manager' ? 'role:manager' : 'role:viewer'}
                size="xs"
              >
                {ROLE_LABEL[t.role]}
              </Pill>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CreateUserModal — versão simplificada (sem assign de empresa inline)
// ─────────────────────────────────────────────────────────────────────────────

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    nome: '',
    email: '',
    is_superadmin: false,
    is_manager_multi: false,
  })

  const mutation = useMutation({
    mutationFn: () =>
      usersApi.create({
        email: form.email,
        nome: form.nome,
        is_superadmin: form.is_superadmin,
        is_manager_multi: form.is_manager_multi,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'admin-list'] })
      toast.success(`${form.nome} criado! Email de convite enviado.`)
      onClose()
    },
    onError: () => toast.error('Erro ao criar usuário'),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
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
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-1)' }}>
            Novo usuário
          </h2>
          <button onClick={onClose} aria-label="Fechar" style={{ color: 'var(--text-3)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              autoFocus
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          {/* Aviso de convite por email */}
          <div
            className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-xs"
            style={{
              background: 'rgba(11,150,146,0.08)',
              border: '1px solid rgba(11,150,146,0.2)',
              color: 'var(--text-2)',
            }}
          >
            <Mail size={13} className="mt-0.5 flex-shrink-0 text-brand-400" />
            Um email de convite será enviado para o usuário definir a própria senha.
          </div>

          <div className="space-y-2 pt-2">
            <ToggleRow
              label="Super Admin"
              description="Acesso global ao sistema"
              checked={form.is_superadmin}
              onChange={(v) => setForm({ ...form, is_superadmin: v })}
            />
            <ToggleRow
              label="Cliente Multi-Empresa"
              description="Vê portfolio agregado das empresas que tem acesso"
              checked={form.is_manager_multi}
              onChange={(v) => setForm({ ...form, is_manager_multi: v })}
            />
          </div>

          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            Para vincular a uma empresa, use "Atribuir acesso" depois de criar.
          </p>

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
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm rounded-lg font-medium text-white flex items-center gap-2"
              style={{ background: 'var(--gradient-brand)', boxShadow: 'var(--glow-brand-sm)' }}
            >
              {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
              Criar usuário
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
      style={{ color: 'var(--text-3)' }}
    >
      {children}
    </label>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 rounded-lg text-sm outline-none ${props.className ?? ''}`}
      style={{
        background: 'var(--input-bg)',
        border: '1px solid var(--input-border)',
        color: 'var(--text-1)',
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--brand-500)')}
      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--input-border)')}
    />
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          {label}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>
          {description}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-label={`Alternar ${label}`}
        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0"
        style={{ background: checked ? 'var(--signal-success-500)' : 'var(--border-muted)' }}
      >
        <span
          className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(3px)' }}
        />
      </button>
    </div>
  )
}
