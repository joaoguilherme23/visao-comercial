import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Tenant, UserRole } from '../types'

export interface NumeroBot {
  id: string
  numero: string
  nome: string | null
  ativo: boolean
}

interface TenantState {
  selectedTenant: Tenant | null
  tenantRole: UserRole | null
  selectedNumero: NumeroBot | null   // null = todos os números
  setSelectedTenant: (tenant: Tenant | null) => void
  setTenantRole: (role: UserRole | null) => void
  setSelectedNumero: (numero: NumeroBot | null) => void
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      selectedTenant: null,
      tenantRole: null,
      selectedNumero: null,
      setSelectedTenant: (tenant) => set({ selectedTenant: tenant, selectedNumero: null }),
      setTenantRole: (role) => set({ tenantRole: role }),
      setSelectedNumero: (numero) => set({ selectedNumero: numero }),
    }),
    {
      name: 'x9-tenant',
      partialize: (s) => ({ selectedTenant: s.selectedTenant, tenantRole: s.tenantRole }),
    }
  )
)
