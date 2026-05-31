import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
}

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-[var(--text-primary)] text-[var(--surface-base)]',
    ghost:   'bg-[var(--surface-raised)] text-[var(--text-secondary)] border border-[var(--border-default)]',
    danger:  'bg-[var(--accent-danger)] text-white border border-[var(--accent-danger)]',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}
