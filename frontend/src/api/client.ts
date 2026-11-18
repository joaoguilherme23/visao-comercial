import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../store/authStore'

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'
const OIDC_ENABLED = import.meta.env.VITE_OIDC_ENABLED === 'true'
const OIDC_BASE_URL = import.meta.env.VITE_OIDC_API_URL ?? BASE_URL.replace(/\/api\/v1\/?$/, '/api/auth/oidc')

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: OIDC_ENABLED,
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (OIDC_ENABLED && config.headers) {
    const csrfToken = useAuthStore.getState().csrfToken
    const method = (config.method ?? 'get').toLowerCase()
    if (csrfToken && !['get', 'head', 'options'].includes(method)) {
      config.headers['X-CSRF-Token'] = csrfToken
    }
  } else {
    const token = localStorage.getItem('access_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Single-flight do refresh: quando um burst de requests recebe 401 ao mesmo
// tempo (ex.: dashboard com ~15 chamadas em paralelo), só um dispara o
// /auth/refresh; os demais aguardam o mesmo Promise. Evita corrida que podia
// terminar em logout() + sobrescrever tokens e deixar o store em estado
// inconsistente.
let refreshInFlight: Promise<string> | null = null

async function doRefresh(): Promise<string> {
  const refresh = localStorage.getItem('refresh_token')
  if (!refresh) throw new Error('no_refresh_token')
  const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
    refresh_token: refresh,
  })
  useAuthStore.getState().setTokens(data.access_token, data.refresh_token)
  return data.access_token as string
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const status = error.response?.status
    if (status !== 401 || !original || original._retry) {
      return Promise.reject(error)
    }

    if (OIDC_ENABLED) {
      // Após um logout explícito, requests em voo podem terminar em 401. Não
      // reabra o IdP: a tela de saída deve aguardar uma nova ação do usuário.
      if (
        useAuthStore.getState().isLoggingOut ||
        sessionStorage.getItem('x9-oidc-explicit-logout') === 'true'
      ) {
        return Promise.reject(error)
      }
      const returnTo = `${window.location.pathname}${window.location.search}`
      window.location.assign(`${OIDC_BASE_URL}/login?return_to=${encodeURIComponent(returnTo)}`)
      return Promise.reject(error)
    }

    original._retry = true

    try {
      if (!refreshInFlight) {
        refreshInFlight = doRefresh().finally(() => {
          refreshInFlight = null
        })
      }
      const newAccess = await refreshInFlight
      original.headers = original.headers ?? {}
      original.headers.Authorization = `Bearer ${newAccess}`
      return api(original)
    } catch {
      const { logout, standaloneMode } = useAuthStore.getState()
      await logout()
      const target = standaloneMode ? '/standalone/login' : '/login'
      if (typeof window !== 'undefined' && window.location.pathname !== target) {
        window.location.href = target
      }
      return Promise.reject(error)
    }
  }
)

export default api
