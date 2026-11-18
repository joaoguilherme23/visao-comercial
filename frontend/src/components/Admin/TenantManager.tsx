import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tenantsApi } from '../../api/tenants'
import { usersApi } from '../../api/users'
import { Tenant } from '../../types'
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Users2, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Pill, ConfirmModal } from '../ds'
import { resolveAvatarUrl } from '../../lib/avatarUrl'
import { formatCNPJ } from '../../lib/cnpj'
import TenantDrawer from './TenantDrawer'

export default function TenantManager() {
  const qc = useQueryClient()
  /** drawer state — null = fechado; { tenant: null } = criar; { tenant: T } = editar. */
  const [drawerState, setDrawerState] = useState<{ tenant: Tenant | null } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Tenant | null>(null)

  const { data: tenants = [], isLoading } = useQuery({ queryKey: ['tenants'], queryFn: tenantsApi.list })

  const { data: adminUsers = [] } = useQuery({
    queryKey: ['users', 'admin-list'],
    queryFn: usersApi.adminList,
    staleTime: 30_000,
  })

  const peopleByCliente = useMemo(() => {
    const map = new Map<string, { total: number; clientes: number; consultores: number }>()
    for (const u of adminUsers) {
      if (u.is_superadmin) continue
      for (const t of u.tenants) {
        if (!t.is_active) continue
        const cur = map.get(t.cliente_id) ?? { total: 0, clientes: 0, consultores: 0 }
        cur.total += 1
        if (u.is_manager_multi) cur.clientes += 1
        else cur.consultores += 1
        map.set(t.cliente_id, cur)
      }
    }
    return map
  }, [adminUsers])

  const toggleAtivoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Tenant> }) => tenantsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
    onError: () => toast.error('Erro ao atualizar'),
  })

  const deleteMutation = useMutation({
    mutationFn: tenantsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); setDeleteConfirm(null); toast.success('Removido') },
    onError: () => toast.error('Erro ao remover'),
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          Empresas
          {tenants.length > 0 && (
            <Pill tone="role:admin" size="xs" className="font-bold align-middle">
              {tenants.length}
            </Pill>
          )}
        </h2>
        <button
          onClick={() => setDrawerState({ tenant: null })}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 hover:shadow-glow-brand-md text-white rounded-lg text-sm font-medium transition-all"
        >
          <Plus size={15} /> Nova Empresa
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl" style={{ background: 'var(--bg-elevated)' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 rounded" style={{ background: 'var(--bg-elevated)' }} />
                  <div className="h-2 w-24 rounded" style={{ background: 'var(--bg-elevated)' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {tenants.map((t) => {
            const fotoSrc = resolveAvatarUrl(t.foto_url)
            return (
              <div
                key={t.id}
                className="rounded-xl p-4 flex items-center gap-4 transition-colors"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              >
                {/* Avatar/logo da empresa */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 overflow-hidden"
                  style={{
                    background: fotoSrc ? 'transparent' : 'rgba(11,150,146,0.15)',
                    color: '#a5b4fc',
                    border: '1px solid rgba(11,150,146,0.2)',
                  }}
                >
                  {fotoSrc ? (
                    <img src={fotoSrc} alt="" className="w-full h-full object-cover" />
                  ) : (
                    t.nome.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-200">{t.nome}</p>
                    {t.razao_social && t.razao_social !== t.nome && (
                      <span className="text-xs italic" style={{ color: 'var(--text-3)' }}>
                        {t.razao_social}
                      </span>
                    )}
                    <span className="text-xs text-gray-600">/{t.slug}</span>
                    <Pill tone={t.ativo ? 'status:active' : 'status:inactive'}>
                      {t.ativo ? 'Ativo' : 'Inativo'}
                    </Pill>
                  </div>
                  <div className="flex gap-3 text-xs mt-0.5 flex-wrap" style={{ color: 'var(--text-3)' }}>
                    {t.cnpj && <span className="font-mono-data">{formatCNPJ(t.cnpj)}</span>}
                    {t.nicho && <span>{t.nicho}</span>}
                    {t.plano && <span>Plano: {t.plano}</span>}
                    {t.endereco_cidade && t.endereco_uf && (
                      <span>{t.endereco_cidade}/{t.endereco_uf}</span>
                    )}
                    {(() => {
                      const counts = peopleByCliente.get(t.id)
                      const total = counts?.total ?? 0
                      return (
                        <span className="flex items-center gap-1">
                          <Users2 size={11} />
                          {total === 0
                            ? 'Sem pessoas'
                            : total === 1
                              ? '1 pessoa'
                              : `${total} pessoas`}
                        </span>
                      )
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => toggleAtivoMutation.mutate({ id: t.id, data: { ativo: !t.ativo } })}
                    className="p-2 rounded-lg text-gray-500 hover:text-white transition-colors"
                    style={{ background: 'transparent' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    title={t.ativo ? 'Desativar' : 'Ativar'}
                  >
                    {t.ativo
                      ? <ToggleRight size={18} className="text-green-400" />
                      : <ToggleLeft size={18} />}
                  </button>
                  <button
                    onClick={() => setDrawerState({ tenant: t })}
                    className="p-2 rounded-lg text-gray-500 hover:text-white transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    title="Editar dados cadastrais"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(t)}
                    className="p-2 rounded-lg text-gray-600 hover:text-red-400 transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })}
          {tenants.length === 0 && (
            <div
              className="rounded-xl p-8 text-center"
              style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border)' }}
            >
              <Building2 size={28} className="mx-auto mb-2" style={{ color: 'var(--text-3)' }} />
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>Nenhuma empresa cadastrada</p>
              <button
                onClick={() => setDrawerState({ tenant: null })}
                className="mt-3 text-xs font-medium"
                style={{ color: '#25c8bd' }}
              >
                Criar a primeira →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Drawer de criação/edição */}
      {drawerState && (
        <TenantDrawer
          tenant={drawerState.tenant}
          onClose={() => setDrawerState(null)}
        />
      )}

      {/* Delete Confirm Modal */}
      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => { if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id) }}
        variant="danger"
        title="Remover empresa?"
        description={
          <span>
            <span className="font-medium" style={{ color: 'var(--text-1)' }}>
              {deleteConfirm?.nome}
            </span>
          </span>
        }
        confirmLabel="Remover"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
