import { useSessionStore } from '../store/useSessionStore'

export function PollBanner() {
  const activePoll = useSessionStore((s) => s.activePoll)
  if (!activePoll) return null

  return (
    <div
      data-testid="poll-banner"
      className="absolute top-4 left-1/2 -translate-x-1/2 bg-[var(--surface-overlay)] border border-[var(--border-default)] rounded-[12px] px-6 py-4 max-w-sm w-full shadow-lg z-10"
    >
      <p className="text-[var(--text-primary)] text-sm font-medium mb-3">{activePoll.question}</p>
      <div className="flex flex-col gap-2">
        {activePoll.options.map((option) => (
          <button
            key={option}
            data-testid={`poll-option-${option}`}
            disabled
            className="text-left text-xs text-[var(--text-secondary)] bg-[var(--surface-raised)] hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2 transition-colors"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
