import { render, screen, fireEvent } from '@testing-library/react'
import { WhiteboardParticipantDropdown } from '../../../../src/v2/call/WhiteboardParticipantDropdown'
import { usePeerStore } from '../../../../src/v2/store/usePeerStore'
import { useWhiteboardStore } from '../../../../src/v2/store/useWhiteboardStore'
import { useCallStore } from '../../../../src/v2/store/useCallStore'
import type { PeerRecord } from '../../../../src/v2/types'

function makePeer(id: string, name: string): PeerRecord {
  return {
    id, name, role: 'guest',
    stream: null, isMuted: false, isCamOff: false, videoEnabled: false, isScreenSharing: false,
    connectionState: 'connected', networkQuality: 'good',
    isSpeaking: false, isPinned: false, hasRaisedHand: false, handRaisedAt: null,
    reaction: null, isAway: false, isTyping: false,
  }
}

const defaultProps = {
  onGrant: jest.fn(),
  onRevoke: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  usePeerStore.setState({ peers: new Map([
    ['peer-alice', makePeer('peer-alice', 'Alice')],
    ['peer-bob', makePeer('peer-bob', 'Bob')],
  ]) })
  useWhiteboardStore.setState({ strokes: [], grantedPeerIds: new Set(), currentTool: 'pen', currentColor: '#222222' })
  useCallStore.setState({ socketId: 'host-socket-id', isHost: true, userName: 'Host', localStream: null, isMuted: false, isCamOff: false, isNoiseSuppressed: true, screenSharePeerId: null, mediaError: null })
})

test('button is not visible initially (dropdown closed)', () => {
  render(<WhiteboardParticipantDropdown {...defaultProps} />)
  expect(screen.queryByTestId('participant-list')).not.toBeInTheDocument()
})

test('clicking the button opens the dropdown', () => {
  render(<WhiteboardParticipantDropdown {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-participants-toggle'))
  expect(screen.getByTestId('participant-list')).toBeInTheDocument()
})

test('lists connected peers by name', () => {
  render(<WhiteboardParticipantDropdown {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-participants-toggle'))
  expect(screen.getByText('Alice')).toBeInTheDocument()
  expect(screen.getByText('Bob')).toBeInTheDocument()
})

test('shows Grant button for peer without drawing rights', () => {
  render(<WhiteboardParticipantDropdown {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-participants-toggle'))
  expect(screen.getByTestId('btn-grant-peer-alice')).toBeInTheDocument()
})

test('shows Revoke button for peer with drawing rights', () => {
  useWhiteboardStore.setState({ strokes: [], grantedPeerIds: new Set(['peer-alice']), currentTool: 'pen', currentColor: '#222222' })
  render(<WhiteboardParticipantDropdown {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-participants-toggle'))
  expect(screen.getByTestId('btn-revoke-peer-alice')).toBeInTheDocument()
  expect(screen.queryByTestId('btn-grant-peer-alice')).not.toBeInTheDocument()
})

test('clicking Grant calls onGrant with peerId and closes dropdown', () => {
  render(<WhiteboardParticipantDropdown {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-participants-toggle'))
  fireEvent.click(screen.getByTestId('btn-grant-peer-alice'))
  expect(defaultProps.onGrant).toHaveBeenCalledWith('peer-alice')
  expect(screen.queryByTestId('participant-list')).not.toBeInTheDocument()
})

test('clicking Revoke calls onRevoke with peerId and closes dropdown', () => {
  useWhiteboardStore.setState({ strokes: [], grantedPeerIds: new Set(['peer-bob']), currentTool: 'pen', currentColor: '#222222' })
  render(<WhiteboardParticipantDropdown {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-participants-toggle'))
  fireEvent.click(screen.getByTestId('btn-revoke-peer-bob'))
  expect(defaultProps.onRevoke).toHaveBeenCalledWith('peer-bob')
  expect(screen.queryByTestId('participant-list')).not.toBeInTheDocument()
})

test('host socket ID is excluded from the list', () => {
  usePeerStore.setState({ peers: new Map([
    ['host-socket-id', makePeer('host-socket-id', 'Me')],
    ['peer-alice', makePeer('peer-alice', 'Alice')],
  ]) })
  render(<WhiteboardParticipantDropdown {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-participants-toggle'))
  expect(screen.queryByText('Me')).not.toBeInTheDocument()
  expect(screen.getByText('Alice')).toBeInTheDocument()
})

test('shows empty state message when no other participants', () => {
  usePeerStore.setState({ peers: new Map() })
  render(<WhiteboardParticipantDropdown {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-participants-toggle'))
  expect(screen.getByText('No other participants')).toBeInTheDocument()
})

test('clicking outside the dropdown closes it', () => {
  render(
    <div>
      <div data-testid="outside">outside</div>
      <WhiteboardParticipantDropdown {...defaultProps} />
    </div>
  )
  fireEvent.click(screen.getByTestId('btn-participants-toggle'))
  expect(screen.getByTestId('participant-list')).toBeInTheDocument()

  fireEvent.mouseDown(screen.getByTestId('outside'))
  expect(screen.queryByTestId('participant-list')).not.toBeInTheDocument()
})
