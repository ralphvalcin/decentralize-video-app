import { useEffect, useRef } from 'react'
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

  useEffect(() => {
    if (!userName) navigate(`/?redirect=/room/${roomId}`)
  }, [userName, roomId, navigate])

  return (
    <div className="v2 flex flex-col h-screen bg-[var(--surface-base)]" data-testid="room-v2">
      <MediaController />
      <PeerManager ref={peerManagerRef} roomId={roomId ?? ''} />

      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-live)] shadow-[0_0_6px_var(--accent-live)]" />
          <span className="text-[var(--text-primary)] text-sm font-semibold">{roomId}</span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-w-0 relative">
          <SpotlightView />
          <ThumbnailStrip />
          <PollBanner onVotePoll={(id, idx) => peerManagerRef.current?.votePoll(id, idx)} />
          <ControlBar
            onEndCall={() => { resetCall(); navigate('/') }}
            onSendReaction={(emoji) => peerManagerRef.current?.sendReaction(emoji)}
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
    </div>
  )
}
