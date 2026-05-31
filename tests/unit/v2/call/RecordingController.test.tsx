import { render, act } from '@testing-library/react'
import { useCallStore } from '../../../../src/v2/store/useCallStore'
import { useSessionStore } from '../../../../src/v2/store/useSessionStore'
import { usePeerStore } from '../../../../src/v2/store/usePeerStore'
import { useUIStore } from '../../../../src/v2/store/useUIStore'
import type { PeerRecord } from '../../../../src/v2/types'

jest.mock('../../../../src/v2/recording/RecordingManager')
import { RecordingManager } from '../../../../src/v2/recording/RecordingManager'
const MockRecordingManager = RecordingManager as jest.MockedClass<typeof RecordingManager>

const mockManager = {
  start: jest.fn(),
  removeStream: jest.fn(),
  stop: jest.fn(),
}

const makePeer = (id: string, stream: MediaStream | null = null): PeerRecord => ({
  id, name: 'Peer', role: 'guest', stream, isMuted: false, isCamOff: false,
  videoEnabled: true, isScreenSharing: false, connectionState: 'connected',
  networkQuality: 'good', isSpeaking: false, isPinned: false,
  hasRaisedHand: false, handRaisedAt: null, reaction: null, isAway: false, isTyping: false,
})

const makeMockStream = (): MediaStream =>
  ({ id: 'stream-1', getAudioTracks: () => [{}] } as unknown as MediaStream)

beforeEach(() => {
  MockRecordingManager.mockImplementation(() => mockManager as any)
  useCallStore.setState({ localStream: null, isHost: false, userName: 'Host' })
  useSessionStore.setState({ recordingState: 'idle' })
  usePeerStore.setState({ peers: new Map() })
  jest.clearAllMocks()
})

let RecordingController: typeof import('../../../../src/v2/call/RecordingController').RecordingController
beforeAll(async () => {
  RecordingController = (await import('../../../../src/v2/call/RecordingController')).RecordingController
})

test('renders null (renderless component)', () => {
  const { container } = render(<RecordingController roomId="room-1" />)
  expect(container).toBeEmptyDOMElement()
})

test('does NOT start recording when isHost is false even if recordingState is recording', async () => {
  useCallStore.setState({ isHost: false, localStream: makeMockStream() })
  render(<RecordingController roomId="room-1" />)
  await act(async () => {
    useSessionStore.setState({ recordingState: 'recording' })
  })
  expect(MockRecordingManager).not.toHaveBeenCalled()
})

test('creates RecordingManager and calls start() when host starts recording', async () => {
  const localStream = makeMockStream()
  useCallStore.setState({ isHost: true, localStream })
  render(<RecordingController roomId="room-1" />)
  await act(async () => {
    useSessionStore.setState({ recordingState: 'recording' })
  })
  expect(MockRecordingManager).toHaveBeenCalledWith('room-1')
  expect(mockManager.start).toHaveBeenCalledWith(localStream, [])
})

test('passes remote streams to start()', async () => {
  const localStream = makeMockStream()
  const remoteStream = makeMockStream()
  useCallStore.setState({ isHost: true, localStream })
  usePeerStore.setState({ peers: new Map([['peer-1', makePeer('peer-1', remoteStream)]]) })
  render(<RecordingController roomId="room-1" />)
  await act(async () => {
    useSessionStore.setState({ recordingState: 'recording' })
  })
  expect(mockManager.start).toHaveBeenCalledWith(localStream, [{ id: 'peer-1', stream: remoteStream }])
})

test('calls manager.stop() when recordingState returns to idle', async () => {
  useCallStore.setState({ isHost: true, localStream: makeMockStream() })
  render(<RecordingController roomId="room-1" />)
  await act(async () => {
    useSessionStore.setState({ recordingState: 'recording' })
  })
  await act(async () => {
    useSessionStore.setState({ recordingState: 'idle' })
  })
  expect(mockManager.stop).toHaveBeenCalled()
})

test('shows unsupported toast and resets state when MediaRecorder absent', async () => {
  const original = (global as any).MediaRecorder
  delete (global as any).MediaRecorder
  useCallStore.setState({ isHost: true, localStream: makeMockStream() })
  render(<RecordingController roomId="room-1" />)
  await act(async () => {
    useSessionStore.setState({ recordingState: 'recording' })
  })
  expect(useSessionStore.getState().recordingState).toBe('idle')
  expect(useUIStore.getState().toasts.some((t: any) => t.message.includes('supported'))).toBe(true)
  ;(global as any).MediaRecorder = original
})

test('calls manager.removeStream() when a peer with stream leaves', async () => {
  const localStream = makeMockStream()
  const remoteStream = makeMockStream()
  useCallStore.setState({ isHost: true, localStream })
  usePeerStore.setState({ peers: new Map([['peer-1', makePeer('peer-1', remoteStream)]]) })
  render(<RecordingController roomId="room-1" />)
  await act(async () => {
    useSessionStore.setState({ recordingState: 'recording' })
  })
  await act(async () => {
    usePeerStore.setState({ peers: new Map() })
  })
  expect(mockManager.removeStream).toHaveBeenCalledWith('peer-1')
})
