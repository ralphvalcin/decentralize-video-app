import { useRef, useState } from 'react'
import type { PeerManagerHandle } from './PeerManager'
import { ConnectionQualityPredictions, type QualitySnapshot } from '../components/ai/ConnectionQualityPredictions'
import { TroubleshootingAssistant } from '../components/ai/TroubleshootingAssistant'
import { AIInsightsDashboard } from '../components/ai/AIInsightsDashboard'

interface Props {
  peerManagerRef: React.RefObject<PeerManagerHandle>
}

function hasFailedPeer(connections: Map<string, RTCPeerConnection>): boolean {
  for (const rtc of connections.values()) {
    if (rtc.iceConnectionState === 'failed') return true
  }
  return false
}

export function AISidePanel({ peerManagerRef }: Props) {
  const [snapshot, setSnapshot] = useState<QualitySnapshot | null>(null)
  const getPeerConnsRef = useRef(() => peerManagerRef.current?.getPeerConnections())

  const showTroubleshooting =
    snapshot !== null &&
    (snapshot.worst === 'Poor' || hasFailedPeer(snapshot.connections))

  return (
    <div
      data-testid="ai-side-panel"
      className="w-[280px] shrink-0 border-l border-[var(--border-subtle)] flex flex-col gap-4 p-4 bg-[var(--surface-base)] overflow-y-auto"
    >
      <ConnectionQualityPredictions
        getPeerConnections={getPeerConnsRef.current}
        onQualityChange={setSnapshot}
      />
      {showTroubleshooting && snapshot && (
        <TroubleshootingAssistant
          peerConnections={snapshot.connections}
          packetLoss={snapshot.worstPacketLoss}
          jitter={snapshot.worstJitter}
        />
      )}
      <AIInsightsDashboard />
    </div>
  )
}
