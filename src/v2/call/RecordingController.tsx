import { useEffect, useRef } from 'react'
import { useCallStore } from '../store/useCallStore'
import { usePeerStore } from '../store/usePeerStore'
import { useSessionStore } from '../store/useSessionStore'
import { useUIStore } from '../store/useUIStore'
import { RecordingManager } from '../recording/RecordingManager'

interface RecordingControllerProps {
  roomId: string
}

/**
 * Renderless component that wires Zustand store state to the RecordingManager lifecycle.
 *
 * Responsibilities:
 * - Instantiates RecordingManager and calls start() when the host sets recordingState to 'recording'.
 * - Calls stop() and destroys the manager when recordingState returns to 'idle'.
 * - Calls removeStream() for any peer that leaves mid-recording.
 * - Guards against browsers that lack MediaRecorder support.
 * - Registers a beforeunload handler to warn the host when leaving mid-recording.
 */
export function RecordingController({ roomId }: RecordingControllerProps) {
  const isHost = useCallStore((s) => s.isHost)
  const localStream = useCallStore((s) => s.localStream)
  const recordingState = useSessionStore((s) => s.recordingState)
  const setRecordingState = useSessionStore((s) => s.setRecordingState)
  const peers = usePeerStore((s) => s.peers)
  const addToast = useUIStore((s) => s.addToast)

  const managerRef = useRef<RecordingManager | null>(null)
  const attachedPeerIdsRef = useRef<Set<string>>(new Set())

  // Start / stop the RecordingManager in response to recordingState changes.
  useEffect(() => {
    if (!isHost || recordingState !== 'recording' || !localStream) return

    if (typeof MediaRecorder === 'undefined') {
      addToast({
        id: `rec-unsupported-${Date.now()}`,
        message: "Recording isn't supported in this browser",
        variant: 'warn',
      })
      setRecordingState('idle')
      return
    }

    const remoteStreams = [...peers.values()]
      .filter((p) => p.stream !== null)
      .map((p) => ({ id: p.id, stream: p.stream! }))

    attachedPeerIdsRef.current = new Set(remoteStreams.map((r) => r.id))

    const manager = new RecordingManager(roomId)
    managerRef.current = manager

    try {
      manager.start(localStream, remoteStreams)
    } catch {
      addToast({
        id: `rec-error-${Date.now()}`,
        message: 'Failed to start recording. Your browser may not support it.',
        variant: 'warn',
      })
      setRecordingState('idle')
      managerRef.current = null
      return
    }

    return () => {
      manager.stop()
      managerRef.current = null
      attachedPeerIdsRef.current = new Set()
    }
    // peers is intentionally excluded: peer join/leave is handled by the separate effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, recordingState, localStream, roomId])

  // Remove streams for peers that leave while recording is active.
  useEffect(() => {
    const manager = managerRef.current
    if (!manager) return
    for (const id of [...attachedPeerIdsRef.current]) {
      if (!peers.has(id)) {
        manager.removeStream(id)
        attachedPeerIdsRef.current.delete(id)
      }
    }
  }, [peers])

  // Warn host before closing the tab mid-recording.
  useEffect(() => {
    if (recordingState !== 'recording') return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [recordingState])

  return null
}
