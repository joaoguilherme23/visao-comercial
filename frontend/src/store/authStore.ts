import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import axios from 'axios'
import { User } from '../types'
import { useTenantStore } from './tenantStore'

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'
const OIDC_ENABLED = import.meta.env.VITE_OIDC_ENABLED === 'true'
const OIDC_BASE_URL = import.meta.env.VITE_OIDC_API_URL ?? BASE_URL.replace(/\/api\/v1\/?$/, '/api/auth/oidc')
const EXPLICIT_LOGOUT_KEY = 'x9-oidc-explicit-logout'
let oidcLogoutInFlight: Promise<boolean> | null = null
const memoryOnlyStorage = {
  getItem: (_name: string) => null,
  setItem: (_name: string, _value: string) => {},
  removeItem: (_name: string) => {},
}

function clearTenantContext(): void {
  const tenantStore = useTenantStore.getState()
  tenantStore.setSelectedTenant(null)
  tenantStore.setTenantRole(null)
}

function clearOidcLocalSession(set: (state: Partial<AuthState>) => void): void {
  localStorage.removeItem('x9-tenant')
  clearTenantContext()
  set({ user: null, accessToken: null, refreshToken: null, csrfToken: null, isAuthenticated: false, isLoggingOut: false })
}

function responseStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status
}

// Heurística simples para detectar "user" corrompido (HTML/string) vindo de
// uma request que bateu no nginx em vez do backend — bug histórico em que o
// initializeAuth usava URL relativa e caía no fallback do SPA.
function isValidUser(u: unknown): u is User {
  return (
    !!u &&
    typeof u === 'object' &&
    typeof (u as User).id === 'string' &&
    typeof (u as User).email === 'string' &&
    typeof (u as User).nome === 'string'
  )
}

/**
 * Garante valores default para flags booleanas que podem vir undefined de
 * versões antigas do backend (proteção pra rolling deploy).
 */
