import { render, screen, act } from '@testing-library/react'
import type { QualitySnapshot } from '../../../../src/v2/components/ai/ConnectionQualityPredictions'
import type { PeerManagerHandle } from '../../../../src/v2/call/PeerManager'
import { createRef } from 'react'

// Capture onQualityChange so tests can fire it directly
let capturedOnQualityChange: ((s: QualitySnapshot) => void) | null = null

jest.mock('../../../../src/v2/components/ai/ConnectionQualityPredictions', () => ({
  ConnectionQualityPredictions: ({ onQualityChange }: { onQualityChange: (s: QualitySnapshot) => void }) => {
    capturedOnQualityChange = onQualityChange
    return <div data-testid="mock-quality-predictions" />
  },
}))

jest.mock('../../../../src/v2/components/ai/TroubleshootingAssistant', () => ({
  TroubleshootingAssistant: () => <div data-testid="mock-troubleshooting" />,
}))

jest.mock('../../../../src/v2/components/ai/AIInsightsDashboard', () => ({
  AIInsightsDashboard: () => <div data-testid="mock-insights" />,
}))

function makeMockRef() {
  const ref = createRef<PeerManagerHandle>()
  ;(ref as { current: PeerManagerHandle }).current = {
    sendMessage: jest.fn(),
    sendReaction: jest.fn(),
    votePoll: jest.fn(),
    submitQuestion: jest.fn(),
    voteQuestion: jest.fn(),
    answerQuestion: jest.fn(),
    getPeerConnections: jest.fn(() => new Map()),
  }
  return ref
}

beforeEach(() => {
  capturedOnQualityChange = null
})

// Import after mocks
let AISidePanel: typeof import('../../../../src/v2/call/AISidePanel').AISidePanel

beforeAll(async () => {
  AISidePanel = (await import('../../../../src/v2/call/AISidePanel')).AISidePanel
})

test('renders all three sub-components', () => {
  render(<AISidePanel peerManagerRef={makeMockRef()} />)
  expect(screen.getByTestId('mock-quality-predictions')).toBeInTheDocument()
  expect(screen.getByTestId('mock-insights')).toBeInTheDocument()
})

test('TroubleshootingAssistant is hidden when quality is Good', () => {
  render(<AISidePanel peerManagerRef={makeMockRef()} />)
  act(() => {
    capturedOnQualityChange?.({ worst: 'Good', worstPacketLoss: 2, worstJitter: 20, connections: new Map() })
  })
  expect(screen.queryByTestId('mock-troubleshooting')).not.toBeInTheDocument()
})

test('TroubleshootingAssistant mounts when quality is Poor', () => {
  render(<AISidePanel peerManagerRef={makeMockRef()} />)
  act(() => {
    capturedOnQualityChange?.({ worst: 'Poor', worstPacketLoss: 10, worstJitter: 50, connections: new Map() })
  })
  expect(screen.getByTestId('mock-troubleshooting')).toBeInTheDocument()
})

test('TroubleshootingAssistant mounts when any peer ICE state is failed', () => {
  const failedConn = { iceConnectionState: 'failed' } as unknown as RTCPeerConnection
  render(<AISidePanel peerManagerRef={makeMockRef()} />)
  act(() => {
    capturedOnQualityChange?.({
      worst: 'Good',
      worstPacketLoss: 2,
      worstJitter: 20,
      connections: new Map([['p1', failedConn]]),
    })
  })
  expect(screen.getByTestId('mock-troubleshooting')).toBeInTheDocument()
})
