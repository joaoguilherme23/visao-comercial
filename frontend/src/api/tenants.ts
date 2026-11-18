import api from './client'
import { Tenant, TenantConnection, TenantUser, NumeroBot, UazapiStatus } from '../types'

export const tenantsApi = {
  list: () => api.get<Tenant[]>('/tenants').then((r) => r.data),

  get: (id: string) => api.get<Tenant>(`/tenants/${id}`).then((r) => r.data),

  create: (data: Partial<Tenant>) =>
    api.post<Tenant>('/tenants', data).then((r) => r.data),

  update: (id: string, data: Partial<Tenant>) =>
    api.patch<Tenant>(`/tenants/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/tenants/${id}`),

  /** Atualiza apenas dados cadastrais — endpoint usável pelo admin do cliente. */
  updateDadosCadastrais: (id: string, data: Partial<Tenant>) =>
    api.patch<Tenant>(`/tenants/${id}/dados-cadastrais`, data).then((r) => r.data),

  /** Upload da logo da empresa (multipart). */
  uploadAvatar: (id: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api
      .post<Tenant>(`/tenants/${id}/avatar`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },

  /** Remove a logo da empresa (foto_url = null). */
  deleteAvatar: (id: string) =>
    api.delete<Tenant>(`/tenants/${id}/avatar`).then((r) => r.data),

  getUsers: (id: string) =>
    api.get<TenantUser[]>(`/tenants/${id}/users`).then((r) => r.data),

  getConnections: (id: string) =>
    api.get<TenantConnection[]>(`/tenants/${id}/connections`).then((r) => r.data),

  createConnection: (id: string, data: Partial<TenantConnection>) =>
    api.post<TenantConnection>(`/tenants/${id}/connections`, data).then((r) => r.data),

  updateConnection: (tenantId: string, connId: string, data: Partial<TenantConnection>) =>
    api.patch<TenantConnection>(`/tenants/${tenantId}/connections/${connId}`, data).then((r) => r.data),

  deleteConnection: (tenantId: string, connId: string) =>
    api.delete(`/tenants/${tenantId}/connections/${connId}`),

  // ------------------------------------------------------------------
  // Números (bot WhatsApp)
  // ------------------------------------------------------------------

  getNumeros: (tenantId: string) =>
    api.get<NumeroBot[]>(`/tenants/${tenantId}/numeros`).then((r) => r.data),

  createNumero: (tenantId: string, data: { numero: string; nome?: string; webhook_url?: string }) =>
    api.post<NumeroBot>(`/tenants/${tenantId}/numeros`, data).then((r) => r.data),

  updateNumero: (tenantId: string, numeroId: string, data: { nome?: string; ativo?: boolean; webhook_url?: string }) =>
    api.patch<NumeroBot>(`/tenants/${tenantId}/numeros/${numeroId}`, data).then((r) => r.data),

  deleteNumero: (tenantId: string, numeroId: string) =>
    api.delete(`/tenants/${tenantId}/numeros/${numeroId}`),

  // ------------------------------------------------------------------
  // Uazapi — conectar / status / desconectar
  // ------------------------------------------------------------------

  connectNumero: (tenantId: string, numeroId: string) =>
    api.post<UazapiStatus>(`/tenants/${tenantId}/numeros/${numeroId}/connect`).then((r) => r.data),

  getNumeroStatus: (tenantId: string, numeroId: string) =>
    api.get<UazapiStatus>(`/tenants/${tenantId}/numeros/${numeroId}/status`).then((r) => r.data),

  disconnectNumero: (tenantId: string, numeroId: string) =>
    api.post<UazapiStatus>(`/tenants/${tenantId}/numeros/${numeroId}/disconnect`).then((r) => r.data),

  syncNumero: (tenantId: string, numeroId: string) =>
    api.post<UazapiStatus>(`/tenants/${tenantId}/numeros/${numeroId}/sync`).then((r) => r.data),
}
