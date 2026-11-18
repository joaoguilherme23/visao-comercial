import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useTenantStore } from './store/tenantStore'
import { useThemeStore } from './store/themeStore'
import Layout from './components/Layout/Layout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import DashboardConfigPage from './pages/DashboardConfigPage'
import KanbanPage from './pages/KanbanPage'
import AdminPage from './pages/AdminPage'
import ConnectionsPage from './pages/ConnectionsPage'
import ConversasPage from './pages/ConversasPage'
import GruposPage from './pages/GruposPage'
import PortfolioPage from './pages/PortfolioPage'
import EquipePage from './pages/EquipePage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AgoraPage from './pages/AgoraPage'
import AjudaPage from './pages/AjudaPage'
import FeedPage from './pages/FeedPage'
import FeedStandalonePage from './pages/FeedStandalonePage'
import StandaloneLoginPage from './pages/StandaloneLoginPage'
import DesignSystemPage from './pages/dev/DesignSystemPage'
import BrandPage from './pages/dev/BrandPage'

const OIDC_ENABLED = import.meta.env.VITE_OIDC_ENABLED === 'true'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initializing } = useAuthStore()
  if (initializing) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

/**
 * Bloqueia acesso a qualquer rota protegida enquanto must_change_password=true.
 * Força o consultor recém-criado a trocar a senha provisória antes de continuar.
 * /change-password é a única rota que escapa.
 */
function RequireMustChange({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const location = useLocation()
  if (!OIDC_ENABLED && user?.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return <>{children}</>
}

/**
 * Guard da Equipe — exige superadmin OU manager_multi com role admin no
 * tenant atual. Espelha o backend (require_admin_in_tenant).
 */
function RequireEquipeAccess({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const { tenantRole, selectedTenant } = useTenantStore()
  if (!selectedTenant) return <Navigate to="/portfolio" replace />
  const allowed =
    user?.is_superadmin ||
    (user?.is_manager_multi && tenantRole === 'admin')
  if (!allowed) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (!user?.is_superadmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

/**
 * Guard da aba Grupos — espelha a regra do backend (routers/grupos.py):
 * libera somente se usuário é superadmin OU tem role "admin" no tenant
 * selecionado. Demais papéis são redirecionados pro dashboard.
 */
function RequireGruposAccess({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const { tenantRole } = useTenantStore()
  const allowed = user?.is_superadmin || tenantRole === 'admin'
  if (!allowed) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

/**
 * Guard da aba Portfolio — espelha o backend (routers/portfolio.py):
 * libera só pra superadmin OU is_manager_multi=true.
 */
function RequireManagerMulti({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const allowed = user?.is_superadmin || user?.is_manager_multi
  if (!allowed) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  const { theme } = useThemeStore()
  const { initializeAuth } = useAuthStore()

  // Aplica data-theme no <html> para ativar as CSS vars corretas
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Valida sessão persistida no boot antes de renderizar rotas protegidas
  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  return (
    <Routes>
      <Route path="/" element={OIDC_ENABLED ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      {/* Modo standalone — login dedicado + feed fullscreen sem sidebar */}
      <Route path="/standalone/login" element={<StandaloneLoginPage />} />
      <Route
        path="/standalone/feed"
        element={
          <RequireAuth>
            <FeedStandalonePage />
          </RequireAuth>
        }
      />
      {/* /change-password fica fora do Layout pra não mostrar sidebar/header */}
      <Route
        path="/change-password"
        element={
          <RequireAuth>
            <ChangePasswordPage />
          </RequireAuth>
        }
      />
      <Route
        element={
          <RequireAuth>
            <RequireMustChange>
              <Layout />
            </RequireMustChange>
          </RequireAuth>
        }
      >
        <Route path="agora" element={<AgoraPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="kanban" element={<KanbanPage />} />
        <Route path="feed" element={<FeedPage />} />
        <Route path="conversas" element={<ConversasPage />} />
        <Route
          path="grupos"
          element={
            <RequireGruposAccess>
              <GruposPage />
            </RequireGruposAccess>
          }
        />
        <Route
          path="portfolio"
          element={
            <RequireManagerMulti>
              <PortfolioPage />
            </RequireManagerMulti>
          }
        />
        <Route
          path="equipe"
          element={
            <RequireEquipeAccess>
              <EquipePage />
            </RequireEquipeAccess>
          }
        />
        <Route path="ajuda" element={<AjudaPage />} />
        <Route path="settings/dashboard" element={<DashboardConfigPage />} />
        <Route path="settings/connections" element={<ConnectionsPage />} />
        <Route path="settings" element={<Navigate to="/settings/dashboard" replace />} />
        <Route
          path="admin/*"
          element={
            <RequireSuperAdmin>
              <AdminPage />
            </RequireSuperAdmin>
          }
        />
        <Route
          path="dev/ds"
          element={
            <RequireSuperAdmin>
              <DesignSystemPage />
            </RequireSuperAdmin>
          }
        />
        <Route
          path="dev/brand"
          element={
            <RequireSuperAdmin>
              <BrandPage />
            </RequireSuperAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
