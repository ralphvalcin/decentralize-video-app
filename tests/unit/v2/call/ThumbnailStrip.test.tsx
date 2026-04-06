import { render, screen } from '@testing-library/react'
import { ThumbnailStrip } from '../../../../src/v2/call/ThumbnailStrip'
import { usePeerStore } from '../../../../src/v2/store/usePeerStore'
import { useCallStore } from '../../../../src/v2/store/useCallStore'
import type { PeerRecord } from '../../../../src/v2/types'

function makePeer(overrides: Partial<PeerRecord> = {}): PeerRecord {
  return {
    id: 'peer-1', name: 'Alice', role: 'guest',
    stream: null, isMuted: false, isCamOff: false, videoEnabled: false, isScreenSharing: false,
    connectionState: 'connected', networkQuality: 'good',
    isSpeaking: false, isPinned: false, hasRaisedHand: false, handRaisedAt: null,
    reaction: null, isAway: false, isTyping: false,
    ...overrides,
  }
}

beforeEach(() => {
  usePeerStore.setState({ peers: new Map() })
  useCallStore.setState({ localStream: null, isMuted: false, isCamOff: false, userName: 'Ralph', screenSharePeerId: null })
})

test('renders thumbnail strip', () => {
  render(<ThumbnailStrip />)
  expect(screen.getByTestId('thumbnail-strip')).toBeInTheDocument()
})

test('always shows local video tile', () => {
  render(<ThumbnailStrip />)
  expect(screen.getByText('Ralph')).toBeInTheDocument()
})

test('shows remote peer tiles', () => {
  usePeerStore.getState().setPeer('peer-1', makePeer({ name: 'Alice' }))
  render(<ThumbnailStrip />)
  expect(screen.getByText('Alice')).toBeInTheDocument()
})

test('excludes screenShare peer from strip', () => {
  usePeerStore.getState().setPeer('screener', makePeer({ id: 'screener', name: 'Carol' }))
  useCallStore.setState({ screenSharePeerId: 'screener' })
  render(<ThumbnailStrip />)
  expect(screen.queryByText('Carol')).not.toBeInTheDocument()
})

test('shows "You" when userName is empty', () => {
  useCallStore.setState({ userName: '' })
  render(<ThumbnailStrip />)
  expect(screen.getByText('You')).toBeInTheDocument()
})
