import { useState, FormEvent, ReactNode } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { Lock, ArrowRight, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { authApi } from '../api/auth'
import { X9Wordmark } from '../components/ui/X9Wordmark'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''

  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  if (!token) {
    return (
      <PageShell>
        <div className="text-center space-y-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <AlertTriangle size={24} className="text-red-400" />
          </div>
          <p className="text-sm font-semibold text-white">Link inválido</p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            Este link de redefinição é inválido ou já foi utilizado.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-400 hover:text-brand-300 transition-colors"
          >
            Voltar para o login
          </Link>
        </div>
      </PageShell>
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (senha !== confirma) {
      setError('As senhas não coincidem.')
      return
    }
    if (senha.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await authApi.resetPassword({ token, senha_nova: senha })
      setDone(true)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 400) {
        setError('Link inválido ou expirado. Solicite um novo link de redefinição.')
      } else {
        setError('Ocorreu um erro. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageShell>
      {!done ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="text-center space-y-1 mb-2">
            <p className="text-base font-semibold text-white">Criar nova senha</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              Escolha uma senha forte com pelo menos 8 caracteres.
            </p>
          </div>

          {/* Nova senha */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
              Nova senha
            </label>
            <div className="relative">
              <Lock
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-4)' }}
              />
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                autoFocus
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-gray-200 placeholder-gray-600 outline-none transition-all"
                style={{
                  background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--brand-500)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--input-border)')}
              />
            </div>
          </div>

          {/* Confirmação */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
              Confirmar senha
            </label>
            <div className="relative">
              <Lock
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-4)' }}
              />
              <input
                type="password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-gray-200 placeholder-gray-600 outline-none transition-all"
                style={{
                  background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--brand-500)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--input-border)')}
              />
            </div>
          </div>

          {error && (
            <div
              className="rounded-xl px-4 py-3 flex items-start gap-2.5 text-xs"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                color: '#fca5a5',
              }}
            >
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all"
            style={{
              background: loading ? 'rgba(11,150,146,0.5)' : 'var(--gradient-brand)',
              boxShadow: loading ? 'none' : 'var(--glow-brand-md)',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                Salvar nova senha
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>
      ) : (
        /* Sucesso */
        <div className="text-center space-y-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}
          >
            <CheckCircle size={24} className="text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-1">Senha criada com sucesso!</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>
              Você receberá um email de confirmação. Agora pode entrar na plataforma.
            </p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all"
            style={{
              background: 'var(--gradient-brand)',
              boxShadow: 'var(--glow-brand-md)',
            }}
          >
            Ir para o login
            <ArrowRight size={15} />
          </button>
        </div>
      )}
    </PageShell>
  )
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg-base)' }}
    >
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 40%, rgba(11,150,146,0.07) 0%, transparent 70%)',
        }}
      />
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div
            className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-5 mx-auto select-none"
            style={{
              background: 'var(--gradient-brand)',
              boxShadow: 'var(--glow-brand-md)',
            }}
          >
            <X9Wordmark fontSize="1.5rem" variant="solid" color="#ffffff" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            <X9Wordmark fontSize="1.5rem" />
          </h1>
        </div>
        <div
          className="rounded-2xl p-7"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
