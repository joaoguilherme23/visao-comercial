import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Kanban, Building2, Briefcase, Users, Users2, Plug, LogOut, BarChart3, MessageSquare, Sun, Moon, Zap, HelpCircle, Flame, Activity, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { useTenantStore } from '../../store/tenantStore'
import { useThemeStore } from '../../store/themeStore'
import { useUIStore } from '../../store/uiStore'
import { Pill } from '../ds'
import type { Tone } from '../ds'
import { X9Wordmark } from '../ui/X9Wordmark'
import { CENTRAL_URL, OIDC_ENABLED } from '../../lib/centralUrl'

const ROLE_TONE: Record<string, Tone> = {
  admin:   'role:admin',
  manager: 'role:manager',
  viewer:  'role:viewer',
}
const ROLE_LABEL: Record<string, string> = {
  admin:   'Admin',
  manager: 'Gestor',
  viewer:  'Visualizador',
}

const navItems = [
  { to: '/agora', icon: Flame, label: 'Agora' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/kanban', icon: Kanban, label: 'Kanban' },
  { to: '/feed', icon: Activity, label: 'Feed' },
  { to: '/conversas', icon: MessageSquare, label: 'Conversas' },
]

const adminItems = [
  { to: '/admin/tenants', icon: Building2, label: 'Empresas' },
  { to: '/admin/users', icon: Users, label: 'Usuários' },
]

function SectionLabel({ children, collapsed }: { children: string; collapsed: boolean }) {
  if (collapsed) {
    return <div className="mx-3 my-2" style={{ borderTop: '1px solid var(--border)' }} />
  }
  return (
    <p
      className="uppercase tracking-widest px-3 pt-3 pb-1"
      style={{ fontSize: '9px', fontFamily: 'ui-monospace, monospace', color: 'var(--text-3)' }}
    >
      {children}
    </p>
  )
}

function NavItem({ to, icon: Icon, label, collapsed }: { to: string; icon: React.ElementType; label: string; collapsed: boolean }) {
  return (
    <NavLink to={to} end className="block rounded-lg text-sm transition-colors" title={collapsed ? label : undefined}>
      {({ isActive }) =>
        isActive ? (
          <div
            className={`flex items-center gap-3 py-2 rounded-lg font-medium ${collapsed ? 'justify-center' : 'pr-3'}`}
            style={{
              paddingLeft: collapsed ? 0 : 'calc(0.75rem - 3px)',
              paddingRight: collapsed ? 0 : undefined,
              borderLeft: collapsed ? 'none' : '3px solid var(--brand-500)',
              background: 'var(--brand-glow)',
              color: '#a5b4fc',
            }}
          >
            <Icon size={collapsed ? 18 : 16} style={{ color: '#25c8bd' }} />
            {!collapsed && label}
          </div>
        ) : (
          <div
            className={`flex items-center gap-3 py-2 rounded-lg transition-colors ${collapsed ? 'justify-center px-0' : 'px-3'}`}
            style={{ color: 'var(--text-2)' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--bg-elevated)'
              e.currentTarget.style.color = 'var(--text-1)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-2)'
            }}
          >
            <Icon size={collapsed ? 18 : 16} />
            {!collapsed && label}
          </div>
        )
      }
    </NavLink>
  )
}

