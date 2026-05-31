import { render, screen } from '@testing-library/react'
import { SpotlightView } from '../../../../src/v2/call/SpotlightView'
import { usePeerStore } from '../../../../src/v2/store/usePeerStore'
import { useCallStore } from '../../../../src/v2/store/useCallStore'
import type { PeerRecord } from '../../../../src/v2/types'

function makePeer(overrides: Partial<PeerRecord> = {}): PeerRecord {
  return {
    id: 'peer-1', name: 'Alice', role: 'guest',
    stream: null, isMuted: false, isCamOff: false, videoEnabled: false, isScreenSharing: false,
    connectionState: 'connected', networkQuality: 'good',
    isSpeaking: false, isPinned: false,
    hasRaisedHand: false, handRaisedAt: null,
    reaction: null, isAway: false, isTyping: false,
    ...overrides,
  }
}

beforeEach(() => {
  usePeerStore.setState({ peers: new Map() })
  useCallStore.setState({ localStream: null, screenSharePeerId: null, isMuted: false, isCamOff: false, userName: 'Ralph' })
})

test('renders spotlight-view container', () => {
  render(<SpotlightView />)
  expect(screen.getByTestId('spotlight-view')).toBeInTheDocument()
})

test('shows local stream tile when no peers', () => {
  render(<SpotlightView />)
  expect(screen.getByText('Ralph')).toBeInTheDocument()
})

test('shows first peer when peers exist', () => {
  usePeerStore.getState().setPeer('peer-1', makePeer({ name: 'Alice' }))
  render(<SpotlightView />)
  expect(screen.getByText('Alice')).toBeInTheDocument()
})

test('prioritises pinned peer over isSpeaking peer', () => {
  usePeerStore.getState().setPeer('peer-1', makePeer({ id: 'peer-1', name: 'Alice', isSpeaking: true }))
  usePeerStore.getState().setPeer('peer-2', makePeer({ id: 'peer-2', name: 'Bob', isPinned: true }))
  render(<SpotlightView />)
  expect(screen.getByText('Bob')).toBeInTheDocument()
})

test('prioritises screenShare peer over pinned', () => {
  usePeerStore.getState().setPeer('peer-1', makePeer({ id: 'peer-1', name: 'Alice', isPinned: true }))
  usePeerStore.getState().setPeer('screener', makePeer({ id: 'screener', name: 'Carol', isScreenSharing: true }))
  useCallStore.setState({ screenSharePeerId: 'screener' })
  render(<SpotlightView />)
  expect(screen.getByText('Carol')).toBeInTheDocument()
})

test('prioritises isSpeaking peer over first peer', () => {
  usePeerStore.getState().setPeer('peer-1', makePeer({ id: 'peer-1', name: 'Alice', isSpeaking: false }))
  usePeerStore.getState().setPeer('peer-2', makePeer({ id: 'peer-2', name: 'Bob', isSpeaking: true }))
  render(<SpotlightView />)
  expect(screen.getByText('Bob')).toBeInTheDocument()
})

test('falls back to local stream when screenSharePeerId points to unknown peer', () => {
  useCallStore.setState({ screenSharePeerId: 'ghost' })
  render(<SpotlightView />)
  expect(screen.getByText('Ralph')).toBeInTheDocument()
})

test('falls back to "You" when userName is empty string', () => {
  useCallStore.setState({ userName: '' })
  render(<SpotlightView />)
  expect(screen.getByText('You')).toBeInTheDocument()
})
