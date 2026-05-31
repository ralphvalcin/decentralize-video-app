import { render, screen } from '@testing-library/react'
import { VideoTile } from '../../../../src/v2/ui/VideoTile'

const defaultProps = {
  peerId: 'peer-1',
  name: 'Alice',
  stream: null,
  isMuted: false,
  isCamOff: false,
  networkQuality: 'good' as const,
  isAway: false,
  reaction: null,
  hasRaisedHand: false,
}

test('shows name overlay', () => {
  render(<VideoTile {...defaultProps} />)
  expect(screen.getByText('Alice')).toBeInTheDocument()
})

test('shows avatar when cam is off', () => {
  render(<VideoTile {...defaultProps} isCamOff={true} />)
  expect(screen.getByText('A')).toBeInTheDocument()
})

test('shows away overlay when isAway', () => {
  render(<VideoTile {...defaultProps} isAway={true} />)
  expect(screen.getByText(/away/i)).toBeInTheDocument()
})

test('shows reaction emoji when set', () => {
  render(<VideoTile {...defaultProps} reaction={{ emoji: '👍', sentAt: Date.now() }} />)
  expect(screen.getByText('👍')).toBeInTheDocument()
})

test('shows raised hand badge', () => {
  render(<VideoTile {...defaultProps} hasRaisedHand={true} />)
  expect(screen.getByTestId('raised-hand')).toBeInTheDocument()
})

test('shows muted indicator', () => {
  render(<VideoTile {...defaultProps} isMuted={true} />)
  expect(screen.getByTestId('muted-indicator')).toBeInTheDocument()
})

test('renders video element when stream provided and cam on', () => {
  const fakeStream = { id: 'stream-1' } as unknown as MediaStream
  const { container } = render(<VideoTile {...defaultProps} stream={fakeStream} isCamOff={false} />)
  expect(container.querySelector('video')).toBeInTheDocument()
})
