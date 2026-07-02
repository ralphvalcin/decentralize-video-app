import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCallStore } from '../store/useCallStore'
import { useUIStore } from '../store/useUIStore'
import { MediaController } from '../call/MediaController'
import { PeerManager, type PeerManagerHandle } from '../call/PeerManager'
import { SpotlightView } from '../call/SpotlightView'
import { ThumbnailStrip } from '../call/ThumbnailStrip'
import { ControlBar } from '../call/ControlBar'
import { ChatPanel } from '../call/ChatPanel'
import { ParticipantsPanel } from '../call/ParticipantsPanel'
import { PollBanner } from '../call/PollBanner'
import { QAPanel } from '../call/QAPanel'
import { AISidePanel } from '../call/AISidePanel'
import { TranscriptionController } from '../call/TranscriptionController'
import { CaptionOverlay } from '../components/ai/CaptionOverlay'
import { RecordingController } from '../call/RecordingController'
import { RecordingIndicator } from '../components/RecordingIndicator'
import { useSessionStore } from '../store/useSessionStore'
import { WhiteboardController } from '../call/WhiteboardController'
import { WhiteboardModal } from '../call/WhiteboardModal'
import { useWhiteboardStore } from '../store/useWhiteboardStore'

export default function RoomV2() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const peerManagerRef = useRef<PeerManagerHandle>(null)
  const userName = useCallStore((s) => s.userName)
  const resetCall = useCallStore((s) => s.reset)
  const isChatOpen = useUIStore((s) => s.isChatOpen)
  const isParticipantsOpen = useUIStore((s) => s.isParticipantsOpen)
  const isQAOpen = useUIStore((s) => s.isQAOpen)
  const isAIOpen = useUIStore((s) => s.isAIOpen)
  const isWhiteboardOpen = useUIStore((s) => s.isWhiteboardOpen)
  const toggleWhiteboard = useUIStore((s) => s.toggleWhiteboard)
  const socketId = useCallStore((s) => s.socketId)
  const isHost = useCallStore((s) => s.isHost)
  const grantedPeerIds = useWhiteboardStore((s) => s.grantedPeerIds)
  const canDraw = isHost || grantedPeerIds.has(socketId ?? '')
  const setRecordingState = useSessionStore((s) => s.setRecordingState)
  const [linkCopied, setLinkCopied] = useState(false)

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/room/${roomId}`
    await navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  useEffect(() => {
    if (!userName) navigate(`/?redirect=/room/${roomId}`)
  }, [userName, roomId, navigate])

  return (
    <div className="v2 flex flex-col h-screen bg-[var(--surface-base)]" data-testid="room-v2">
      <MediaController />
      <TranscriptionController />
      <RecordingController roomId={roomId ?? ''} />
      {isWhiteboardOpen && <WhiteboardController />}
      <PeerManager ref={peerManagerRef} roomId={roomId ?? ''} />

      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-live)] shadow-[0_0_6px_var(--accent-live)]" />
          <span className="text-[var(--text-primary)] text-sm font-semibold">{roomId}</span>
        </div>
        <button
          onClick={handleCopyLink}
          className="text-xs px-3 py-1.5 rounded-[6px] border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
        >
          {linkCopied ? '✓ Link copied!' : '📋 Copy invite link'}
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-w-0 relative">
          <SpotlightView />
          <ThumbnailStrip />
          <PollBanner onVotePoll={(id, idx) => peerManagerRef.current?.votePoll(id, idx)} />
          <CaptionOverlay />
          <div className="absolute top-4 right-4 z-10">
            <RecordingIndicator />
          </div>
          <ControlBar
            onEndCall={() => { resetCall(); navigate('/') }}
            onToggleHand={(raised) =>
              raised ? peerManagerRef.current?.raiseHand() : peerManagerRef.current?.lowerHand()
            }
            onSendReaction={(emoji) => peerManagerRef.current?.sendReaction(emoji)}
            onStartRecording={() => {
              setRecordingState('recording')
              peerManagerRef.current?.broadcastRecordingStarted()
            }}
            onStopRecording={() => {
              setRecordingState('idle')
              peerManagerRef.current?.broadcastRecordingStopped()
            }}
          />
        </div>

        {isChatOpen && (
          <ChatPanel onSendMessage={(text) => peerManagerRef.current?.sendMessage(text)} />
        )}

        {isParticipantsOpen && (
          <ParticipantsPanel />
        )}

        {isQAOpen && (
          <QAPanel
            onSubmitQuestion={(text) => peerManagerRef.current?.submitQuestion(text)}
            onVoteQuestion={(id) => peerManagerRef.current?.voteQuestion(id)}
            onAnswerQuestion={(id, ans) => peerManagerRef.current?.answerQuestion(id, ans)}
          />
        )}

        {isAIOpen && (
          <AISidePanel peerManagerRef={peerManagerRef} />
        )}
      </div>

      {isWhiteboardOpen && (
        <WhiteboardModal
          canDraw={canDraw}
          onClose={toggleWhiteboard}
          onStroke={(stroke) => {
            useWhiteboardStore.getState().addStroke(stroke)
            peerManagerRef.current?.broadcastWhiteboardStroke(stroke)
          }}
          onClear={() => {
            useWhiteboardStore.getState().clearStrokes()
            peerManagerRef.current?.broadcastWhiteboardClear()
          }}
          onGrant={(peerId) => {
            useWhiteboardStore.getState().grantDrawing(peerId)
            peerManagerRef.current?.broadcastWhiteboardGrant(peerId)
          }}
          onRevoke={(peerId) => {
            useWhiteboardStore.getState().revokeDrawing(peerId)
            peerManagerRef.current?.broadcastWhiteboardRevoke(peerId)
          }}
        />
      )}
    </div>
  )
}
