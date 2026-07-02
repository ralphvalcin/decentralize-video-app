import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCallStore } from '../store/useCallStore'
import { useUIStore } from '../store/useUIStore'
import { useTranscriptionStore } from '../store/useTranscriptionStore'
import { useSessionStore } from '../store/useSessionStore'
import { Button } from '../ui/Button'

interface ControlBarProps {
  onEndCall: () => void
  onToggleHand?: (raised: boolean) => void
  onSendReaction?: (emoji: string) => void
  onStartRecording?: () => void
  onStopRecording?: () => void
}

const REACTIONS = ['👍', '❤️', '😂', '😮', '👏']
const HIDE_AFTER_MS = 3000

export function ControlBar({ onEndCall, onToggleHand, onSendReaction, onStartRecording, onStopRecording }: ControlBarProps) {
  const isMuted = useCallStore((s) => s.isMuted)
  const isCamOff = useCallStore((s) => s.isCamOff)
  const setMuted = useCallStore((s) => s.setMuted)
  const setCamOff = useCallStore((s) => s.setCamOff)
  const isChatOpen = useUIStore((s) => s.isChatOpen)
  const toggleChat = useUIStore((s) => s.toggleChat)
  const isParticipantsOpen = useUIStore((s) => s.isParticipantsOpen)
  const toggleParticipants = useUIStore((s) => s.toggleParticipants)
  const isQAOpen = useUIStore((s) => s.isQAOpen)
  const toggleQA = useUIStore((s) => s.toggleQA)
  const isAIOpen = useUIStore((s) => s.isAIOpen)
  const toggleAI = useUIStore((s) => s.toggleAI)
  const isNoiseSuppressed = useCallStore((s) => s.isNoiseSuppressed)
  const toggleNoiseSuppression = useCallStore((s) => s.toggleNoiseSuppression)
  const isCaptionsOpen = useUIStore((s) => s.isCaptionsOpen)
  const toggleCaptions = useUIStore((s) => s.toggleCaptions)
  const isWhiteboardOpen = useUIStore((s) => s.isWhiteboardOpen)
  const toggleWhiteboard = useUIStore((s) => s.toggleWhiteboard)
  const hasRaisedHand = useCallStore((s) => s.hasRaisedHand)
  const isCaptionsLoading = useTranscriptionStore((s) => s.isLoading)
  const isHost = useCallStore((s) => s.isHost)
  const recordingState = useSessionStore((s) => s.recordingState)
  const [showReactions, setShowReactions] = useState(false)
  const [visible, setVisible] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function resetTimer() {
    setVisible(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(false), HIDE_AFTER_MS)
  }

  useEffect(() => {
    resetTimer()
    window.addEventListener('mousemove', resetTimer)
    return () => {
      window.removeEventListener('mousemove', resetTimer)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          data-testid="control-bar"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-3 bg-[var(--surface-overlay)] border border-[var(--border-default)] rounded-full"
        >
          <Button
            data-testid="btn-mute"
            variant={isMuted ? 'danger' : 'ghost'}
            onClick={() => setMuted(!isMuted)}
          >
            {isMuted ? '🔇 Unmute' : '🎙 Mute'}
          </Button>

          <Button
            data-testid="btn-cam"
            variant={isCamOff ? 'danger' : 'ghost'}
            onClick={() => setCamOff(!isCamOff)}
          >
            {isCamOff ? '📷 Start Cam' : '🎥 Stop Cam'}
          </Button>

          <div className="relative">
            <Button
              data-testid="btn-reactions"
              variant="ghost"
              onClick={() => setShowReactions((v) => !v)}
            >
              😊
            </Button>
            {showReactions && (
              <div
                data-testid="reaction-picker"
                className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-1 bg-[var(--surface-overlay)] border border-[var(--border-default)] rounded-full px-2 py-1"
              >
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => { onSendReaction?.(emoji); setShowReactions(false) }}
                    className="text-lg hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            data-testid="btn-chat"
            variant={isChatOpen ? 'primary' : 'ghost'}
            onClick={toggleChat}
            aria-label="Chat"
          >
            💬
          </Button>

          <Button
            data-testid="btn-participants"
            variant={isParticipantsOpen ? 'primary' : 'ghost'}
            onClick={toggleParticipants}
            aria-label="Participants"
          >
            👥
          </Button>

          <Button
            data-testid="btn-qa"
            variant={isQAOpen ? 'primary' : 'ghost'}
            onClick={toggleQA}
            aria-label="Q&A"
          >
            🙋
          </Button>

          <Button
            data-testid="btn-ai"
            variant={isAIOpen ? 'primary' : 'ghost'}
            onClick={toggleAI}
            aria-label="AI Insights"
          >
            🤖
          </Button>

          <Button
            data-testid="btn-noise"
            variant={isNoiseSuppressed ? 'primary' : 'ghost'}
            onClick={toggleNoiseSuppression}
            aria-label="Noise Suppression"
          >
            {isNoiseSuppressed ? '🎛 Noise: On' : '🎛 Noise: Off'}
          </Button>

          <Button
            data-testid="btn-cc"
            variant={isCaptionsOpen ? 'primary' : 'ghost'}
            onClick={toggleCaptions}
            disabled={isCaptionsLoading}
            aria-label="Captions"
          >
            {isCaptionsLoading ? 'CC …' : isCaptionsOpen ? 'CC ✓' : 'CC'}
          </Button>

          <Button
            data-testid="btn-raise-hand"
            variant={hasRaisedHand ? 'primary' : 'ghost'}
            onClick={() => onToggleHand?.(!hasRaisedHand)}
            aria-label={hasRaisedHand ? 'Lower Hand' : 'Raise Hand'}
          >
            ✋
          </Button>

          <Button
            data-testid="btn-whiteboard"
            variant={isWhiteboardOpen ? 'primary' : 'ghost'}
            onClick={toggleWhiteboard}
            aria-label="Whiteboard"
          >
            ✏️
          </Button>

          {isHost && recordingState !== 'recording' && (
            <Button
              data-testid="btn-record"
              variant="ghost"
              onClick={onStartRecording}
              aria-label="Start Recording"
            >
              ⏺ Rec
            </Button>
          )}

          {isHost && recordingState === 'recording' && (
            <Button
              data-testid="btn-stop-record"
              variant="danger"
              onClick={onStopRecording}
              aria-label="Stop Recording"
            >
              ⏹ Stop Rec
            </Button>
          )}

          <Button
            data-testid="btn-end-call"
            variant="danger"
            onClick={onEndCall}
          >
            Leave
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
