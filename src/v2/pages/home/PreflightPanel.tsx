import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../../ui/Avatar'

interface RecentRoom {
  id: string
  name: string
  lastVisited: number
  durationMs?: number
  isActive?: boolean
  participantCount?: number
}

function getRecentRooms(): RecentRoom[] {
  try {
    return JSON.parse(localStorage.getItem('velo_recent_rooms') || '[]')
  } catch {
    return []
  }
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return 'yesterday'
  return `${Math.floor(diff / 86400000)}d ago`
}

export function PreflightPanel() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [micReady, setMicReady] = useState(false)
  const [camReady, setCamReady] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isCamOff, setIsCamOff] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const recentRooms = useMemo(() => getRecentRooms(), [])
  const navigate = useNavigate()

  useEffect(() => {
    let acquired: MediaStream | null = null
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((s) => {
        acquired = s
        setStream(s)
        setMicReady(true)
        setCamReady(true)
        if (videoRef.current) videoRef.current.srcObject = s
      })
      .catch(() => {
        // Permission denied — stay in fallback state
      })
    return () => {
      acquired?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function toggleMic() {
    stream?.getAudioTracks().forEach((t) => { t.enabled = isMuted })
    setIsMuted((v) => !v)
  }

  function toggleCam() {
    stream?.getVideoTracks().forEach((t) => { t.enabled = isCamOff })
    setIsCamOff((v) => !v)
  }

  return (
    <div data-testid="preflight-panel" className="flex flex-col h-full px-12 py-12 gap-6">

      <div data-testid="camera-preview" className="relative flex-1 bg-[var(--surface-raised)] rounded-[12px] border border-[var(--border-subtle)] overflow-hidden flex items-center justify-center min-h-0">
        {!isCamOff && camReady ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : (
          <Avatar name="You" size="lg" />
        )}

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          <button
            onClick={toggleMic}
            className="w-8 h-8 rounded-full bg-[var(--surface-overlay)] border border-[var(--border-default)] flex items-center justify-center text-sm hover:bg-[var(--surface-hover)] transition-colors"
          >
            {isMuted ? '🔇' : '🎙'}
          </button>
          <button
            onClick={toggleCam}
            className="w-8 h-8 rounded-full bg-[var(--surface-overlay)] border border-[var(--border-default)] flex items-center justify-center text-sm hover:bg-[var(--surface-hover)] transition-colors"
          >
            {isCamOff ? '📷' : '🎥'}
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <div data-testid="mic-status" className="flex-1 bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2 flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${micReady ? 'bg-[var(--accent-live)]' : 'bg-[var(--accent-warn)]'}`} />
          <span className="text-[var(--text-muted)] text-xs">{micReady ? 'Mic ready' : 'No mic'}</span>
        </div>
        <div data-testid="cam-status" className="flex-1 bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2 flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${camReady ? 'bg-[var(--accent-live)]' : 'bg-[var(--accent-warn)]'}`} />
          <span className="text-[var(--text-muted)] text-xs">{camReady ? 'Cam ready' : 'No cam'}</span>
        </div>
      </div>

      <div data-testid="recent-rooms" className="flex flex-col gap-2">
        <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest">
          Recent rooms
        </span>
        {recentRooms.length === 0 && (
          <p className="text-[var(--text-muted)] text-xs">No recent rooms.</p>
        )}
        {recentRooms.slice(0, 4).map((room) => (
          <button
            key={room.id}
            onClick={() => navigate(`/room/${room.id}`)}
            className="bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-[8px] px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--surface-hover)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${room.isActive ? 'bg-[var(--accent-live)] shadow-[0_0_6px_var(--accent-live)]' : 'bg-[var(--surface-hover)] border border-[var(--border-default)]'}`} />
              <div>
                <div className={`text-xs font-medium ${room.isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                  {room.name || room.id}
                </div>
                {room.isActive && room.participantCount && (
                  <div className="text-[10px] text-[var(--accent-live)]">{room.participantCount} active</div>
                )}
                {!room.isActive && (
                  <div className="text-[10px] text-[var(--text-muted)]">{formatRelative(room.lastVisited)}</div>
                )}
              </div>
            </div>
            <span className={`text-xs ${room.isActive ? 'text-[var(--accent-live)]' : 'text-[var(--text-muted)]'}`}>
              Rejoin →
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[var(--border-subtle)]" />
        <span className="text-[var(--text-muted)] text-[10px]">stored locally · never uploaded</span>
        <div className="flex-1 h-px bg-[var(--border-subtle)]" />
      </div>

    </div>
  )
}
