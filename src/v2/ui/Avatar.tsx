interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-12 h-12 text-base',
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ name, size = 'md', className = '' }: AvatarProps) {
  return (
    <div className={`${sizes[size]} rounded-full bg-[var(--surface-overlay)] border border-[var(--border-subtle)] flex items-center justify-center font-semibold text-[var(--text-secondary)] ${className}`}>
      <span>{initials(name)}</span>
    </div>
  )
}
