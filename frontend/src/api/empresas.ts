import api from './client'
import { UserRole } from '../types'

export interface Consultor {
  user_id: string
  email: string
  nome: string
  role: UserRole
  is_active: boolean
  must_change_password: boolean
  user_tenant_id: string
  created_at: string
}

export interface CreateConsultorPayload {
  email: string
  nome: string
}

export interface EmailConflictDetail {
  detail: 'email_exists'
  existing_user_id: string
  existing_user_nome: string
}

export const empresasApi = {
  /** Lista consultores ATIVOS de uma empresa. */
  listarConsultores: (clienteId: string) =>
    api
      .get<Consultor[]>(`/empresas/${clienteId}/consultores`)
      .then((r) => r.data),

  /**
   * Cria consultor novo (User + UserTenant). Senha provisória, must_change=true.
   *
   * Pode lançar 409 com EmailConflictDetail — caller deve oferecer fluxo
   * "atribuir existente" ou trocar email.
   */
  criarConsultor: (clienteId: string, body: CreateConsultorPayload) =>
    api
      .post<Consultor>(`/empresas/${clienteId}/consultores`, body)
      .then((r) => r.data),

  /** Atribui um User existente como consultor da empresa (após 409). */
  atribuirExistente: (clienteId: string, userId: string) =>
    api
      .post<Consultor>(`/empresas/${clienteId}/consultores/atribuir-existente`, {
        user_id: userId,
      })
      .then((r) => r.data),

  /** Muda role do consultor (manager <-> viewer <-> admin). */
  atualizarRole: (clienteId: string, userTenantId: string, role: UserRole) =>
    api
      .patch<Consultor>(
        `/empresas/${clienteId}/consultores/${userTenantId}/role`,
        { role }
      )
      .then((r) => r.data),

  /** Remove consultor da empresa (soft delete). */
  remover: (clienteId: string, userTenantId: string) =>
    api.delete(`/empresas/${clienteId}/consultores/${userTenantId}`),
}
