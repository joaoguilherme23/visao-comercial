import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Building2, Users, Brain } from 'lucide-react'
import TenantManager from '../components/Admin/TenantManager'
import UserManager from '../components/Admin/UserManager'
import LlmLogsPage from './LlmLogsPage'
import { useQuery } from '@tanstack/react-query'
import { tenantsApi } from '../api/tenants'
import { usersApi } from '../api/users'
import clsx from 'clsx'
import { Pill } from '../components/ds'

type Tab = 'tenants' | 'users' | 'llm-logs'

export default function AdminPage() {
  const location = useLocation()
  const [tab, setTab] = useState<Tab>(() => detectTab(location.pathname))

  useEffect(() => {
    setTab(detectTab(location.pathname))
  }, [location.pathname])

  const { data: tenants = [] } = useQuery({ queryKey: ['tenants'], queryFn: tenantsApi.list })
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })

  const counts: Record<Tab, number> = {
    tenants: tenants.length,
    users: users.length,
    'llm-logs': 0,  // não mostra contador
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Administração</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie empresas, usuários, acessos e consumo de IA</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {([
          { key: 'tenants',  label: 'Empresas', icon: Building2 },
          { key: 'users',    label: 'Usuários', icon: Users },
          { key: 'llm-logs', label: 'Logs LLM', icon: Brain },
        ] as { key: Tab; label: string; icon: typeof Building2 }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === key
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            )}
          >
            <Icon size={15} />
            {label}
            {counts[key] > 0 && (
              <Pill
                tone={tab === key ? 'role:admin' : 'neutral'}
                variant={tab === key ? 'soft' : 'solid'}
                size="xs"
                className="font-bold"
              >
                {counts[key]}
              </Pill>
            )}
          </button>
        ))}
      </div>

      {tab === 'tenants'  && <TenantManager />}
      {tab === 'users'    && <UserManager />}
      {tab === 'llm-logs' && <LlmLogsPage />}
    </div>
  )
}

function detectTab(pathname: string): 'tenants' | 'users' | 'llm-logs' {
  if (pathname.includes('/llm-logs')) return 'llm-logs'
  if (pathname.includes('/users')) return 'users'
  return 'tenants'
}
