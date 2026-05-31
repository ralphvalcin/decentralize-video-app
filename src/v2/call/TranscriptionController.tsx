import { useEffect, useRef } from 'react'
import { useTranscriptionStore } from '../store/useTranscriptionStore'
import { useUIStore } from '../store/useUIStore'
import { useCallStore } from '../store/useCallStore'
import { usePeerStore } from '../store/usePeerStore'
import { TranscriptionManager } from '../audio/TranscriptionManager'
import { createTranscriptionWorker } from '../audio/workerFactory'

/**
 * Renderless controller that owns the `TranscriptionManager` lifecycle.
 *
 * Responsibilities:
 * - Creates and disposes a `TranscriptionManager` in sync with `isEnabled`.
 * - Calls `setLoading(true)` immediately on creation; `setLoading(false)` when
 *   the worker signals model-ready via `onReady`.
 * - Shows a warn toast and clears the loading state if model init fails.
 * - Tracks the local stream and all peer streams, calling `addStream` /
 *   `removeStream` on the manager as streams appear and disappear.
 *
 * Returns `null` — mounts no DOM nodes.
 */
export function TranscriptionController() {
  const isEnabled = useTranscriptionStore((s) => s.isEnabled)
  const setLoading = useTranscriptionStore((s) => s.setLoading)
  const addSegment = useTranscriptionStore((s) => s.addSegment)
  const addToast = useUIStore((s) => s.addToast)
  const localStream = useCallStore((s) => s.localStream)
  const localUserName = useCallStore((s) => s.userName)
  const peers = usePeerStore((s) => s.peers)

  const managerRef = useRef<TranscriptionManager | null>(null)
  /**
   * Tracks which peer IDs have already been handed to `addStream` so that
   * the peers effect — which re-runs on every map change — does not
   * double-register streams.
   */
  const attachedPeerIdsRef = useRef<Set<string>>(new Set())

  // --- Manager lifecycle ---------------------------------------------------
  useEffect(() => {
    if (!isEnabled) {
      managerRef.current?.dispose()
      managerRef.current = null
      attachedPeerIdsRef.current = new Set()
      return
    }

    setLoading(true)
    const worker = createTranscriptionWorker()
    const manager = new TranscriptionManager(
      worker,
      // onReady — model loaded successfully
      () => setLoading(false),
      // onSegment — forward each transcript segment into the store
      addSegment,
      // onInitError — model failed; surface a toast and clear loading state
      () => {
        setLoading(false)
        addToast({
          id: `cc-error-${Date.now()}`,
          message: 'Captions unavailable — model failed to load',
          variant: 'warn',
        })
      },
    )
    managerRef.current = manager

    return () => {
      manager.dispose()
      managerRef.current = null
      attachedPeerIdsRef.current = new Set()
    }
    // addSegment and addToast are stable Zustand action references; intentionally
    // omitting them keeps the dependency array honest about what should trigger recreation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled, setLoading])

  // --- Local stream --------------------------------------------------------
  useEffect(() => {
    const manager = managerRef.current
    if (!manager || !localStream) return
    manager.addStream('local', localUserName || 'You', localStream)
    return () => {
      manager.removeStream('local')
    }
    // Re-run when the manager instance changes (isEnabled flip) or when the
    // local stream / name changes.
  }, [isEnabled, localStream, localUserName])

  // --- Peer streams --------------------------------------------------------
  useEffect(() => {
    const manager = managerRef.current
    if (!manager) return

    // Attach any new peers that have a stream
    for (const [id, peer] of peers) {
      if (peer.stream && !attachedPeerIdsRef.current.has(id)) {
        manager.addStream(id, peer.name, peer.stream)
        attachedPeerIdsRef.current.add(id)
      }
    }

    // Detach peers that have left
    for (const id of [...attachedPeerIdsRef.current]) {
      if (!peers.has(id)) {
        manager.removeStream(id)
        attachedPeerIdsRef.current.delete(id)
      }
    }
  }, [peers, isEnabled])

  return null
}
