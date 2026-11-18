import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  X,
  Shield,
  Briefcase,
  Building2,
  Mail,
  KeyRound,
  Trash2,
  Activity,
  AlertTriangle,
  Plus,
  Check,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  Sparkles,
} from 'lucide-react'
import { usersApi, type UserAdminListItem } from '../../api/users'
import { Pill, ConfirmModal } from '../ds'
import type { UserRole } from '../../types'
import { useAuthStore } from '../../store/authStore'
import { generateStrongPassword } from '../../lib/password'
import AssignAccessModal from './AssignAccessModal'

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Consultor',
  viewer: 'Visualizador',
}

interface Props {
  user: UserAdminListItem
  onClose: () => void
}

type Tab = 'dados' | 'empresas' | 'atividade'

export default function UserDetailDrawer({ user, onClose }: Props) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>(user.is_superadmin ? 'dados' : 'empresas')
  const [showDeleteUser, setShowDeleteUser] = useState(false)
  const [showAssign, setShowAssign] = useState(false)

  // Esc fecha drawer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <aside
        className="h-full w-full max-w-[480px] flex flex-col"
        style={{
          background: 'var(--bg-card)',
          borderLeft: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <header
          className="px-6 pt-6 pb-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0"
                style={{ background: 'var(--brand-glow)', color: 'var(--brand-500)' }}
              >
                {user.nome.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold truncate" style={{ color: 'var(--text-1)' }}>
                  {user.nome}
                </h2>
                <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>
                  {user.email}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {user.is_superadmin && (
                    <Pill tone="role:admin" icon={Shield}>Super Admin</Pill>
                  )}
                  {user.is_manager_multi && (
                    <Pill tone="status:active" icon={Briefcase}>Cliente</Pill>
                  )}
                  {!user.is_superadmin && !user.is_manager_multi && (
                    <Pill tone="role:viewer">Consultor</Pill>
                  )}
                  {!user.is_active && <Pill tone="status:inactive">Inativo</Pill>}
                  {user.must_change_password && (
                    <Pill tone="status:active" icon={KeyRound}>Aguardando troca de senha</Pill>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="p-1 rounded transition-colors flex-shrink-0"
              style={{ color: 'var(--text-3)' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            <TabBtn active={tab === 'dados'} onClick={() => setTab('dados')}>
              Dados
            </TabBtn>
            {!user.is_superadmin && (
              <TabBtn active={tab === 'empresas'} onClick={() => setTab('empresas')}>
                Empresas
                <span
                  className="ml-1.5 px-1.5 py-0.5 rounded text-xs"
                  style={{
                    background: tab === 'empresas' ? 'var(--brand-500)' : 'var(--bg-elevated)',
                    color: tab === 'empresas' ? '#fff' : 'var(--text-3)',
                  }}
                >
                  {user.tenants.length}
                </span>
              </TabBtn>
            )}
            <TabBtn active={tab === 'atividade'} onClick={() => setTab('atividade')}>
              Atividade
            </TabBtn>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'dados' && <DadosTab user={user} onDelete={() => setShowDeleteUser(true)} />}
          {tab === 'empresas' && !user.is_superadmin && (
            <EmpresasTab user={user} onAddEmpresa={() => setShowAssign(true)} />
          )}
          {tab === 'empresas' && user.is_superadmin && (
            <div className="text-center py-12">
              <Building2 size={32} className="mx-auto mb-2" style={{ color: 'var(--text-3)' }} />
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                Super Admin vê todas as <strong>{user.total_empresas}</strong> empresas do sistema.
              </p>
            </div>
          )}
          {tab === 'atividade' && <AtividadeTab />}
        </div>
      </aside>

      {/* Modal: confirma delete user */}
      <ConfirmModal
        open={showDeleteUser}
        title="Excluir usuário?"
        description={`${user.nome} (${user.email}) será removido permanentemente. Todos os vínculos com empresas serão apagados. Essa ação NÃO pode ser desfeita.`}
        confirmLabel="Excluir usuário"
        cancelLabel="Cancelar"
        variant="danger"
        onClose={() => setShowDeleteUser(false)}
        onConfirm={async () => {
          try {
            await usersApi.delete(user.id)
            qc.invalidateQueries({ queryKey: ['users', 'admin-list'] })
            toast.success(`${user.nome} excluído`)
            onClose()
          } catch {
            toast.error('Erro ao excluir usuário')
          }
        }}
      />

      {/* Modal: atribuir nova empresa */}
      {showAssign && (
        <AssignAccessModal
          initialUserId={user.id}
          onClose={() => setShowAssign(false)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-sm font-medium rounded-lg flex items-center transition-colors"
      style={{
        background: active ? 'var(--brand-glow)' : 'transparent',
        color: active ? 'var(--brand-500)' : 'var(--text-3)',
      }}
    >
      {children}
    </button>
  )
}

function DadosTab({
  user,
  onDelete,
}: {
  user: UserAdminListItem
  onDelete: () => void
}) {
  const qc = useQueryClient()

  const setManagerMultiMutation = useMutation({
    mutationFn: (value: boolean) => usersApi.setManagerMulti(user.id, value),
    onSuccess: (_, value) => {
      qc.invalidateQueries({ queryKey: ['users', 'admin-list'] })
      toast.success(value ? 'Promovido a Cliente' : 'Removido como Cliente')
    },
    onError: () => toast.error('Erro ao atualizar perfil'),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: (value: boolean) => usersApi.update(user.id, { is_active: value }),
    onSuccess: (_, value) => {
      qc.invalidateQueries({ queryKey: ['users', 'admin-list'] })
      toast.success(value ? 'Usuário ativado' : 'Usuário desativado')
    },
    onError: () => toast.error('Erro ao alterar status'),
  })

  return (
    <div className="space-y-5">
      {/* Info section */}
      <Section title="Identificação">
        <InfoRow icon={Mail} label="Email" value={user.email} />
        <InfoRow
          icon={Activity}
          label="Status"
          value={user.is_active ? 'Ativo' : 'Inativo'}
        />
        <InfoRow
          icon={Activity}
          label="Cadastrado em"
          value={new Date(user.created_at).toLocaleDateString('pt-BR')}
        />
      </Section>

      {/* Toggles */}
      <Section title="Permissões globais">
        <Toggle
          label="Cliente Multi-Empresa"
          description="Acesso ao portfolio agregado e visão consolidada"
          checked={user.is_manager_multi}
          disabled={user.is_superadmin || setManagerMultiMutation.isPending}
          onChange={(v) => setManagerMultiMutation.mutate(v)}
        />
        <Toggle
          label="Usuário ativo"
          description="Pode fazer login no sistema"
          checked={user.is_active}
          disabled={toggleActiveMutation.isPending}
          onChange={(v) => toggleActiveMutation.mutate(v)}
        />
      </Section>

      {/* Acesso — admin define senha sem depender de email */}
      <AcessoSection user={user} />

      {/* Danger zone */}
      <Section title="Zona de risco">
        <button
          onClick={onDelete}
          disabled={user.is_superadmin}
          className="w-full px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'rgba(239,68,68,0.1)',
            color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.3)',
          }}
        >
          <Trash2 size={14} />
          Excluir usuário permanentemente
        </button>
        {user.is_superadmin && (
          <p className="text-xs text-center mt-2" style={{ color: 'var(--text-3)' }}>
            Não é possível excluir um Super Admin pelo painel.
          </p>
        )}
      </Section>
    </div>
  )
}

function EmpresasTab({
  user,
  onAddEmpresa,
}: {
  user: UserAdminListItem
  onAddEmpresa: () => void
}) {
  const qc = useQueryClient()
  const [removeTarget, setRemoveTarget] = useState<{ utId: string; nome: string } | null>(null)

  const updateRoleMutation = useMutation({
    mutationFn: ({ utId, role }: { utId: string; role: UserRole }) =>
      usersApi.updateTenantRole(utId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'admin-list'] })
      toast.success('Role atualizado')
    },
    onError: () => toast.error('Erro ao atualizar role'),
  })

  const revokeMutation = useMutation({
    mutationFn: (utId: string) => usersApi.revokeTenantAccess(utId),
    onSuccess: (_, utId) => {
      qc.invalidateQueries({ queryKey: ['users', 'admin-list'] })
      const removedNome = user.tenants.find((t) => t.user_tenant_id === utId)?.cliente_nome ?? ''
      toast.success(`Acesso revogado${removedNome ? ': ' + removedNome : ''}`)
      setRemoveTarget(null)
    },
    onError: () => toast.error('Erro ao revogar acesso'),
  })

  return (
    <div className="space-y-3">
      <button
        onClick={onAddEmpresa}
        className="w-full px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 text-white"
        style={{
          background: 'var(--gradient-brand)',
          boxShadow: 'var(--glow-brand-sm)',
        }}
      >
        <Plus size={14} />
        Atribuir nova empresa
      </button>

      {user.tenants.length === 0 ? (
        <div className="text-center py-12">
          <Building2 size={32} className="mx-auto mb-2" style={{ color: 'var(--text-3)' }} />
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            {user.nome} ainda não tem acesso a nenhuma empresa.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {user.tenants.map((t) => (
            <div
              key={t.user_tenant_id}
              className="rounded-lg p-3"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
                  style={{ background: 'var(--brand-glow)', color: 'var(--brand-500)' }}
                >
                  {t.cliente_nome.trim().charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>
                    {t.cliente_nome.trim()}
                  </p>
                  {t.cliente_nicho && (
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {t.cliente_nicho}
                    </p>
                  )}
                </div>
                <button
                  onClick={() =>
                    setRemoveTarget({ utId: t.user_tenant_id, nome: t.cliente_nome.trim() })
                  }
                  className="p-1.5 rounded transition-colors flex-shrink-0"
                  style={{ color: 'var(--text-3)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239,68,68,0.1)'
                    e.currentTarget.style.color = '#ef4444'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--text-3)'
                  }}
                  aria-label="Revogar acesso"
                  title="Revogar acesso"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <select
                value={t.role}
                disabled={updateRoleMutation.isPending}
                onChange={(e) =>
                  updateRoleMutation.mutate({
                    utId: t.user_tenant_id,
                    role: e.target.value as UserRole,
                  })
                }
                className="w-full text-xs rounded-md px-2 py-1.5 outline-none"
                style={{
                  background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                  color: 'var(--text-1)',
                }}
              >
                <option value="admin">Admin — configura empresa</option>
                <option value="manager">Consultor — operacional</option>
                <option value="viewer">Visualizador — só leitura</option>
              </select>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!removeTarget}
        title="Revogar acesso?"
        description={
          removeTarget
            ? `${user.nome} perderá acesso a ${removeTarget.nome}. Pode atribuir de volta a qualquer momento.`
            : ''
        }
        confirmLabel="Revogar acesso"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={revokeMutation.isPending}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) revokeMutation.mutate(removeTarget.utId)
        }}
      />
    </div>
  )
}

function AtividadeTab() {
  return (
    <div className="text-center py-12">
      <AlertTriangle size={28} className="mx-auto mb-3" style={{ color: 'var(--text-3)' }} />
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-1)' }}>
        Em breve
      </p>
      <p className="text-xs" style={{ color: 'var(--text-3)' }}>
        Histórico de logins, ações executadas e sessões ativas vão aparecer aqui.
      </p>
    </div>
  )
}

/**
 * Seção "Acesso" — admin define manualmente a senha do usuário.
 *
 * Fluxo:
 *  1. Clique "Definir nova senha" → abre form inline (botão Gerar + 2 inputs)
 *  2. Admin digita ou gera senha forte (12 chars)
 *  3. Confirma → POST /users/{id}/admin-reset-password
 *  4. Toast com a senha + botão Copiar (some em 12s)
 *
 * Visibilidade: superadmin sempre vê; outros usuários só veem se forem
 * admin de pelo menos um tenant. O backend valida o resto.
 */
function AcessoSection({ user }: { user: UserAdminListItem }) {
  const { user: currentUser } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [senha, setSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [forcarTroca, setForcarTroca] = useState(false)

  const isSelf = currentUser?.id === user.id
  const isSuperadminTarget = user.is_superadmin

  // Bloqueios visuais:
  //  - Não pode mexer em si mesmo (use /change-password)
  //  - Se target é superadmin e current_user NÃO é, esconde tudo
  if (isSelf) return null
  if (isSuperadminTarget && !currentUser?.is_superadmin) return null

  // Para non-superadmin, mostra mas o botão pode ser bloqueado pelo backend
  // (current_user precisa ser admin de algum tenant em comum com o target).

  const resetMutation = useMutation({
    mutationFn: ({ senhaNova, forcar }: { senhaNova: string; forcar: boolean }) =>
      usersApi.adminResetPassword(user.id, senhaNova, forcar),
    onSuccess: (_, vars) => {
      // Toast longo com botão Copiar — duração de 12s pra dar tempo de copiar
      toast(
        (t) => (
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                Senha definida ✓
              </p>
              <p className="text-xs mt-0.5 font-mono-data break-all" style={{ color: 'var(--text-2)' }}>
                {vars.senhaNova}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(vars.senhaNova)
                toast.dismiss(t.id)
                toast.success('Senha copiada')
              }}
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-1)' }}
            >
              <Copy size={11} />
              Copiar
            </button>
          </div>
        ),
        { duration: 12000 }
      )
      setOpen(false)
      setSenha('')
      setShowSenha(false)
      setForcarTroca(false)
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail || 'Erro ao definir senha')
    },
  })

  function handleGerar() {
    setSenha(generateStrongPassword(12))
    setShowSenha(true)  // gerou — pode mostrar
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (senha.length < 8) {
      toast.error('Senha deve ter no mínimo 8 caracteres')
      return
    }
    resetMutation.mutate({ senhaNova: senha, forcar: forcarTroca })
  }

  return (
    <Section title="Acesso">
      {!open ? (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            style={{
              background: 'rgba(11,150,146,0.08)',
              color: '#a5b4fc',
              border: '1px solid rgba(11,150,146,0.25)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(11,150,146,0.14)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(11,150,146,0.08)')}
          >
            <KeyRound size={14} />
            Definir nova senha
          </button>
          <p className="text-[11px] text-center mt-2" style={{ color: 'var(--text-3)' }}>
            Use quando o email de convite/reset não chegar. Você passa a senha pessoalmente.
          </p>
        </>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 p-3 rounded-lg"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
              Nova senha
            </p>
            <button
              type="button"
              onClick={() => { setOpen(false); setSenha(''); setShowSenha(false) }}
              className="text-xs"
              style={{ color: 'var(--text-3)' }}
            >
              Cancelar
            </button>
          </div>

          <button
            type="button"
            onClick={handleGerar}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-md transition-colors"
            style={{
              background: 'transparent',
              border: '1px dashed var(--border)',
              color: 'var(--text-2)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(11,150,146,0.45)'
              e.currentTarget.style.color = '#a5b4fc'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.color = 'var(--text-2)'
            }}
          >
            <Sparkles size={12} />
            Gerar senha forte (12 caracteres)
          </button>

          <div className="relative">
            <input
              type={showSenha ? 'text' : 'password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Ou digite uma senha (min 8)"
              autoComplete="new-password"
              className="w-full text-sm px-3 py-2 pr-9 rounded-md outline-none font-mono-data"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-1)',
              }}
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowSenha((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors"
              style={{ color: 'var(--text-3)' }}
              aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showSenha ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={forcarTroca}
              onChange={(e) => setForcarTroca(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
              Forçar usuário a trocar a senha no próximo login
            </span>
          </label>

          <button
            type="submit"
            disabled={senha.length < 8 || resetMutation.isPending}
            className="w-full flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--brand-500)', color: '#fff' }}
          >
            {resetMutation.isPending ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Definindo...
              </>
            ) : (
              <>
                <Check size={13} />
                Confirmar
              </>
            )}
          </button>
        </form>
      )}
    </Section>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        className="text-xs font-bold uppercase tracking-wider mb-2"
        style={{ color: 'var(--text-2)' }}
      >
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail
  label: string
  value: string
}) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <Icon size={14} style={{ color: 'var(--text-3)' }} className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>
          {label}
        </p>
        <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          {value}
        </p>
      </div>
    </div>
  )
}

function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
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
        disabled={disabled}
        onClick={() => onChange(!checked)}
        aria-label={`Alternar ${label}`}
        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 disabled:opacity-50"
        style={{
          background: checked ? 'var(--signal-success-500)' : 'var(--border-muted)',
        }}
      >
        <span
          className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(3px)' }}
        />
      </button>
    </div>
  )
}
