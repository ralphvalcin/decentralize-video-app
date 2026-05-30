import { useUIStore } from '../../store/useUIStore'
import { useTranscriptionStore } from '../../store/useTranscriptionStore'

export function CaptionOverlay() {
  const isCaptionsOpen = useUIStore((s) => s.isCaptionsOpen)
  const isLoading = useTranscriptionStore((s) => s.isLoading)
  const segments = useTranscriptionStore((s) => s.segments)

  if (!isCaptionsOpen) return null

  if (isLoading) {
    return (
      <div
        data-testid="caption-overlay"
        className="absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none"
      >
        <div className="bg-black/60 text-white text-sm px-4 py-2 rounded-lg">
          Loading captions model…
        </div>
      </div>
    )
  }

  const last3 = segments.slice(-3)

  return (
    <div
      data-testid="caption-overlay"
      className="absolute bottom-20 left-0 right-0 px-4 flex flex-col items-center gap-1 pointer-events-none"
    >
      {last3.map((seg, i) => (
        <div
          key={`${seg.speakerId}-${seg.timestamp}-${i}`}
          className="bg-black/60 text-white text-sm px-4 py-2 rounded-lg max-w-2xl w-full text-center"
        >
          {`[${seg.userName}]: ${seg.text}`}
        </div>
      ))}
    </div>
  )
}
