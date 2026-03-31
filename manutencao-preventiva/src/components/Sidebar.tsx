import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  HardDrive,
  ClipboardList,
  CalendarClock,
  Wrench,
  History,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import BrandIcon from './BrandIcon'

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/equipamentos', label: 'Equipamentos', icon: HardDrive },
  { path: '/protocolos', label: 'Protocolos', icon: ClipboardList },
  { path: '/agenda', label: 'Agenda', icon: CalendarClock },
  { path: '/executar', label: 'Executar', icon: Wrench },
  { path: '/historico', label: 'Histórico', icon: History },
]

export default function Sidebar() {
  const location = useLocation()
  const { signOut } = useAuth()

  return (
    <aside
      className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-20"
      style={{
        width: '260px',
        background: 'var(--color-surface-panel)',
        borderRight: '1px solid var(--color-border-default)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-5 shrink-0"
        style={{ height: '64px', borderBottom: '1px solid var(--color-border-default)' }}
      >
        <BrandIcon size={26} />
        <span className="text-base font-bold tracking-tight" style={{ color: 'var(--color-text-heading)' }}>
          IPE Lab
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1 px-3 py-4 overflow-y-auto">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path
          return (
            <Link
              key={path}
              to={path}
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-150 relative"
              style={{
                color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                background: active ? 'var(--color-accent-muted)' : 'transparent',
                borderRadius: '2px',
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = 'transparent'
              }}
            >
              {active && (
                <span
                  className="absolute left-0 top-1 bottom-1"
                  style={{
                    width: '3px',
                    background: 'var(--color-accent)',
                    borderRadius: '0 2px 2px 0',
                  }}
                />
              )}
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-3" style={{ borderTop: '1px solid var(--color-border-default)' }}>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium w-full transition-colors duration-150"
          style={{ color: 'var(--color-status-danger)', borderRadius: '2px', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-status-danger-bg)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </aside>
  )
}

export { NAV_ITEMS }
