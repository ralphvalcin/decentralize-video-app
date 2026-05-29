import { useEffect, useRef } from 'react'
import { useCallStore } from '../store/useCallStore'

export function MediaController() {
  const setLocalStream = useCallStore((s) => s.setLocalStream)
  const isMuted = useCallStore((s) => s.isMuted)
  const isCamOff = useCallStore((s) => s.isCamOff)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        // Apply whatever mute/cam state was set while getUserMedia was in-flight
        const { isMuted: muted, isCamOff: camOff } = useCallStore.getState()
        stream.getAudioTracks().forEach((t) => {
          t.enabled = !muted
          t.onended = () => { useCallStore.getState().setMuted(true) }
        })
        stream.getVideoTracks().forEach((t) => {
          t.enabled = !camOff
          t.onended = () => { useCallStore.getState().setCamOff(true) }
        })
        streamRef.current = stream
        setLocalStream(stream)
      })
      .catch((err) => {
        console.error('[MediaController] getUserMedia failed:', err)
        useCallStore.getState().setMediaError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
      // Null onended before stop() — real browsers fire 'ended' when stop() is called,
      // which would incorrectly set isMuted/isCamOff true on a normal unmount.
      streamRef.current?.getTracks().forEach((t) => {
        t.onended = null
        t.stop()
      })
      streamRef.current = null
      setLocalStream(null)
    }
  }, [setLocalStream])

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !isMuted
    })
  }, [isMuted])

  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !isCamOff
    })
  }, [isCamOff])

  return null
}
