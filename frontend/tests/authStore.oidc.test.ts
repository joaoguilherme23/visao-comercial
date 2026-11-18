import { beforeEach, describe, expect, it, vi } from 'vitest'

const axios = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('axios', () => ({ default: axios }))

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'user@example.test',
  nome: 'Usuário de teste',
  is_superadmin: false,
  is_manager_multi: false,
  must_change_password: false,
}

function installStorage(name: 'localStorage' | 'sessionStorage') {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, String(value)),
    },
  })
  return values
}

async function loadStore(oidcEnabled: boolean) {
  vi.resetModules()
  vi.stubEnv('VITE_OIDC_ENABLED', oidcEnabled ? 'true' : '')
  vi.stubEnv('VITE_API_URL', '')
  return (await import('../src/store/authStore')).useAuthStore
}

describe('sessão OIDC do X9', () => {
  beforeEach(() => {
    axios.get.mockReset()
    axios.post.mockReset()
    installStorage('localStorage')
    installStorage('sessionStorage')
  })

  it('não persiste JWT e inicializa somente a partir do cookie BFF', async () => {
    const store = await loadStore(true)
    axios.get.mockResolvedValue({ data: user, headers: { 'x-csrf-token': 'csrf-test' } })

    await store.getState().initializeAuth()
    store.getState().setTokens('jwt-access', 'jwt-refresh')

    expect(axios.get).toHaveBeenCalledWith('/api/auth/oidc/session', { withCredentials: true })
    expect(store.getState()).toMatchObject({
      user,
      csrfToken: 'csrf-test',
      isAuthenticated: true,
      accessToken: null,
      refreshToken: null,
    })
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })

  it('remove o marcador de saída somente depois que uma nova sessão BFF é validada', async () => {
    const store = await loadStore(true)
    sessionStorage.setItem('x9-oidc-explicit-logout', 'true')
    axios.get.mockResolvedValue({ data: user, headers: { 'x-csrf-token': 'csrf-test' } })

    await store.getState().initializeAuth()

    expect(store.getState()).toMatchObject({ user, isAuthenticated: true })
    expect(sessionStorage.getItem('x9-oidc-explicit-logout')).toBeNull()
  })

  it('falha fechada quando a sessão OIDC é inválida', async () => {
    const store = await loadStore(true)
    axios.get.mockRejectedValue(new Error('401'))

    await store.getState().initializeAuth()

    expect(store.getState()).toMatchObject({
      user: null,
      csrfToken: null,
      isAuthenticated: false,
      initializing: false,
    })
  })

  it('envia CSRF no logout OIDC confirmado e limpa o estado local', async () => {
    const store = await loadStore(true)
    store.setState({ user, csrfToken: 'csrf-test', isAuthenticated: true })

    axios.post.mockResolvedValue({})
    await store.getState().logout()

    expect(axios.post).toHaveBeenCalledWith('/api/auth/oidc/logout', undefined, {
      withCredentials: true,
      headers: { 'X-CSRF-Token': 'csrf-test' },
    })
    expect(store.getState()).toMatchObject({ user: null, csrfToken: null, isAuthenticated: false })
    expect(sessionStorage.getItem('x9-oidc-explicit-logout')).toBe('true')
    expect(store.getState().isLoggingOut).toBe(false)
  })

  it('preserva a sessão e restaura o marcador quando a revogação remota falha', async () => {
    const store = await loadStore(true)
    store.setState({ user, csrfToken: 'csrf-test', isAuthenticated: true })
    axios.post.mockRejectedValue(new Error('network'))

    const revoked = await store.getState().logout()

    expect(revoked).toBe(false)
    expect(store.getState()).toMatchObject({ user, csrfToken: 'csrf-test', isAuthenticated: true, isLoggingOut: false })
    expect(sessionStorage.getItem('x9-oidc-explicit-logout')).toBeNull()
  })

  it('mantém uma única revogação em voo e sinaliza a corrida para o interceptor', async () => {
    const store = await loadStore(true)
    store.setState({ user, csrfToken: 'csrf-test', isAuthenticated: true })
    let resolveLogout: (() => void) | undefined
    axios.post.mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveLogout = resolve
      }),
    )

    const firstLogout = store.getState().logout()
    const secondLogout = store.getState().logout()

    expect(axios.post).toHaveBeenCalledTimes(1)
    expect(store.getState()).toMatchObject({ user, isAuthenticated: true, isLoggingOut: true })
    expect(sessionStorage.getItem('x9-oidc-explicit-logout')).toBe('true')

    resolveLogout?.()
    await expect(firstLogout).resolves.toBe(true)
    await expect(secondLogout).resolves.toBe(true)
    expect(store.getState()).toMatchObject({ user: null, isAuthenticated: false, isLoggingOut: false })
  })

  it('encerra somente a sessão local quando a sessão BFF já expirou', async () => {
    const store = await loadStore(true)
    store.setState({ user, csrfToken: 'csrf-test', isAuthenticated: true })
    axios.post.mockRejectedValue({ response: { status: 401 } })

    await expect(store.getState().logout()).resolves.toBe(true)

    expect(store.getState()).toMatchObject({
      user: null,
      csrfToken: null,
      isAuthenticated: false,
      isLoggingOut: false,
    })
    expect(sessionStorage.getItem('x9-oidc-explicit-logout')).toBe('true')
  })

  it('preserva a sessão quando o logout é rejeitado por CSRF', async () => {
    const store = await loadStore(true)
    store.setState({ user, csrfToken: 'csrf-test', isAuthenticated: true })
    axios.post.mockRejectedValue({ response: { status: 403 } })

    await expect(store.getState().logout()).resolves.toBe(false)

    expect(store.getState()).toMatchObject({
      user,
      csrfToken: 'csrf-test',
      isAuthenticated: true,
      isLoggingOut: false,
    })
    expect(sessionStorage.getItem('x9-oidc-explicit-logout')).toBeNull()
  })

  it('mantém o fluxo JWT legado quando OIDC está desligado', async () => {
    const store = await loadStore(false)

    store.getState().setTokens('legacy-access', 'legacy-refresh')

    expect(localStorage.getItem('access_token')).toBe('legacy-access')
    expect(localStorage.getItem('refresh_token')).toBe('legacy-refresh')
    expect(store.getState().isAuthenticated).toBe(true)
  })
})
