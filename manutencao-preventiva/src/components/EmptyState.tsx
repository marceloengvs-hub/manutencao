import type { ReactNode } from 'react'
import { PackageOpen } from 'lucide-react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div style={{ color: 'var(--color-text-muted)' }}>
        {icon || <PackageOpen size={48} strokeWidth={1} />}
      </div>
      <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
        {title}
      </h3>
      {description && (
        <p className="text-sm max-w-md" style={{ color: 'var(--color-text-muted)' }}>
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
