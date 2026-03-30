import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomTabBar from './BottomTabBar'
import Header from './Header'

export default function Layout() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface-main)' }}>
      <Sidebar />
      <div className="app-main">
        <Header title="Sistema de Manutenção Preventiva" />
        <main className="app-content">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomTabBar />
    </div>
  )
}
