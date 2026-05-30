import { useEffect, useRef } from 'react'
import { useCallStore } from '../store/useCallStore'
import { NoiseProcessor } from '../audio/NoiseProcessor'

export function MediaController() {
  const setLocalStream = useCallStore((s) => s.setLocalStream)
  const isMuted = useCallStore((s) => s.isMuted)
  const isCamOff = useCallStore((s) => s.isCamOff)
  const isNoiseSuppressed = useCallStore((s) => s.isNoiseSuppressed)
  const rawStreamRef = useRef<MediaStream | null>(null)
  const noiseProcessorRef = useRef<NoiseProcessor | null>(null)

  useEffect(() => {
    let cancelled = false
    const noiseProcessor = new NoiseProcessor()
    noiseProcessorRef.current = noiseProcessor

    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const { isMuted: muted, isCamOff: camOff } = useCallStore.getState()
        stream.getAudioTracks().forEach((t) => {
          t.enabled = !muted
          t.onended = () => { useCallStore.getState().setMuted(true) }
        })
        stream.getVideoTracks().forEach((t) => {
          t.enabled = !camOff
          t.onended = () => { useCallStore.getState().setCamOff(true) }
        })
        rawStreamRef.current = stream

        const processedStream = await noiseProcessor.process(stream)
        if (!cancelled) {
          setLocalStream(processedStream)
        }
      })
      .catch((err) => {
        console.error('[MediaController] getUserMedia failed:', err)
        useCallStore.getState().setMediaError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      cancelled = true
      rawStreamRef.current?.getTracks().forEach((t) => {
        t.onended = null
        t.stop()
      })
      rawStreamRef.current = null
      noiseProcessorRef.current?.dispose()
      noiseProcessorRef.current = null
      setLocalStream(null)
    }
  }, [setLocalStream])

  useEffect(() => {
    rawStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !isMuted
    })
  }, [isMuted])

  useEffect(() => {
    rawStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !isCamOff
    })
  }, [isCamOff])

  useEffect(() => {
    noiseProcessorRef.current?.setEnabled(isNoiseSuppressed)
  }, [isNoiseSuppressed])

  return null
}
