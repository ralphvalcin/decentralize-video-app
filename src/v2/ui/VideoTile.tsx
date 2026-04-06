import { useEffect, useRef } from 'react'
import { Avatar } from './Avatar'
import type { Reaction } from '../types'

interface VideoTileProps {
  peerId: string
  name: string
  stream: MediaStream | null
  isMuted: boolean
  isCamOff: boolean
  networkQuality: 'good' | 'fair' | 'poor'
  isAway: boolean
  reaction: Reaction | null
  hasRaisedHand: boolean
  className?: string
}

const qualityColors = {
  good: 'var(--accent-live)',
  fair: 'var(--accent-warn)',
  poor: 'var(--accent-danger)',
}

export function VideoTile({
  peerId, name, stream, isMuted, isCamOff, networkQuality,
  isAway, reaction, hasRaisedHand, className = '',
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div data-peer-id={peerId} className={`relative bg-[var(--surface-raised)] rounded-[8px] overflow-hidden ${className}`}>
      {!isCamOff && stream ? (
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Avatar name={name} size="lg" />
        </div>
      )}

      {isAway && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <span className="text-[var(--text-muted)] text-xs uppercase tracking-widest">Away</span>
        </div>
      )}

      {reaction && (
        <div className="absolute top-2 right-2 text-xl">{reaction.emoji}</div>
      )}

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
        <span className="text-[var(--text-primary)] text-xs font-medium truncate">{name}</span>
        <div className="flex items-center gap-1.5">
          {isMuted && (
            <span data-testid="muted-indicator" className="w-1.5 h-1.5 rounded-full bg-[var(--accent-danger)]" />
          )}
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: qualityColors[networkQuality] }} />
        </div>
      </div>

      {hasRaisedHand && (
        <div data-testid="raised-hand" className="absolute top-2 left-2 text-base">✋</div>
      )}
    </div>
  )
}
