export default function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0

  return (
    <div className="flex items-center gap-3">
      <div className="progress-track flex-1">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono font-medium tabular-nums" style={{ color: 'var(--color-text-secondary)', minWidth: '36px', textAlign: 'right' }}>
        {pct}%
      </span>
    </div>
  )
}
