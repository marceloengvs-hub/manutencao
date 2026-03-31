import { useAuth } from '../contexts/AuthContext'
import { LogOut } from 'lucide-react'

export default function Header({ title }: { title?: string }) {
  const { user, signOut } = useAuth()
  const initials = (user?.user_metadata?.full_name || user?.email || 'U').charAt(0).toUpperCase()

  return (
    <header
      className="flex items-center justify-between px-4 lg:px-8 shrink-0"
      style={{
        height: '64px',
        background: 'var(--color-surface-panel)',
        borderBottom: '1px solid var(--color-border-default)',
      }}
    >
      <div className="flex items-center gap-3">
        {title && (
          <h1 className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs hidden sm:block" style={{ color: 'var(--color-text-muted)' }}>
          {user?.user_metadata?.full_name || user?.email}
        </span>
        <div
          className="w-8 h-8 flex items-center justify-center text-xs font-bold"
          style={{
            background: 'var(--color-accent-muted)',
            color: 'var(--color-accent)',
            borderRadius: '2px',
          }}
        >
          {initials}
        </div>
        
        {/* Mobile/Tablet Logout Button */}
        <button
          onClick={() => signOut()}
          className="p-1.5 lg:hidden flex items-center justify-center ml-1"
          style={{ color: 'var(--color-status-danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          title="Sair"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
