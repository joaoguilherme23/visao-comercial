import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { X, UserPlus, Loader2, Mail } from 'lucide-react'
import { empresasApi, type EmailConflictDetail } from '../../api/empresas'
import { isAxiosError } from 'axios'

/**
 * Modal para criar consultor numa empresa específica.
 *
 * Fluxos:
 *   1. Email novo: cria User + UserTenant. Email de convite enviado automaticamente.
 *   2. Email existente: backend retorna 409. Modal pergunta se quer
 *      "atribuir o usuário existente" — se sim, chama /atribuir-existente.
 */
export default function CreateConsultorModal({
  clienteId,
  empresaNome,
  onClose,
}: {
  clienteId: string
  empresaNome: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [conflict, setConflict] = useState<EmailConflictDetail | null>(null)

  const createMutation = useMutation({
    mutationFn: () =>
      empresasApi.criarConsultor(clienteId, { email, nome }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consultores', clienteId] })
      toast.success(`${nome} adicionado! Email de convite enviado.`)
      onClose()
    },
    onError: (err) => {
      if (isAxiosError(err) && err.response?.status === 409) {
        const detail = err.response.data?.detail as EmailConflictDetail | undefined
        if (detail?.detail === 'email_exists') {
          setConflict(detail)
          return
        }
      }
      toast.error('Erro ao criar consultor')
    },
  })

  const attachMutation = useMutation({
    mutationFn: (userId: string) => empresasApi.atribuirExistente(clienteId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consultores', clienteId] })
      toast.success('Acesso concedido!')
      onClose()
    },
    onError: () => toast.error('Erro ao atribuir acesso'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createMutation.mutate()
  }

  // Se já caiu em 409 com email existente, mostra UI de "atribuir existente"
  if (conflict) {
    return (
      <ModalShell title="Email já cadastrado" onClose={onClose}>
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            O email <strong>{email}</strong> já pertence a{' '}
            <strong>{conflict.existing_user_nome}</strong> no sistema.
          </p>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            Quer dar acesso a esta empresa <strong>{empresaNome}</strong> pra
            esse usuário existente?
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setConflict(null)}
              className="px-4 py-2 text-sm rounded-lg"
              style={{ color: 'var(--text-2)' }}
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={attachMutation.isPending}
              onClick={() => attachMutation.mutate(conflict.existing_user_id)}
              className="px-4 py-2 text-sm rounded-lg font-medium text-white flex items-center gap-2"
              style={{
                background: 'var(--gradient-brand)',
                boxShadow: 'var(--glow-brand-sm)',
              }}
            >
              {attachMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              Sim, dar acesso
            </button>
          </div>
        </div>
      </ModalShell>
    )
  }

  return (
    <ModalShell title="Adicionar consultor" subtitle={empresaNome} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Nome</Label>
          <Input
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: João Silva"
            autoFocus
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@empresa.com"
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
          Um email de convite será enviado para o consultor definir a própria senha.
        </div>

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
            disabled={createMutation.isPending}
            className="px-4 py-2 text-sm rounded-lg font-medium text-white flex items-center gap-2 disabled:opacity-60"
            style={{
              background: 'var(--gradient-brand)',
              boxShadow: 'var(--glow-brand-sm)',
            }}
          >
            {createMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <UserPlus size={14} />
            )}
            Adicionar consultor
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}) {
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
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-1)' }}>
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                {subtitle}
              </p>
            )}
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
        {children}
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
