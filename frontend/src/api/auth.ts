import api from './client'
import { User } from '../types'

export interface LoginPayload { email: string; password: string }
export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export interface ChangePasswordPayload {
  senha_atual: string
  senha_nova: string
}

export interface ForgotPasswordPayload { email: string }
export interface ResetPasswordPayload { token: string; senha_nova: string }

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<TokenResponse>('/auth/login', payload).then((r) => r.data),

  me: () => api.get<User>('/auth/me').then((r) => r.data),

  refresh: (refresh_token: string) =>
    api.post<TokenResponse>('/auth/refresh', { refresh_token }).then((r) => r.data),

  changePassword: (payload: ChangePasswordPayload) =>
    api.post<User>('/auth/change-password', payload).then((r) => r.data),

  /** Solicita email de redefinição de senha (resposta sempre 204). */
  forgotPassword: (payload: ForgotPasswordPayload) =>
    api.post('/auth/forgot-password', payload),

  /** Define nova senha via token de convite ou de reset. */
  resetPassword: (payload: ResetPasswordPayload) =>
    api.post('/auth/reset-password', payload),
}
