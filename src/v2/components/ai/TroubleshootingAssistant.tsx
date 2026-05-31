import { useState } from 'react'
import { useCallStore } from '../../store/useCallStore'

interface Props {
  peerConnections: Map<string, RTCPeerConnection>
  packetLoss: number
  jitter: number
}

function diagnose(
  peerConnections: Map<string, RTCPeerConnection>,
  packetLoss: number,
  jitter: number,
  mediaError: string | null,
): string | null {
  for (const rtc of peerConnections.values()) {
    if (rtc.iceConnectionState === 'failed') {
      return 'Connection blocked — check your firewall or try a different network. If the problem persists, a TURN relay server may be required.'
    }
  }
  if (packetLoss > 8) {
    return 'High packet loss detected — close background applications and pause any large downloads. Switching to a wired connection may help.'
  }
  if (jitter > 100) {
    return 'Unstable network — a wired (Ethernet) connection will significantly improve call stability.'
  }
  if (mediaError) {
    return 'Camera or microphone access was denied — open your browser settings and allow this site to use your devices.'
  }
  return null
}

export function TroubleshootingAssistant({ peerConnections, packetLoss, jitter }: Props) {
  const mediaError = useCallStore((s) => s.mediaError)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const message = diagnose(peerConnections, packetLoss, jitter, mediaError)
  if (!message) return null

  return (
    <div
      data-testid="troubleshooting-assistant"
      className="flex flex-col gap-2 p-3 bg-[var(--surface-raised)] border border-[var(--border-default)] rounded-lg text-xs"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span aria-hidden>⚠️</span>
          <p className="text-[var(--text-primary)] leading-relaxed">{message}</p>
        </div>
        <button
          data-testid="dismiss-btn"
          onClick={() => setDismissed(true)}
          className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] shrink-0"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
