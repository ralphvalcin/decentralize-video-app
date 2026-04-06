import { usePeerStore } from '../store/usePeerStore'
import { useCallStore } from '../store/useCallStore'
import { VideoTile } from '../ui/VideoTile'

export function ThumbnailStrip() {
  const peers = usePeerStore((s) => s.peers)
  const localStream = useCallStore((s) => s.localStream)
  const isMuted = useCallStore((s) => s.isMuted)
  const isCamOff = useCallStore((s) => s.isCamOff)
  const userName = useCallStore((s) => s.userName)
  const screenSharePeerId = useCallStore((s) => s.screenSharePeerId)

  const peerList = Array.from(peers.values()).filter((p) => p.id !== screenSharePeerId)

  return (
    <div data-testid="thumbnail-strip" className="flex gap-2 px-4 py-2 overflow-x-auto shrink-0">
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
        className="w-36 h-24 shrink-0"
      />
      {peerList.map((peer) => (
        <VideoTile
          key={peer.id}
          peerId={peer.id}
          name={peer.name}
          stream={peer.stream}
          isMuted={peer.isMuted}
          isCamOff={peer.isCamOff}
          networkQuality={peer.networkQuality}
          isAway={peer.isAway}
          reaction={peer.reaction}
          hasRaisedHand={peer.hasRaisedHand}
          className="w-36 h-24 shrink-0"
        />
      ))}
    </div>
  )
}
