import { usePeerStore } from '../store/usePeerStore'

export function ParticipantsPanel() {
  const peers = usePeerStore((s) => s.peers)
  const list = Array.from(peers.values())

  return (
    <div data-testid="participants-panel" className="w-[240px] shrink-0 border-l border-[var(--border-subtle)] flex flex-col bg-[var(--surface-base)]">
      <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
        <h2 className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wide m-0">
          Participants ({list.length + 1})
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        <div data-testid="participant-local" className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span data-testid="peer-status-local" className="w-1.5 h-1.5 rounded-full bg-[var(--accent-live)]" />
            <span className="text-[var(--text-primary)] text-xs">You</span>
          </div>
        </div>

        {list.map((peer) => (
          <div key={peer.id} data-testid={`participant-${peer.id}`} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                data-testid={`peer-status-${peer.id}`}
                className={`w-1.5 h-1.5 rounded-full ${
                  peer.connectionState === 'connected'
                    ? 'bg-[var(--accent-live)]'
                    : peer.connectionState === 'failed'
                    ? 'bg-[var(--accent-danger)]'
                    : 'bg-[var(--text-muted)]'
                }`}
              />
              <span className="text-[var(--text-primary)] text-xs">{peer.name}</span>
            </div>
            <div className="flex items-center gap-1">
              {peer.isMuted && (
                <span data-testid={`peer-muted-${peer.id}`} className="text-[var(--text-muted)] text-[10px]">🔇</span>
              )}
              {peer.isCamOff && (
                <span data-testid={`peer-cam-off-${peer.id}`} className="text-[var(--text-muted)] text-[10px]">📷</span>
              )}
            </div>
          </div>
        ))}

        {list.length === 0 && (
          <p className="text-[var(--text-muted)] text-xs">No other participants yet.</p>
        )}
      </div>
    </div>
  )
}
