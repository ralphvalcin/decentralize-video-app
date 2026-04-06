import { usePeerStore } from '../store/usePeerStore'
import { useCallStore } from '../store/useCallStore'
import { VideoTile } from '../ui/VideoTile'
import type { PeerRecord } from '../types'

function pickSpotlight(
  peers: Map<string, PeerRecord>,
  screenSharePeerId: string | null
): PeerRecord | null {
  const list = Array.from(peers.values())
  if (screenSharePeerId) return peers.get(screenSharePeerId) ?? null
  const pinned = list.find((p) => p.isPinned)
  if (pinned) return pinned
  const speaking = list.find((p) => p.isSpeaking)
  if (speaking) return speaking
  return list[0] ?? null
}

export function SpotlightView() {
  const peers = usePeerStore((s) => s.peers)
  const screenSharePeerId = useCallStore((s) => s.screenSharePeerId)
  const localStream = useCallStore((s) => s.localStream)
  const isMuted = useCallStore((s) => s.isMuted)
  const isCamOff = useCallStore((s) => s.isCamOff)
  const userName = useCallStore((s) => s.userName)

  const spotlightPeer = pickSpotlight(peers, screenSharePeerId)

  return (
    <div data-testid="spotlight-view" className="flex-1 min-h-0 relative">
      {spotlightPeer ? (
        <VideoTile
          peerId={spotlightPeer.id}
          name={spotlightPeer.name}
          stream={spotlightPeer.stream}
          isMuted={spotlightPeer.isMuted}
          isCamOff={spotlightPeer.isCamOff}
          networkQuality={spotlightPeer.networkQuality}
          isAway={spotlightPeer.isAway}
          reaction={spotlightPeer.reaction}
          hasRaisedHand={spotlightPeer.hasRaisedHand}
          className="w-full h-full"
        />
      ) : (
        <VideoTile
          peerId="local"
          name={userName || 'You'}
          stream={localStream}
          isMuted={isMuted}
          isCamOff={isCamOff}
          networkQuality="good"
          isAway={false}
          reaction={null}
          hasRaisedHand={false}
          className="w-full h-full"
        />
      )}
    </div>
  )
}
