import { useEffect, useRef, useState } from 'react'

export type Quality = 'Excellent' | 'Good' | 'Fair' | 'Poor'

export interface QualitySnapshot {
  worst: Quality | null
  worstPacketLoss: number
  worstJitter: number
  connections: Map<string, RTCPeerConnection>
}

interface PeerRow {
  peerId: string
  quality: Quality
  packetLoss: number
  jitter: number
  rtt: number
}

interface Props {
  getPeerConnections: () => Map<string, RTCPeerConnection> | undefined
  onQualityChange: (snapshot: QualitySnapshot) => void
}

const QUALITY_RANK: Record<Quality, number> = { Excellent: 0, Good: 1, Fair: 2, Poor: 3 }

function classify(packetLoss: number): Quality {
  if (packetLoss < 1) return 'Excellent'
  if (packetLoss < 3) return 'Good'
  if (packetLoss <= 8) return 'Fair'
  return 'Poor'
}

function worse(a: Quality, b: Quality): Quality {
  return QUALITY_RANK[a] >= QUALITY_RANK[b] ? a : b
}

const BADGE_COLOR: Record<Quality, string> = {
  Excellent: 'bg-green-500',
  Good: 'bg-blue-400',
  Fair: 'bg-yellow-400',
  Poor: 'bg-red-500',
}

export function ConnectionQualityPredictions({ getPeerConnections, onQualityChange }: Props) {
  const [rows, setRows] = useState<PeerRow[]>([])
  const callbackRef = useRef(onQualityChange)
  callbackRef.current = onQualityChange

  useEffect(() => {
    async function poll() {
      const conns = getPeerConnections()
      if (!conns || conns.size === 0) {
        setRows([])
        callbackRef.current({ worst: null, worstPacketLoss: 0, worstJitter: 0, connections: new Map() })
        return
      }

      const next: PeerRow[] = []
      for (const [peerId, rtc] of conns) {
        try {
          const report = await rtc.getStats()
          let packetLoss = 0
          let jitter = 0
          let rtt = 0
          report.forEach((entry) => {
            const e = entry as RTCStats & {
              packetsLost?: number
              packetsReceived?: number
              jitter?: number
              currentRoundTripTime?: number
            }
            if (e.type === 'remote-inbound-rtp') {
              const lost = e.packetsLost ?? 0
              const received = e.packetsReceived ?? 0
              const total = lost + received
              packetLoss = total > 0 ? (lost / total) * 100 : 0
              jitter = (e.jitter ?? 0) * 1000
              rtt = (e.currentRoundTripTime ?? 0) * 1000
            }
          })
          next.push({ peerId, quality: classify(packetLoss), packetLoss, jitter, rtt })
        } catch {
          // peer may have disconnected between getPeerConnections and getStats
        }
      }

      setRows(next)

      if (next.length === 0) {
        callbackRef.current({ worst: null, worstPacketLoss: 0, worstJitter: 0, connections: conns })
        return
      }

      let worst: Quality = 'Excellent'
      let worstPacketLoss = 0
      let worstJitter = 0
      for (const row of next) {
        worst = worse(worst, row.quality)
        if (row.packetLoss > worstPacketLoss) worstPacketLoss = row.packetLoss
        if (row.jitter > worstJitter) worstJitter = row.jitter
      }
      callbackRef.current({ worst, worstPacketLoss, worstJitter, connections: conns })
    }

    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [getPeerConnections])

  if (rows.length === 0) return null

  return (
    <div data-testid="connection-quality" className="flex flex-col gap-1">
      <p className="text-[var(--text-secondary)] text-[10px] font-semibold uppercase tracking-wide">
        Connection Quality
      </p>
      {rows.map((row) => (
        <div key={row.peerId} className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-primary)] truncate max-w-[140px]">{row.peerId}</span>
          <span
            className={`text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${BADGE_COLOR[row.quality]}`}
          >
            {row.quality}
          </span>
        </div>
      ))}
    </div>
  )
}
