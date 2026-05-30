import { useRef, useState, useEffect } from 'react'
import { usePeerStore } from '../store/usePeerStore'
import { useWhiteboardStore } from '../store/useWhiteboardStore'
import { useCallStore } from '../store/useCallStore'

interface WhiteboardParticipantDropdownProps {
  onGrant: (peerId: string) => void
  onRevoke: (peerId: string) => void
}

export function WhiteboardParticipantDropdown({ onGrant, onRevoke }: WhiteboardParticipantDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const peers = usePeerStore((s) => s.peers)
  const grantedPeerIds = useWhiteboardStore((s) => s.grantedPeerIds)
  const socketId = useCallStore((s) => s.socketId)

  const otherPeers = Array.from(peers.values()).filter((p) => p.id !== socketId)

  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  function handleGrant(peerId: string) {
    onGrant(peerId)
    setIsOpen(false)
  }

  function handleRevoke(peerId: string) {
    onRevoke(peerId)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        data-testid="btn-participants-toggle"
        aria-label="Manage drawing permissions"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
      >
        👥 Participants {isOpen ? '▴' : '▾'}
      </button>

      {isOpen && (
        <div
          data-testid="participant-list"
          className="absolute right-0 top-full mt-1 w-52 bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-lg shadow-lg overflow-hidden z-10"
        >
          <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              Drawing permissions
            </span>
          </div>

          {otherPeers.length === 0 ? (
            <div className="px-3 py-3 text-sm text-[var(--text-secondary)]">
              No other participants
            </div>
          ) : (
            otherPeers.map((peer) => {
              const hasDrawing = grantedPeerIds.has(peer.id)
              return (
                <div
                  key={peer.id}
                  className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)] last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-xs font-medium shrink-0">
                      {peer.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-[var(--text-primary)] truncate">{peer.name}</span>
                    {hasDrawing && <span className="text-xs shrink-0">✏️</span>}
                  </div>
                  {hasDrawing ? (
                    <button
                      data-testid={`btn-revoke-${peer.id}`}
                      onClick={() => handleRevoke(peer.id)}
                      className="ml-2 px-2 py-1 rounded text-xs font-medium text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
                    >
                      Revoke
                    </button>
                  ) : (
                    <button
                      data-testid={`btn-grant-${peer.id}`}
                      onClick={() => handleGrant(peer.id)}
                      className="ml-2 px-2 py-1 rounded text-xs font-medium text-green-400 hover:bg-green-400/10 transition-colors shrink-0"
                    >
                      Grant
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
