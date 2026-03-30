import { Link, useLocation } from 'react-router-dom'
import { NAV_ITEMS } from './Sidebar'

export default function BottomTabBar() {
  const location = useLocation()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex lg:hidden"
      style={{
        height: '72px',
        background: 'var(--color-surface-panel)',
        borderTop: '1px solid var(--color-border-default)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
        const active = location.pathname === path
        return (
          <Link
            key={path}
            to={path}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors duration-150 relative"
            style={{
              color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
            }}
          >
            {active && (
              <span
                className="absolute top-0 left-3 right-3"
                style={{
                  height: '2px',
                  background: 'var(--color-accent)',
                }}
              />
            )}
            <Icon size={20} />
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
