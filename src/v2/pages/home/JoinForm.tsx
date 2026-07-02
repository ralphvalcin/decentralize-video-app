import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../ui/Button'
import { useCallStore } from '../../store/useCallStore'

function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 8)
}

export function JoinForm() {
  const [name, setName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [copied, setCopied] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const setUserName = useCallStore((s) => s.setUserName)

  // Pre-fill room ID from invite link redirect parameter
  useEffect(() => {
    const redirect = searchParams.get('redirect')
    if (redirect) {
      const match = redirect.match(/\/room\/(.+)/)
      if (match) {
        setRoomId(match[1])
      }
    }
  }, [searchParams])

  async function handleCreate() {
    const id = roomId.trim() || generateRoomId()
    setUserName(name.trim())
    navigate(`/room/${id}`)
  }

  async function handleJoin() {
    const id = roomId.trim()
    setUserName(name.trim())
    navigate(`/room/${id}`)
  }

  async function handleCopyRoomId() {
    const id = roomId.trim() || generateRoomId()
    if (!roomId.trim()) setRoomId(id)
    await navigator.clipboard.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div data-testid="join-form" className="flex flex-col justify-center h-full px-12 gap-8 max-w-md">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[var(--accent-live)] shadow-[0_0_8px_var(--accent-live)]" />
        <span className="text-[var(--text-primary)] text-xl font-bold tracking-tight">Velo</span>
      </div>

      <div>
        <h1 className="text-[var(--text-primary)] text-2xl font-bold leading-tight tracking-tight">
          Private video.<br />No sign-up.
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-2">
          End-to-end encrypted · Peer-to-peer · Yours.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest">
            Your name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="bg-[var(--surface-raised)] border border-[var(--border-default)] rounded-[8px] px-3.5 py-3 text-[var(--text-primary)] text-sm outline-none focus:border-[var(--border-strong)] transition-colors placeholder:text-[var(--text-muted)]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest">
            Room ID
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Room ID (leave empty to auto-generate)"
              className="flex-1 bg-[var(--surface-raised)] border border-[var(--border-default)] rounded-[8px] px-3.5 py-3 text-[var(--text-primary)] text-sm outline-none focus:border-[var(--border-strong)] transition-colors placeholder:text-[var(--text-muted)]"
            />
            <Button
              variant="ghost"
              onClick={handleCopyRoomId}
              className="shrink-0 rounded-[8px] px-3"
              title={copied ? 'Copied!' : 'Copy room ID'}
            >
              {copied ? '✓' : '📋'}
            </Button>
          </div>
          {roomId.trim() && (
            <p className="text-[var(--text-muted)] text-xs">
              Share this Room ID with others so they can join your call.
            </p>
          )}
        </div>

        <div className="flex gap-2 mt-1">
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={handleCreate}
            className="flex-1 rounded-[8px]"
          >
            Create Room
          </Button>
          <Button
            variant="ghost"
            disabled={!name.trim() || !roomId.trim()}
            onClick={handleJoin}
            className="flex-1 rounded-[8px]"
          >
            Join →
          </Button>
        </div>
      </div>
    </div>
  )
}
