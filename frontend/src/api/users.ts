import api from './client'
import { User, UserRole } from '../types'

export interface CreateUserPayload {
  email: string
  nome: string
  is_superadmin?: boolean
  is_manager_multi?: boolean
}

export interface AssignTenantPayload {
  user_id: string
  cliente_id: string
  role: UserRole
}

export interface MyTenantRole {
  cliente_id: string
  role: UserRole
}

// ── Admin enriched listing ──────────────────────────────────────────────────

export interface UserAdminTenantItem {
  user_tenant_id: string
  cliente_id: string
  cliente_nome: string
  cliente_nicho: string | null
  role: UserRole
  is_active: boolean
}

export interface UserAdminListItem {
  id: string
  email: string
  nome: string
  is_active: boolean
  is_superadmin: boolean
  is_manager_multi: boolean
  must_change_password: boolean
  avatar_url: string | null
  created_at: string
  tenants: UserAdminTenantItem[]
  total_empresas: number
}

export const usersApi = {
  list: () => api.get<User[]>('/users').then((r) => r.data),

  /** Listagem enriquecida pra tela admin: cada user com lista de empresas. */
  adminList: () =>
    api.get<UserAdminListItem[]>('/users/admin-list').then((r) => r.data),

  myTenants: () => api.get<MyTenantRole[]>('/users/me/tenants').then((r) => r.data),

  create: (data: CreateUserPayload) =>
    api.post<User>('/users', data).then((r) => r.data),

  update: (id: string, data: Partial<User & { password: string }>) =>
    api.patch<User>(`/users/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/users/${id}`),

  assignTenant: (data: AssignTenantPayload) =>
    api.post('/users/assign-tenant', data).then((r) => r.data),

  /**
   * Toggle is_manager_multi (superadmin only). Não permite auto-promoção:
   * se um manager_multi tentar chamar pra si mesmo, recebe 403.
   */
  setManagerMulti: (id: string, value: boolean) =>
    api
      .patch<User>(`/users/${id}/manager-multi`, { is_manager_multi: value })
      .then((r) => r.data),

  /** Muda o role de um vínculo user×empresa (PATCH tenant-access). */
  updateTenantRole: (utId: string, role: UserRole) =>
    api.patch(`/users/tenant-access/${utId}`, { role }).then((r) => r.data),

  /** Revoga acesso de um usuário a uma empresa (soft delete). */
  revokeTenantAccess: (utId: string) =>
    api.delete(`/users/tenant-access/${utId}`),

  /**
   * Admin define manualmente a senha de outro usuário (fallback quando SMTP
   * não está disponível). Permissões: superadmin OU admin de tenant onde o
   * target user também tem acesso. NÃO substitui o fluxo de email.
   *
   * `forcar_troca`: se true, seta must_change_password — usuário é forçado
   * a trocar a senha no próximo login.
   */
  adminResetPassword: (userId: string, senhaNova: string, forcarTroca: boolean) =>
    api
      .post<User>(`/users/${userId}/admin-reset-password`, {
        senha_nova: senhaNova,
        forcar_troca: forcarTroca,
      })
      .then((r) => r.data),
}
