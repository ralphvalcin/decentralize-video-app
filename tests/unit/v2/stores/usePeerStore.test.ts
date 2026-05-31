import { usePeerStore } from '../../../../src/v2/store/usePeerStore'
import type { PeerRecord } from '../../../../src/v2/types'

function makePeer(overrides: Partial<PeerRecord> = {}): PeerRecord {
  return {
    id: 'peer-1', name: 'Alice', role: 'guest',
    stream: null, isMuted: false, isCamOff: false, videoEnabled: false, isScreenSharing: false,
    connectionState: 'connecting', networkQuality: 'good',
    isSpeaking: false, isPinned: false,
    hasRaisedHand: false, handRaisedAt: null,
    reaction: null, isAway: false, isTyping: false,
    ...overrides,
  }
}

beforeEach(() => { usePeerStore.setState({ peers: new Map() }) })

test('setPeer stores full record', () => {
  const peer = makePeer()
  usePeerStore.getState().setPeer('peer-1', peer)
  expect(usePeerStore.getState().peers.get('peer-1')).toEqual(peer)
})

test('setPeer replaces existing record entirely', () => {
  usePeerStore.getState().setPeer('peer-1', makePeer({ name: 'Alice' }))
  usePeerStore.getState().setPeer('peer-1', makePeer({ name: 'Bob' }))
  expect(usePeerStore.getState().peers.get('peer-1')?.name).toBe('Bob')
})

test('patchPeer merges partial into existing', () => {
  usePeerStore.getState().setPeer('peer-1', makePeer({ isMuted: false }))
  usePeerStore.getState().patchPeer('peer-1', { isMuted: true })
  expect(usePeerStore.getState().peers.get('peer-1')?.isMuted).toBe(true)
  expect(usePeerStore.getState().peers.get('peer-1')?.name).toBe('Alice')
})

test('patchPeer on unknown id is a no-op', () => {
  expect(() => usePeerStore.getState().patchPeer('ghost', { isMuted: true })).not.toThrow()
  expect(usePeerStore.getState().peers.size).toBe(0)
})

test('removePeer deletes peer', () => {
  usePeerStore.getState().setPeer('peer-1', makePeer())
  usePeerStore.getState().removePeer('peer-1')
  expect(usePeerStore.getState().peers.has('peer-1')).toBe(false)
})

test('removePeer on unknown id is a no-op', () => {
  expect(() => usePeerStore.getState().removePeer('ghost')).not.toThrow()
})

test('patchPeer does not mutate other peers', () => {
  usePeerStore.getState().setPeer('peer-1', makePeer({ id: 'peer-1', name: 'Alice' }))
  usePeerStore.getState().setPeer('peer-2', makePeer({ id: 'peer-2', name: 'Bob' }))
  usePeerStore.getState().patchPeer('peer-1', { isMuted: true })
  expect(usePeerStore.getState().peers.get('peer-2')?.isMuted).toBe(false)
  expect(usePeerStore.getState().peers.get('peer-2')?.name).toBe('Bob')
})

test('setPeer normalizes key into record.id', () => {
  const peer = makePeer({ id: 'wrong-id' })
  usePeerStore.getState().setPeer('canonical-key', peer)
  expect(usePeerStore.getState().peers.get('canonical-key')?.id).toBe('canonical-key')
})