export default function Sidebar() {
  const { user, logout, isLoggingOut } = useAuthStore()
  const navigate = useNavigate()
  const { selectedTenant, tenantRole } = useTenantStore()
  const { theme, toggleTheme } = useThemeStore()
  const { sidebarCollapsed } = useUIStore()

  const effectiveRole = user?.is_superadmin ? 'admin' : tenantRole
  const canConfigKpis = effectiveRole === 'admin' || effectiveRole === 'manager'
  const canManageConnections = effectiveRole === 'admin'
  // Grupos: superadmin OU admin do tenant — espelha o backend (routers/grupos.py).
  const canViewGrupos = user?.is_superadmin || tenantRole === 'admin'
  // Portfolio: superadmin OU is_manager_multi — espelha o backend (routers/portfolio.py).
  const canViewPortfolio = user?.is_superadmin || user?.is_manager_multi
  // Equipe: superadmin OU manager_multi com role admin no tenant — espelha
  // require_admin_in_tenant. Visível só dentro do contexto da empresa.
  const canManageEquipe =
    !!selectedTenant &&
    (user?.is_superadmin || (user?.is_manager_multi && tenantRole === 'admin'))
  const collapsed = sidebarCollapsed

  const handleLogout = async () => {
    const revoked = await logout()
    if (!revoked) {
      toast.error('Não foi possível encerrar a sessão. Tente novamente.')
      return
    }
    navigate('/login', { replace: true })
  }

  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-56'} flex flex-col transition-[width] duration-200 ease-out`}
      style={{
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Logo */}
      <div className={`${collapsed ? 'p-3' : 'p-4'}`} style={{ borderBottom: '1px solid var(--border)' }}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2'}`}>
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center flex-shrink-0">
            <Zap size={16} className="text-white" fill="white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm truncate" style={{ color: 'var(--text-1)' }}>
                <X9Wordmark fontSize="0.95rem" />
              </p>
              {selectedTenant && (
                <p className="text-xs truncate max-w-[120px]" style={{ color: 'var(--text-2)' }}>
                  {selectedTenant.nome}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 ${collapsed ? 'px-2' : 'px-3'} pb-3 space-y-0.5 overflow-y-auto overflow-x-hidden`}>
        {/* Portfolio multi-empresa — manager_multi/superadmin only.
            Fica no TOPO (antes de Principal) pra ser o ponto natural de entrada
            do gestor que administra várias empresas. */}
        {canViewPortfolio && (
          <>
            <SectionLabel collapsed={collapsed}>Visão geral</SectionLabel>
            <NavItem to="/portfolio" icon={Briefcase} label="Minhas empresas" collapsed={collapsed} />
            <div className="mx-3 my-2" style={{ borderTop: '1px solid var(--border)' }} />
          </>
        )}

        <SectionLabel collapsed={collapsed}>
          {selectedTenant ? selectedTenant.nome : 'Principal'}
        </SectionLabel>
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}
        {/* Grupos — admin/superadmin only. Guard inline (não entra em navItems
            pra não depender de rerender global quando tenantRole muda). */}
        {canViewGrupos && (
          <NavItem to="/grupos" icon={Users2} label="Grupos" collapsed={collapsed} />
        )}

        {user?.is_superadmin && (
          <>
            <div className="mx-3 my-2" style={{ borderTop: '1px solid var(--border)' }} />
            <SectionLabel collapsed={collapsed}>Admin</SectionLabel>
            {adminItems.map((item) => (
              <NavItem key={item.to} {...item} collapsed={collapsed} />
            ))}
          </>
        )}

        {selectedTenant && (canConfigKpis || canManageConnections || canManageEquipe) && (
          <>
            <div className="mx-3 my-2" style={{ borderTop: '1px solid var(--border)' }} />
            <SectionLabel collapsed={collapsed}>Configurações</SectionLabel>
            {canManageEquipe && (
              <NavItem to="/equipe" icon={Users2} label="Equipe" collapsed={collapsed} />
            )}
            {canConfigKpis && (
              <NavItem to="/settings/dashboard" icon={BarChart3} label="Config KPIs" collapsed={collapsed} />
            )}
            {canManageConnections && (
              <NavItem to="/settings/connections" icon={Plug} label="Conexões" collapsed={collapsed} />
            )}
          </>
        )}

        <div className="mx-3 my-2" style={{ borderTop: '1px solid var(--border)' }} />
        <SectionLabel collapsed={collapsed}>Suporte</SectionLabel>
        <NavItem to="/ajuda" icon={HelpCircle} label="Ajuda" collapsed={collapsed} />
        {OIDC_ENABLED && (
          <a
            href={CENTRAL_URL}
            className={`flex items-center rounded-lg text-sm w-full transition-colors ${collapsed ? 'justify-center py-2' : 'gap-3 px-3 py-2'}`}
            style={{ color: 'var(--text-2)' }}
            title={collapsed ? 'Voltar para a Central' : undefined}
          >
            <ExternalLink size={16} />
            {!collapsed && 'Voltar para a Central'}
          </a>
        )}
      </nav>

      {/* User footer */}
      <div className={`${collapsed ? 'p-2' : 'p-3'}`} style={{ borderTop: '1px solid var(--border)' }}>
        {/* Role badge */}
        {!collapsed && selectedTenant && effectiveRole && !user?.is_superadmin && (
          <div className="px-3 mb-2">
            <Pill tone={ROLE_TONE[effectiveRole] ?? 'neutral'}>
              {ROLE_LABEL[effectiveRole] ?? effectiveRole}
            </Pill>
          </div>
        )}

        {/* User info */}
        <div
          className={`flex items-center ${collapsed ? 'justify-center py-2 mb-1' : 'gap-3 px-3 py-2 mb-1'}`}
          title={collapsed ? `${user?.nome ?? ''} — ${user?.email ?? ''}` : undefined}
        >
          <div className="w-7 h-7 rounded-full bg-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0 text-white">
            {user?.nome?.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-1)' }}>{user?.nome}</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{user?.email}</p>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={`flex items-center rounded-lg text-sm w-full transition-colors mb-1 ${collapsed ? 'justify-center py-2' : 'gap-3 px-3 py-2'}`}
          style={{ color: 'var(--text-2)' }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--bg-elevated)'
            e.currentTarget.style.color = 'var(--text-1)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-2)'
          }}
          title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {!collapsed && (theme === 'dark' ? 'Tema claro' : 'Tema escuro')}
        </button>

        {/* Logout */}
        <button
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
          className={`flex items-center rounded-lg text-sm w-full transition-colors ${collapsed ? 'justify-center py-2' : 'gap-3 px-3 py-2'}`}
          style={{ color: 'var(--text-2)' }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.08)'
            e.currentTarget.style.color = '#f87171'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-2)'
          }}
          title={collapsed ? (isLoggingOut ? 'Saindo...' : 'Sair') : undefined}
        >
          <LogOut size={16} />
          {!collapsed && (isLoggingOut ? 'Saindo...' : 'Sair')}
        </button>
      </div>
    </aside>
  )
}
