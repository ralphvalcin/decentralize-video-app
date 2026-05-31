import { render, screen } from '@testing-library/react'
import { ParticipantsPanel } from '../../../../src/v2/call/ParticipantsPanel'
import { usePeerStore } from '../../../../src/v2/store/usePeerStore'
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
})

test('renders panel with header', () => {
  render(<ParticipantsPanel />)
  expect(screen.getByTestId('participants-panel')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /participants/i })).toBeInTheDocument()
})

test('shows empty state when no peers', () => {
  render(<ParticipantsPanel />)
  expect(screen.getByText('No other participants yet.')).toBeInTheDocument()
})

test('shows peer name', () => {
  usePeerStore.setState({ peers: new Map([['peer-1', makePeer({ name: 'Alice' })]]) })
  render(<ParticipantsPanel />)
  expect(screen.getByText('Alice')).toBeInTheDocument()
})

test('shows muted indicator when peer is muted', () => {
  usePeerStore.setState({ peers: new Map([['peer-1', makePeer({ isMuted: true })]]) })
  render(<ParticipantsPanel />)
  expect(screen.getByTestId('peer-muted-peer-1')).toBeInTheDocument()
})

test('shows cam-off indicator when peer cam is off', () => {
  usePeerStore.setState({ peers: new Map([['peer-1', makePeer({ isCamOff: true })]]) })
  render(<ParticipantsPanel />)
  expect(screen.getByTestId('peer-cam-off-peer-1')).toBeInTheDocument()
})

test('shows connected status dot for connected peer', () => {
  usePeerStore.setState({ peers: new Map([['peer-1', makePeer({ connectionState: 'connected' })]]) })
  render(<ParticipantsPanel />)
  expect(screen.getByTestId('peer-status-peer-1')).toHaveClass('bg-[var(--accent-live)]')
})

test('shows failed status dot for failed peer', () => {
  usePeerStore.setState({ peers: new Map([['peer-1', makePeer({ connectionState: 'failed' })]]) })
  render(<ParticipantsPanel />)
  expect(screen.getByTestId('peer-status-peer-1')).toHaveClass('bg-[var(--accent-danger)]')
})

test('shows gray dot for peer with connecting state', () => {
  usePeerStore.setState({ peers: new Map([['peer-1', makePeer({ connectionState: 'connecting' })]]) })
  render(<ParticipantsPanel />)
  const dot = screen.getByTestId('peer-status-peer-1')
  expect(dot).not.toHaveClass('bg-[var(--accent-live)]')
  expect(dot).not.toHaveClass('bg-[var(--accent-danger)]')
})
