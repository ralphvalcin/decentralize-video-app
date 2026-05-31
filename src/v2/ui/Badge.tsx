import { ReactNode } from 'react'

interface BadgeProps {
  variant: 'live' | 'warn' | 'muted'
  children: ReactNode
}

const dots = {
  live:  'bg-[var(--accent-live)]',
  warn:  'bg-[var(--accent-warn)]',
  muted: 'bg-[var(--surface-hover)]',
}

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-[var(--text-muted)]">
      <span data-testid="badge-dot" className={`w-1.5 h-1.5 rounded-full ${dots[variant]}`} />
      {children}
    </span>
  )
}
