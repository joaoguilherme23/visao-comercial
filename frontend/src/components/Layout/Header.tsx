import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, Building2, PanelLeftClose, PanelLeftOpen, ArrowLeft, ExternalLink } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { tenantsApi } from '../../api/tenants'
import { usersApi } from '../../api/users'
import { useTenantStore } from '../../store/tenantStore'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { Tenant, UserRole } from '../../types'
import NotificationBell from './NotificationBell'
import HealthIndicator from './HealthIndicator'
import { useNotifications } from '../../hooks/useNotifications'
import { Pill, Popover } from '../ds'
import type { Tone } from '../ds'
import { CENTRAL_URL, OIDC_ENABLED } from '../../lib/centralUrl'

const ROLE_TONE: Record<string, Tone> = {
  admin:   'role:admin',
  manager: 'role:manager',
  viewer:  'role:viewer',
}
const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin', manager: 'Gestor', viewer: 'Visualizador',
}

export default function Header() {
  const { selectedTenant, setSelectedTenant, setTenantRole } = useTenantStore()
  const { user } = useAuthStore()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  // "Voltar pro portfolio" só faz sentido pra manager_multi/superadmin
  // E só quando NÃO está já no /portfolio.
  const showBackToPortfolio =
    (user?.is_manager_multi || user?.is_superadmin) && location.pathname !== '/portfolio'

  // Ativa polling de notificações enquanto o Layout estiver montado
  useNotifications()

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: tenantsApi.list,
  })

  const { data: myRoles = [] } = useQuery({
    queryKey: ['my-tenant-roles'],
    queryFn: usersApi.myTenants,
    enabled: !!user && !user.is_superadmin,
  })

  const getRoleForTenant = (tenantId: string): UserRole | null => {
    if (user?.is_superadmin) return 'admin'
    return myRoles.find((r) => r.cliente_id === tenantId)?.role ?? null
  }

  useEffect(() => {
    if (!selectedTenant && tenants.length === 1) {
      const t = tenants[0]
      setSelectedTenant(t)
      setTenantRole(getRoleForTenant(t.id))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenants, myRoles, selectedTenant])

  const handleSelect = (t: Tenant) => {
    setSelectedTenant(t)
    setTenantRole(getRoleForTenant(t.id))
    setOpen(false)
  }

  return (
    <header
      className="h-14 flex items-center px-6 gap-4"
      style={{
        background: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-lg transition-colors flex-shrink-0"
        style={{ color: 'var(--text-3)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-elevated)'
          e.currentTarget.style.color = 'var(--text-1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--text-3)'
        }}
        title={sidebarCollapsed ? 'Expandir barra lateral' : 'Esconder barra lateral'}
        aria-label={sidebarCollapsed ? 'Expandir barra lateral' : 'Esconder barra lateral'}
      >
        {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>

      {showBackToPortfolio && (
        <Link
          to="/portfolio"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
          style={{
            background: 'var(--brand-glow)',
            color: 'var(--brand-500)',
          }}
          title="Voltar pra visão geral das suas empresas"
        >
          <ArrowLeft size={14} />
          <span className="hidden md:inline">Minhas empresas</span>
        </Link>
      )}

      {OIDC_ENABLED && (
        <a
          href={CENTRAL_URL}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
          title="Voltar para a Central"
        >
          <ExternalLink size={14} />
          <span className="hidden lg:inline">Central</span>
        </a>
      )}

      <Popover
        open={open}
        onOpenChange={setOpen}
        side="bottom"
        align="start"
        width={256}
        aria-label="Selecionar empresa"
        trigger={
          <button
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-1)',
            }}
          >
            <Building2 size={14} className="text-brand-400" />
            <span>{selectedTenant ? selectedTenant.nome : 'Selecionar empresa'}</span>
            <ChevronDown
              size={14}
              style={{
                color: 'var(--text-3)',
                transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s',
              }}
            />
          </button>
        }
      >
        <div className="overflow-hidden rounded-xl">
          {tenants.length === 0 && (
            <p className="text-sm p-4" style={{ color: 'var(--text-3)' }}>
              Nenhuma empresa disponível
            </p>
          )}
          {tenants.map((t) => {
            const role = getRoleForTenant(t.id)
            return (
              <button
                key={t.id}
                onClick={() => handleSelect(t)}
                className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 transition-colors"
                style={{ color: 'var(--text-1)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'rgba(11,150,146,0.15)', color: '#a5b4fc' }}
                >
                  {t.nome.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate" style={{ color: 'var(--text-1)' }}>{t.nome}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{t.slug}</p>
                </div>
                {role && (
                  <Pill tone={ROLE_TONE[role] ?? 'neutral'} size="xs" className="flex-shrink-0">
                    {ROLE_LABEL[role] ?? role}
                  </Pill>
                )}
                {selectedTenant?.id === t.id && (
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      </Popover>

      {selectedTenant && (
        <div className="flex items-center gap-2">
          <Pill tone={selectedTenant.ativo ? 'status:active' : 'status:inactive'}>
            {selectedTenant.ativo ? 'Ativo' : 'Inativo'}
          </Pill>
          {selectedTenant.nicho && (
            <Pill tone="role:admin">{selectedTenant.nicho}</Pill>
          )}
        </div>
      )}

      {/* Espaçador empurra sino para a direita */}
      <div className="flex-1" />

      {/* Saúde da conexão do bot + sino de notificações */}
      {selectedTenant && (
        <div className="flex items-center gap-2">
          <HealthIndicator />
          <NotificationBell />
        </div>
      )}
    </header>
  )
}
