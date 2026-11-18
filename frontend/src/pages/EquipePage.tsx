import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Users2,
  UserPlus,
  Trash2,
  AlertTriangle,
  KeyRound,
  ShieldCheck,
  Briefcase,
} from 'lucide-react'
import { empresasApi, type Consultor } from '../api/empresas'
import { useTenantStore } from '../store/tenantStore'
import { useAuthStore } from '../store/authStore'
import { Pill, EmptyState, ConfirmModal } from '../components/ds'
import CreateConsultorModal from '../components/Empresas/CreateConsultorModal'
import SyncFotosButton from '../components/ui/SyncFotosButton'
import type { UserRole } from '../types'

/**
 * /equipe — gestão de consultores da empresa atualmente selecionada.
 *
 * Acesso: superadmin OU manager_multi com role=admin no tenant atual.
 * Guard externo (RequireEquipeAccess) já verifica isso.
 */
export default function EquipePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { selectedTenant } = useTenantStore()
  const { user } = useAuthStore()
  const [showCreate, setShowCreate] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Consultor | null>(null)

  const clienteId = selectedTenant?.id

  const { data: consultores = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['consultores', clienteId],
    queryFn: () => empresasApi.listarConsultores(clienteId!),
    enabled: !!clienteId,
    staleTime: 30_000,
  })

  const removeMutation = useMutation({
    mutationFn: (c: Consultor) =>
      empresasApi.remover(clienteId!, c.user_tenant_id),
    onSuccess: (_, c) => {
      qc.invalidateQueries({ queryKey: ['consultores', clienteId] })
      toast.success(`${c.nome} removido da equipe`)
      setRemoveTarget(null)
    },
    onError: () => toast.error('Erro ao remover consultor'),
  })

  const roleMutation = useMutation({
    mutationFn: ({ userTenantId, role }: { userTenantId: string; role: UserRole }) =>
      empresasApi.atualizarRole(clienteId!, userTenantId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consultores', clienteId] })
      toast.success('Permissão atualizada')
    },
    onError: () => toast.error('Erro ao atualizar permissão'),
  })

  if (!selectedTenant) {
    return (
      <div className="max-w-[960px] mx-auto px-6 py-6">
        <EmptyState
          variant="info"
          icon={Briefcase}
          title="Selecione uma empresa"
          description="para gerenciar a equipe"
          action={{ label: 'Ir pro portfolio', onClick: () => navigate('/portfolio'), variant: 'primary' }}
        />
      </div>
    )
  }

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-1)' }}>
            Equipe
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
            <strong>{selectedTenant.nome}</strong> · Gerencie quem tem acesso a esta empresa
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncFotosButton
            tipo="leads"
            invalidateKeys={[['conversations'], ['kanban']]}
          />
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg"
            style={{
              background: 'var(--gradient-brand)',
              boxShadow: 'var(--glow-brand-sm)',
            }}
          >
            <UserPlus size={14} />
            Adicionar consultor
          </button>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-[var(--bg-elevated)] animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          variant="error"
          icon={AlertTriangle}
          title="Erro ao carregar a equipe"
          action={{ label: 'Tentar de novo', onClick: () => refetch(), variant: 'primary' }}
        />
      ) : consultores.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{
            background: 'var(--bg-card)',
            border: '1px dashed var(--border)',
          }}
        >
          <Users2
            size={36}
            className="mx-auto mb-3"
            style={{ color: 'var(--text-3)' }}
          />
          <h3 className="font-semibold mb-1" style={{ color: 'var(--text-1)' }}>
            Nenhum consultor ainda
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>
            Adicione um funcionário pra dar acesso operacional a esta empresa.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg inline-flex items-center gap-2"
            style={{
              background: 'var(--gradient-brand)',
              boxShadow: 'var(--glow-brand-sm)',
            }}
          >
            <UserPlus size={14} />
            Adicionar primeiro consultor
          </button>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          {consultores.map((c, idx) => {
            const isMe = c.user_id === user?.id
            return (
              <div
                key={c.user_tenant_id}
                className="px-5 py-4 flex items-center gap-4"
                style={{
                  borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                }}
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0"
                  style={{ background: 'var(--brand-glow)', color: 'var(--brand-500)' }}
                >
                  {c.nome.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold" style={{ color: 'var(--text-1)' }}>
                      {c.nome}
                    </p>
                    {isMe && <Pill tone="role:admin">Você</Pill>}
                    {c.must_change_password && (
                      <Pill tone="status:active" icon={KeyRound}>
                        Aguardando troca de senha
                      </Pill>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-3)' }}>
                    {c.email}
                  </p>
                </div>

                {/* Role selector */}
                <select
                  value={c.role}
                  disabled={isMe || roleMutation.isPending}
                  onChange={(e) =>
                    roleMutation.mutate({
                      userTenantId: c.user_tenant_id,
                      role: e.target.value as UserRole,
                    })
                  }
                  className="text-xs rounded-lg px-2 py-1.5 outline-none"
                  style={{
                    background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)',
                    color: 'var(--text-1)',
                  }}
                  title={isMe ? 'Você não pode alterar seu próprio role' : undefined}
                >
                  <option value="admin">Admin (configura empresa)</option>
                  <option value="manager">Consultor (operacional)</option>
                  <option value="viewer">Visualizador (só leitura)</option>
                </select>

                {/* Remover */}
                {!isMe && (
                  <button
                    onClick={() => setRemoveTarget(c)}
                    className="p-2 rounded-lg flex-shrink-0 transition-colors"
                    style={{ color: 'var(--text-3)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239,68,68,0.1)'
                      e.currentTarget.style.color = '#ef4444'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--text-3)'
                    }}
                    aria-label="Remover consultor"
                    title="Remover acesso"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Hint sobre roles */}
      <div
        className="mt-6 rounded-xl p-4 flex items-start gap-3"
        style={{
          background: 'var(--brand-glow)',
          border: '1px solid var(--border)',
        }}
      >
        <ShieldCheck
          size={16}
          className="flex-shrink-0 mt-0.5"
          style={{ color: 'var(--brand-500)' }}
        />
        <div className="text-xs space-y-1" style={{ color: 'var(--text-2)' }}>
          <p>
            <strong style={{ color: 'var(--text-1)' }}>Admin</strong> — pode configurar
            a empresa (números, KPIs) e gerenciar a equipe.
          </p>
          <p>
            <strong style={{ color: 'var(--text-1)' }}>Consultor</strong> — atende leads,
            vê dashboard, kanban e conversas. Não configura.
          </p>
          <p>
            <strong style={{ color: 'var(--text-1)' }}>Visualizador</strong> — só vê,
            não edita nada.
          </p>
        </div>
      </div>

      {/* Modal de criação */}
      {showCreate && (
        <CreateConsultorModal
          clienteId={selectedTenant.id}
          empresaNome={selectedTenant.nome}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Modal de remoção */}
      <ConfirmModal
        open={!!removeTarget}
        title="Remover consultor da equipe?"
        description={
          removeTarget
            ? `${removeTarget.nome} (${removeTarget.email}) perderá acesso a ${selectedTenant.nome}. Pode adicionar de volta a qualquer momento.`
            : ''
        }
        confirmLabel="Remover acesso"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={removeMutation.isPending}
        onConfirm={() => {
          if (removeTarget) removeMutation.mutate(removeTarget)
        }}
        onClose={() => setRemoveTarget(null)}
      />
    </div>
  )
}
