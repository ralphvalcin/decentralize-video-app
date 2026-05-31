import { render, screen, fireEvent } from '@testing-library/react'
import { TroubleshootingAssistant } from '../../../../../src/v2/components/ai/TroubleshootingAssistant'
import { useCallStore } from '../../../../../src/v2/store/useCallStore'

function makeConn(iceState: RTCIceConnectionState) {
  return { iceConnectionState: iceState } as unknown as RTCPeerConnection
}

beforeEach(() => {
  useCallStore.setState({ mediaError: null })
})

test('shows TURN message when any peer ICE state is failed', () => {
  render(
    <TroubleshootingAssistant
      peerConnections={new Map([['p1', makeConn('failed')]])}
      packetLoss={0}
      jitter={0}
    />
  )
  expect(screen.getByTestId('troubleshooting-assistant')).toBeInTheDocument()
  expect(screen.getByText(/TURN relay server/i)).toBeInTheDocument()
})

test('ICE failed takes priority over high packet loss', () => {
  render(
    <TroubleshootingAssistant
      peerConnections={new Map([['p1', makeConn('failed')]])}
      packetLoss={15}
      jitter={0}
    />
  )
  expect(screen.getByText(/TURN relay server/i)).toBeInTheDocument()
  expect(screen.queryByText(/background applications/i)).not.toBeInTheDocument()
})

test('shows background-apps message when packet loss > 8 and ICE ok', () => {
  render(
    <TroubleshootingAssistant
      peerConnections={new Map([['p1', makeConn('connected')]])}
      packetLoss={10}
      jitter={0}
    />
  )
  expect(screen.getByText(/background applications/i)).toBeInTheDocument()
})

test('shows wired message when jitter > 100 and packet loss ok', () => {
  render(
    <TroubleshootingAssistant
      peerConnections={new Map([['p1', makeConn('connected')]])}
      packetLoss={0}
      jitter={120}
    />
  )
  expect(screen.getByText(/wired.*Ethernet/i)).toBeInTheDocument()
})

test('shows media error message when mediaError is set', () => {
  useCallStore.setState({ mediaError: 'NotAllowedError' })
  render(
    <TroubleshootingAssistant
      peerConnections={new Map([['p1', makeConn('connected')]])}
      packetLoss={0}
      jitter={0}
    />
  )
  expect(screen.getByText(/browser settings/i)).toBeInTheDocument()
})

test('renders nothing when all metrics are healthy', () => {
  render(
    <TroubleshootingAssistant
      peerConnections={new Map([['p1', makeConn('connected')]])}
      packetLoss={0}
      jitter={0}
    />
  )
  expect(screen.queryByTestId('troubleshooting-assistant')).not.toBeInTheDocument()
})

test('dismiss button hides the card', () => {
  render(
    <TroubleshootingAssistant
      peerConnections={new Map([['p1', makeConn('failed')]])}
      packetLoss={0}
      jitter={0}
    />
  )
  expect(screen.getByTestId('troubleshooting-assistant')).toBeInTheDocument()
  fireEvent.click(screen.getByTestId('dismiss-btn'))
  expect(screen.queryByTestId('troubleshooting-assistant')).not.toBeInTheDocument()
})
