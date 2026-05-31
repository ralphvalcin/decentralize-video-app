import { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../store/useSessionStore'

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function RecordingIndicator() {
  const recordingState = useSessionStore((s) => s.recordingState)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (recordingState !== 'recording') {
      setElapsed(0)
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    setElapsed(0)
    intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [recordingState])

  if (recordingState !== 'recording') return null

  return (
    <div
      data-testid="recording-indicator"
      className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-600/90 text-white text-xs font-semibold"
    >
      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
      REC {formatElapsed(elapsed)}
    </div>
  )
}
