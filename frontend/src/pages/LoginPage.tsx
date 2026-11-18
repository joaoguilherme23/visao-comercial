import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Lock, Mail, ArrowRight, Loader2, Sparkles, ArrowLeft, KeyRound, X } from 'lucide-react'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { X9Wordmark } from '../components/ui/X9Wordmark'
import { CentralSignout } from '../components/auth/CentralSignout'
import toast from 'react-hot-toast'
import { CENTRAL_URL } from '../lib/centralUrl'

const DEMO_EMAIL = 'demo-admin@example.com'
const OIDC_ENABLED = import.meta.env.VITE_OIDC_ENABLED === 'true'
const OIDC_BASE_URL = import.meta.env.VITE_OIDC_API_URL
  ?? (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/api\/v1\/?$/, '/api/auth/oidc')

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isDemo = searchParams.get('demo') === '1'
  const { setTokens, setUser } = useAuthStore()
  const [email, setEmail] = useState(isDemo ? DEMO_EMAIL : '')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const isExplicitOidcLogout = OIDC_ENABLED && sessionStorage.getItem('x9-oidc-explicit-logout') === 'true'

  // esqueci senha
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  useEffect(() => {
    if (isDemo) setEmail(DEMO_EMAIL)
  }, [isDemo])

  useEffect(() => {
    if (OIDC_ENABLED && !isExplicitOidcLogout) {
      window.location.assign(`${OIDC_BASE_URL}/login?return_to=${encodeURIComponent('/dashboard')}`)
    }
  }, [isExplicitOidcLogout])

  const returnToOidcLogin = () => {
    sessionStorage.removeItem('x9-oidc-explicit-logout')
    window.location.assign(`${OIDC_BASE_URL}/login?return_to=${encodeURIComponent('/dashboard')}`)
  }

  const handleSubmit = async (e: FormEvent) => {
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
      toast.success(`Bem-vindo, ${data.user.nome}!`)
      const destino = (data.user.is_manager_multi || data.user.is_superadmin)
        ? '/portfolio'
        : '/dashboard'
      navigate(destino)
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

  const handleForgotSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setForgotLoading(true)
    try {
      await authApi.forgotPassword({ email: forgotEmail })
      setForgotSent(true)
    } catch {
      // sempre mostra sucesso para não revelar se email existe
      setForgotSent(true)
    } finally {
      setForgotLoading(false)
    }
  }

  const closeForgot = () => {
    setShowForgot(false)
    setForgotEmail('')
    setForgotSent(false)
  }

  if (isExplicitOidcLogout) {
    return <CentralSignout onReturnToApp={returnToOidcLogin} />
  }

  if (OIDC_ENABLED) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base)', color: 'var(--text-1)' }}>
        <section className="w-full max-w-md p-8 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <X9Wordmark />
          <h1 className="text-2xl font-bold mt-6 mb-3">Entrar na Visão Comercial</h1>
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
      {/* subtle radial glow behind the card */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 40%, rgba(11,150,146,0.07) 0%, transparent 70%)',
        }}
      />

      <div className="w-full max-w-sm relative">
        {/* Back to site */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs mb-6 transition-colors"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-3)')}
        >
          <ArrowLeft size={13} />
          Voltar para o site
        </Link>

        {/* Logo + title */}
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
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
            Análise inteligente de conversas WhatsApp
          </p>
        </div>

        {/* Demo banner */}
        {isDemo && (
          <div
            className="mb-4 rounded-xl px-4 py-3 flex items-start gap-2.5"
            style={{
              background: 'rgba(11,150,146,0.08)',
              border: '1px solid rgba(11,150,146,0.25)',
            }}
          >
            <Sparkles size={14} className="mt-0.5 flex-shrink-0 text-brand-400" />
            <div className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
              <span className="font-semibold text-white">Modo demo.</span> Email preenchido com a
              conta de demonstração. Consulte as credenciais geradas localmente para entrar.
            </div>
          </div>
        )}

        {/* Card */}
        <div
          className="rounded-2xl p-7 space-y-5"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          }}
        >
          {!showForgot ? (
            /* ── Login form ── */
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
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

                {/* Senha */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => { setShowForgot(true); setForgotEmail(email) }}
                      className="text-xs transition-colors"
                      style={{ color: 'var(--text-4)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--brand-400)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-4)')}
                    >
                      Esqueci minha senha
                    </button>
                  </div>
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

                {/* Botão */}
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
                  onMouseEnter={(e) => {
                    if (!loading) e.currentTarget.style.boxShadow = 'var(--glow-brand-lg)'
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) e.currentTarget.style.boxShadow = 'var(--glow-brand-md)'
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      Entrar
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-4)' }}>
                  <X9Wordmark fontSize="0.75rem" /> · WhatsApp AI
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              </div>

              <p className="text-center text-xs" style={{ color: 'var(--text-4)' }}>
                Acesso restrito a usuários autorizados
              </p>
            </>
          ) : (
            /* ── Esqueci minha senha ── */
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(11,150,146,0.15)' }}
                  >
                    <KeyRound size={15} className="text-brand-400" />
                  </div>
                  <span className="text-sm font-semibold text-white">Redefinir senha</span>
                </div>
                <button
                  onClick={closeForgot}
                  className="p-1 rounded-lg transition-colors"
                  style={{ color: 'var(--text-4)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-4)')}
                >
                  <X size={16} />
                </button>
              </div>

              {!forgotSent ? (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                    Informe o email da sua conta. Enviaremos um link para você criar uma nova senha.
                  </p>
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
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                        autoFocus
                        autoComplete="email"
                        placeholder="seu@email.com"
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
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all"
                    style={{
                      background: forgotLoading ? 'rgba(11,150,146,0.5)' : 'var(--gradient-brand)',
                      boxShadow: forgotLoading ? 'none' : 'var(--glow-brand-md)',
                      cursor: forgotLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        Enviar link
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={closeForgot}
                    className="w-full text-center text-xs py-2 transition-colors"
                    style={{ color: 'var(--text-4)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-4)')}
                  >
                    Voltar para o login
                  </button>
                </form>
              ) : (
                /* Confirmação enviada */
                <div className="space-y-4 text-center">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                    style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}
                  >
                    <Mail size={24} className="text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white mb-1">Email enviado!</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>
                      Se o email <span className="text-white font-medium">{forgotEmail}</span> estiver
                      cadastrado, você receberá as instruções em instantes.
                      O link é válido por <span className="text-white font-medium">2 horas</span>.
                    </p>
                  </div>
                  <button
                    onClick={closeForgot}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all"
                    style={{
                      background: 'var(--gradient-brand)',
                      boxShadow: 'var(--glow-brand-md)',
                    }}
                  >
                    Voltar para o login
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
