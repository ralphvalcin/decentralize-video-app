import { useEffect, useState } from 'react'
import { useSessionStore } from '../store/useSessionStore'

interface PollBannerProps {
  onVotePoll: (pollId: string, optionIndex: number) => void
}

export function PollBanner({ onVotePoll }: PollBannerProps) {
  const activePoll = useSessionStore((s) => s.activePoll)
  const [votedIndex, setVotedIndex] = useState<number | null>(null)

  useEffect(() => {
    setVotedIndex(null)
  }, [activePoll?.id])

  if (!activePoll) return null

  const counts = activePoll.options.map((_, i) =>
    Object.values(activePoll.votes ?? {}).filter((v) => v === i).length
  )
  const totalVotes = counts.reduce((a, b) => a + b, 0)

  return (
    <div
      data-testid="poll-banner"
      className="absolute top-4 left-1/2 -translate-x-1/2 bg-[var(--surface-overlay)] border border-[var(--border-default)] rounded-[12px] px-6 py-4 max-w-sm w-full shadow-lg z-10"
    >
      <p className="text-[var(--text-primary)] text-sm font-medium mb-3">{activePoll.question}</p>
      <div className="flex flex-col gap-2">
        {activePoll.options.map((option, i) => (
          <button
            key={option}
            data-testid={`poll-option-${option}`}
            disabled={votedIndex !== null}
            onClick={() => {
              onVotePoll(activePoll.id, i)
              setVotedIndex(i)
            }}
            className={`text-left text-xs text-[var(--text-secondary)] bg-[var(--surface-raised)] hover:bg-[var(--surface-hover)] border rounded-[8px] px-3 py-2 transition-colors flex items-center justify-between ${
              votedIndex === i ? 'border-[var(--accent-live)]' : 'border-[var(--border-subtle)]'
            }`}
          >
            <span>{option}</span>
            <span className="text-xs opacity-60">
              {counts[i]}{counts[i] > 0 && totalVotes > 0 ? ` (${Math.round((counts[i] / totalVotes) * 100)}%)` : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
