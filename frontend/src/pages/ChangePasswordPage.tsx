import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'

/**
 * /change-password — tela obrigatória de troca de senha.
 *
 * Quando: user.must_change_password === true (consultor recém-criado pelo cliente).
 * Bloqueia: o guard RequireMustChange em App.tsx redireciona aqui antes
 * de qualquer rota protegida.
 *
 * Fluxo:
 *   1. user digita senha atual + nova + confirmação
 *   2. POST /auth/change-password
 *   3. Backend limpa must_change_password
 *   4. setUser atualiza store (flag fica false → guard libera)
 *   5. redireciona pro destino padrão (portfolio se manager_multi, senão dashboard)
 */
export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [showAtual, setShowAtual] = useState(false)
  const [showNova, setShowNova] = useState(false)

  const mutation = useMutation({
    mutationFn: () => authApi.changePassword({ senha_atual: senhaAtual, senha_nova: senhaNova }),
    onSuccess: (updatedUser) => {
      setUser(updatedUser)
      toast.success('Senha alterada com sucesso')
      const destino = (updatedUser.is_manager_multi || updatedUser.is_superadmin)
        ? '/portfolio'
        : '/dashboard'
      navigate(destino, { replace: true })
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      const msg = err.response?.data?.detail ?? 'Erro ao trocar a senha'
      toast.error(msg)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (senhaNova.length < 8) {
      toast.error('Nova senha deve ter no mínimo 8 caracteres')
      return
    }
    if (senhaNova !== confirmar) {
      toast.error('As senhas não conferem')
      return
    }
    if (senhaNova === senhaAtual) {
      toast.error('A nova senha deve ser diferente da atual')
      return
    }
    mutation.mutate()
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg-base)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--brand-glow)', color: 'var(--brand-500)' }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
              Defina sua senha
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              {user?.email}
            </p>
          </div>
        </div>

        <p className="text-sm mb-6 mt-3" style={{ color: 'var(--text-2)' }}>
          Você está usando uma senha provisória. Antes de continuar, escolha uma
          senha pessoal — mínimo de 8 caracteres.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            label="Senha atual (provisória)"
            value={senhaAtual}
            onChange={setSenhaAtual}
            visible={showAtual}
            toggleVisible={() => setShowAtual((s) => !s)}
            autoFocus
          />
          <PasswordInput
            label="Nova senha"
            value={senhaNova}
            onChange={setSenhaNova}
            visible={showNova}
            toggleVisible={() => setShowNova((s) => !s)}
            hint={`${senhaNova.length}/8 caracteres mínimos`}
          />
          <PasswordInput
            label="Confirmar nova senha"
            value={confirmar}
            onChange={setConfirmar}
            visible={showNova}
            toggleVisible={() => setShowNova((s) => !s)}
            error={confirmar.length > 0 && confirmar !== senhaNova ? 'As senhas não conferem' : undefined}
          />

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50"
            style={{
              background: 'var(--gradient-brand)',
              color: '#fff',
              boxShadow: 'var(--glow-brand-sm)',
            }}
          >
            {mutation.isPending ? 'Salvando...' : 'Trocar senha e continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}

function PasswordInput({
  label,
  value,
  onChange,
  visible,
  toggleVisible,
  hint,
  error,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  visible: boolean
  toggleVisible: () => void
  hint?: string
  error?: string
  autoFocus?: boolean
}) {
  return (
    <div>
      <label
        className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: 'var(--text-3)' }}
      >
        {label}
      </label>
      <div className="relative">
        <Lock
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--text-3)' }}
        />
        <input
          required
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          className="w-full pl-9 pr-10 py-2 rounded-lg text-sm outline-none transition-all"
          style={{
            background: 'var(--input-bg)',
            border: `1px solid ${error ? '#ef4444' : 'var(--input-border)'}`,
            color: 'var(--text-1)',
          }}
          onFocus={(e) => {
            if (!error) e.currentTarget.style.borderColor = 'var(--brand-500)'
          }}
          onBlur={(e) => {
            if (!error) e.currentTarget.style.borderColor = 'var(--input-border)'
          }}
        />
        <button
          type="button"
          onClick={toggleVisible}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--text-3)' }}
        >
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {(hint || error) && (
        <p
          className="text-xs mt-1"
          style={{ color: error ? '#ef4444' : 'var(--text-3)' }}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  )
}
