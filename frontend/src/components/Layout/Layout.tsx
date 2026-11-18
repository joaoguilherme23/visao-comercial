import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useUIStore } from '../../store/uiStore'

export default function Layout() {
  // Modo Atendimento: esconde Sidebar/Header e remove padding do main.
  // NÃO desmontamos — apenas display:none — pra preservar estado e scroll.
  const focusMode = useUIStore((s) => s.focusMode)

  return (
    <div
      className="flex h-screen"
      style={{ background: 'var(--bg-base)', color: 'var(--text-1)' }}
    >
      <div
        className="flex h-full"
        style={{ display: focusMode ? 'none' : 'flex' }}
      >
        <Sidebar />
      </div>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div style={{ display: focusMode ? 'none' : undefined }}>
          <Header />
        </div>
        <main className={`flex-1 overflow-auto ${focusMode ? 'p-0' : 'p-6'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
