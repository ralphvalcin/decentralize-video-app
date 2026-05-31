import { useEffect, useState } from 'react'

const METRICS_URL = (
  process.env.VITE_SIGNALING_SERVER_URL || 'wss://decentralize-video-app-2.onrender.com'
).replace(/^wss:/, 'https:').replace(/^ws:/, 'http:') + '/metrics'

interface Metrics {
  connections: { total: number; peak: number; connectionRate: number; byRoom: Record<string, number> }
  messages: { totalSent: number; totalReceived: number; avgResponseTime: number; errorCount: number }
  rooms: { active: number; totalCreated: number; averageParticipants: number }
}

function StatTile({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="text-[var(--text-primary)] font-semibold">
        {value}{unit ? ` ${unit}` : ''}
      </span>
    </div>
  )
}

export function AIInsightsDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function fetchMetrics() {
      try {
        const res = await fetch(METRICS_URL, { signal: controller.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: Metrics = await res.json()
        setMetrics(data)
        setError(false)
        setLastUpdated(Date.now())
        setSecondsAgo(0)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setError(true)
      }
    }

    fetchMetrics()
    const id = setInterval(fetchMetrics, 30_000)
    return () => {
      controller.abort()
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    if (lastUpdated === null) return
    const id = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [lastUpdated])

  return (
    <div data-testid="ai-insights-dashboard" className="flex flex-col gap-3">
      <p className="text-[var(--text-secondary)] text-[10px] font-semibold uppercase tracking-wide">
        Server Insights
      </p>
      {error ? (
        <p data-testid="metrics-unavailable" className="text-[var(--text-muted)] text-xs">
          Metrics unavailable
        </p>
      ) : metrics ? (
        <>
          <div className="flex flex-col gap-2">
            <StatTile label="Connections/min" value={metrics.connections.connectionRate} unit="" />
            <StatTile label="Messages sent" value={metrics.messages.totalSent} unit="" />
            <StatTile label="Avg response" value={metrics.messages.avgResponseTime} unit="ms" />
          </div>
          {lastUpdated !== null && (
            <p className="text-[var(--text-muted)] text-[9px]">Updated {secondsAgo}s ago</p>
          )}
        </>
      ) : (
        <p className="text-[var(--text-muted)] text-xs">Loading…</p>
      )}
    </div>
  )
}
