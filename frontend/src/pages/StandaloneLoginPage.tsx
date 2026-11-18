import { useEffect, useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail, ArrowRight, Loader2, Activity } from 'lucide-react'
import toast from 'react-hot-toast'

import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { X9Wordmark } from '../components/ui/X9Wordmark'
import { CentralSignout } from '../components/auth/CentralSignout'
import { CENTRAL_URL } from '../lib/centralUrl'

const OIDC_ENABLED = import.meta.env.VITE_OIDC_ENABLED === 'true'
const OIDC_BASE_URL = import.meta.env.VITE_OIDC_API_URL
  ?? (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/api\/v1\/?$/, '/api/auth/oidc')

/**
 * Login dedicado pro modo standalone (/standalone/feed).
 *
 * Diferenças do LoginPage:
 *  - Marca `standaloneMode=true` no auth store antes de redirecionar.
 *  - Sempre redireciona pra `/standalone/feed`, ignorando portfolio/dashboard.
 *  - Sem "voltar pro site" — é um dispositivo dedicado.
 */
export default function StandaloneLoginPage() {
  const navigate = useNavigate()
  const { setTokens, setUser, setStandaloneMode, isAuthenticated } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const isExplicitOidcLogout = OIDC_ENABLED && sessionStorage.getItem('x9-oidc-explicit-logout') === 'true'

  // Se o usuário já está autenticado e abriu /standalone/login direto,
  // marca standalone e cai pro feed.
  useEffect(() => {
    if (OIDC_ENABLED && !isExplicitOidcLogout) {
      window.location.assign(`${OIDC_BASE_URL}/login?return_to=${encodeURIComponent('/standalone/feed')}`)
      return
    }
    if (isAuthenticated) {
      setStandaloneMode(true)
      navigate('/standalone/feed', { replace: true })
    }
  }, [isAuthenticated, isExplicitOidcLogout, navigate, setStandaloneMode])

  const returnToOidcLogin = () => {
    sessionStorage.removeItem('x9-oidc-explicit-logout')
    window.location.assign(`${OIDC_BASE_URL}/login?return_to=${encodeURIComponent('/standalone/feed')}`)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (OIDC_ENABLED) {
      returnToOidcLogin()
      return
    }
    setLoading(true)
    try {
      const data = await authApi.login({ email, password })
      setTokens(data.access_token, data.refresh_token)
      setUser(data.user)
      setStandaloneMode(true)
      toast.success(`Bem-vindo, ${data.user.nome}!`)
      navigate('/standalone/feed', { replace: true })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        toast.error('Usuário inativo. Entre em contato com o administrador.')
      } else {
        toast.error('Credenciais inválidas')
      }
    } finally {
      setLoading(false)
    }
  }

  if (isExplicitOidcLogout) {
    return <CentralSignout onReturnToApp={returnToOidcLogin} />
  }

  if (OIDC_ENABLED) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base)', color: 'var(--text-1)' }}>
        <section className="w-full max-w-md p-8 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <X9Wordmark />
          <h1 className="text-2xl font-bold mt-6 mb-3">Entrar no monitor Visão Comercial</h1>
          <p className="mb-6">Use sua conta da Central de Acesso para continuar.</p>
          <form onSubmit={handleSubmit}>
            <button type="submit" className="w-full rounded-xl py-3 font-semibold" style={{ background: 'var(--gradient-brand)', color: '#fff' }}>
              Entrar com a Central
            </button>
          </form>
          <a href={CENTRAL_URL} className="block text-center text-sm mt-4" style={{ color: 'var(--text-2)' }}>
            Voltar para a Central
          </a>
        </section>
      </main>
    )
  }

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
        {/* Logo + título */}
        <div className="text-center mb-8">
          <div
            className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-5 mx-auto select-none"
            style={{
              background: 'var(--gradient-brand)',
              boxShadow: 'var(--glow-brand-md)',
            }}
          >
            <Activity size={28} color="#fff" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
            <X9Wordmark fontSize="1.5rem" /> · Feed
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
            Modo standalone — entrar direto no monitor de leads
          </p>
        </div>

        <div
          className="rounded-2xl p-7 space-y-5"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                Email
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--text-4)' }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="seu@email.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)',
                    color: 'var(--text-1)',
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                Senha
              </label>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--text-4)' }}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)',
                    color: 'var(--text-1)',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all mt-2"
              style={{
                background: loading
                  ? 'rgba(11,150,146, 0.5)'
                  : 'var(--gradient-brand)',
                boxShadow: loading ? 'none' : 'var(--glow-brand-md)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Entrando…
                </>
              ) : (
                <>
                  Entrar no feed
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs" style={{ color: 'var(--text-4)' }}>
            Após login, esta tela permanece em modo monitor.
          </p>
        </div>
      </div>
    </div>
  )
}