function normalizeUser(u: User): User {
  return {
    ...u,
    is_superadmin: !!u.is_superadmin,
    is_manager_multi: !!u.is_manager_multi,
    must_change_password: !!u.must_change_password,
  }
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  csrfToken: string | null
  isAuthenticated: boolean
  initializing: boolean
  isLoggingOut: boolean
  /**
   * Quando true, o usuário fez login via /standalone/login. Logout redireciona
   * de volta pra /standalone/login (não pra /login). Permite que monitores
   * dedicados em modo standalone fiquem sempre num loop "feed → login → feed".
   */
  standaloneMode: boolean
  setTokens: (access: string, refresh: string) => void
  setUser: (user: User) => void
  setStandaloneMode: (enabled: boolean) => void
  logout: () => Promise<boolean>
  initializeAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      csrfToken: null,
      isAuthenticated: false,
      initializing: true,
      isLoggingOut: false,
      standaloneMode: false,

      setStandaloneMode: (enabled) => set({ standaloneMode: enabled }),

      setTokens: (access, refresh) => {
        if (OIDC_ENABLED) return
        localStorage.setItem('access_token', access)
        localStorage.setItem('refresh_token', refresh)
        set({ accessToken: access, refreshToken: refresh, isAuthenticated: true })
      },

      setUser: (user) => {
        if (!isValidUser(user)) {
          // Defesa em profundidade: nunca persistir um user inválido.
          return
        }
        set({ user: normalizeUser(user) })
      },

      logout: () => {
        if (OIDC_ENABLED) {
          if (oidcLogoutInFlight) return oidcLogoutInFlight

          const csrfToken = get().csrfToken
          const previousExplicitLogout = sessionStorage.getItem(EXPLICIT_LOGOUT_KEY)
          // Marca primeiro para suprimir redirects de requests concorrentes
          // enquanto a revogação HTTP ainda está em andamento.
          sessionStorage.setItem(EXPLICIT_LOGOUT_KEY, 'true')
          set({ isLoggingOut: true })

          oidcLogoutInFlight = (async () => {
            try {
              await axios.post(`${OIDC_BASE_URL}/logout`, undefined, {
                withCredentials: true,
                headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
              })
            } catch (error: unknown) {
              // 401 indica que a sessão BFF já expirou ou foi removida. O
              // backend confirma a origem e limpa cookies residuais; isto não
              // declara que uma nova revogação remota ocorreu.
              if (responseStatus(error) === 401) {
                clearOidcLocalSession(set)
                return true
              }
              if (previousExplicitLogout === null) {
                sessionStorage.removeItem(EXPLICIT_LOGOUT_KEY)
              } else {
                sessionStorage.setItem(EXPLICIT_LOGOUT_KEY, previousExplicitLogout)
              }
              set({ isLoggingOut: false })
              return false
            }

            clearOidcLocalSession(set)
            return true
          })().finally(() => {
            oidcLogoutInFlight = null
          })
          return oidcLogoutInFlight
        }
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        // Limpa o tenant store persist pra não vazar selectedTenant/tenantRole
        // entre sessões (ex.: superadmin logout → consultor login herdava role admin).
        localStorage.removeItem('x9-tenant')
        // standaloneMode é preservado intencionalmente — quem usa monitor
        // dedicado quer cair de volta no /standalone/login após sessão expirar.
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
        return Promise.resolve(true)
      },

      initializeAuth: async () => {
        if (OIDC_ENABLED) {
          try {
            const response = await axios.get<User>(`${OIDC_BASE_URL}/session`, { withCredentials: true })
            if (!isValidUser(response.data)) throw new Error('Resposta inválida de sessão OIDC')
            const csrfToken = response.headers['x-csrf-token']
            if (typeof csrfToken !== 'string' || !csrfToken) throw new Error('CSRF ausente')
            // O tenant persistido pode pertencer a uma sessão anterior; a seleção
            // só volta a existir após a lista autorizada da sessão atual carregar.
            clearTenantContext()
            // O launcher da Central entra diretamente no BFF, sem passar pela
            // tela /login. Só uma sessão BFF validada pode desfazer o marcador
            // de logout explícito: em refresh sem nova autenticação, o marcador
            // permanece e a tela de saída não reinicia o SSO sozinha.
            sessionStorage.removeItem(EXPLICIT_LOGOUT_KEY)
            set({ user: normalizeUser(response.data), csrfToken, isAuthenticated: true, initializing: false })
          } catch {
            clearTenantContext()
            set({ user: null, accessToken: null, refreshToken: null, csrfToken: null, isAuthenticated: false, initializing: false })
          }
          return
        }
        const { isAuthenticated, refreshToken, user: persistedUser } = get()

        // Se o user persistido está corrompido (ex.: string HTML de um bug
        // anterior onde /api/v1/auth/me caía no fallback do nginx), força
        // limpeza para evitar renderizar sidebar quebrada.
        if (persistedUser !== null && !isValidUser(persistedUser)) {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, initializing: false })
          return
        }

        if (!isAuthenticated) {
          set({ initializing: false })
          return
        }

        try {
          // Tenta validar a sessão atual via /auth/me — usa BASE_URL pra não
          // cair no fallback do SPA quando VITE_API_URL aponta pra outro host.
          const token = localStorage.getItem('access_token')
          const { data: user } = await axios.get(`${BASE_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (!isValidUser(user)) {
            throw new Error('Resposta inválida de /auth/me')
          }
          set({ user: normalizeUser(user), initializing: false })
        } catch {
          // Access token inválido — tenta refresh silencioso
          if (refreshToken) {
            try {
              const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
                refresh_token: refreshToken,
              })
              if (!isValidUser(data?.user)) {
                throw new Error('Resposta inválida de /auth/refresh')
              }
              localStorage.setItem('access_token', data.access_token)
              localStorage.setItem('refresh_token', data.refresh_token)
              set({
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                user: normalizeUser(data.user),
                isAuthenticated: true,
                initializing: false,
              })
            } catch {
              localStorage.removeItem('access_token')
              localStorage.removeItem('refresh_token')
              set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, initializing: false })
            }
          } else {
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
            set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, initializing: false })
          }
        }
      },
    }),
    {
      name: 'x9-auth',
      storage: OIDC_ENABLED ? createJSONStorage(() => memoryOnlyStorage) : undefined,
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        isAuthenticated: s.isAuthenticated,
        standaloneMode: s.standaloneMode,
      }),
    }
  )
)
