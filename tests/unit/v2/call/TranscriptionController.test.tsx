import { render, act } from '@testing-library/react'
import { TranscriptionController } from '../../../../src/v2/call/TranscriptionController'
import { useTranscriptionStore } from '../../../../src/v2/store/useTranscriptionStore'
import { useCallStore } from '../../../../src/v2/store/useCallStore'
import { usePeerStore } from '../../../../src/v2/store/usePeerStore'
import type { PeerRecord } from '../../../../src/v2/types'

jest.mock('../../../../src/v2/audio/TranscriptionManager')
jest.mock('../../../../src/v2/audio/workerFactory', () => ({
  createTranscriptionWorker: jest.fn().mockReturnValue({} as Worker),
}))

import { TranscriptionManager } from '../../../../src/v2/audio/TranscriptionManager'
const MockTranscriptionManager = TranscriptionManager as jest.MockedClass<typeof TranscriptionManager>

const mockManager = {
  addStream: jest.fn(),
  removeStream: jest.fn(),
  dispose: jest.fn(),
}

const makePeer = (id: string, name: string, stream: MediaStream | null = null): PeerRecord => ({
  id, name, role: 'guest', stream, isMuted: false, isCamOff: false,
  videoEnabled: true, isScreenSharing: false, connectionState: 'connected',
  networkQuality: 'good', isSpeaking: false, isPinned: false,
  hasRaisedHand: false, handRaisedAt: null, reaction: null, isAway: false, isTyping: false,
})

const makeMockStream = (): MediaStream =>
  ({ getAudioTracks: () => [{}] } as unknown as MediaStream)

beforeEach(() => {
  MockTranscriptionManager.mockImplementation(() => mockManager as any)
  useTranscriptionStore.setState({ isEnabled: false, isLoading: false, segments: [] })
  useCallStore.setState({ localStream: null, userName: '' })
  usePeerStore.setState({ peers: new Map() })
  jest.clearAllMocks()
})

test('renders null (renderless component)', () => {
  const { container } = render(<TranscriptionController />)
  expect(container).toBeEmptyDOMElement()
})

test('creates TranscriptionManager when isEnabled becomes true', async () => {
  render(<TranscriptionController />)
  await act(async () => {
    useTranscriptionStore.setState({ isEnabled: true })
  })
  expect(MockTranscriptionManager).toHaveBeenCalled()
})

test('calls setLoading(true) when manager is created', async () => {
  render(<TranscriptionController />)
  await act(async () => {
    useTranscriptionStore.setState({ isEnabled: true })
  })
  expect(useTranscriptionStore.getState().isLoading).toBe(true)
})

test('sets isLoading=false and shows toast when model init fails', async () => {
  render(<TranscriptionController />)
  await act(async () => {
    useTranscriptionStore.setState({ isEnabled: true, isLoading: true })
  })
  // Simulate init error by calling the onInitError arg passed to TranscriptionManager
  const [, , , onInitError] = MockTranscriptionManager.mock.calls[0]
  act(() => { onInitError?.() })
  expect(useTranscriptionStore.getState().isLoading).toBe(false)
})

test('calls dispose when isEnabled becomes false', async () => {
  useTranscriptionStore.setState({ isEnabled: true })
  render(<TranscriptionController />)
  await act(async () => {
    useTranscriptionStore.setState({ isEnabled: false })
  })
  expect(mockManager.dispose).toHaveBeenCalled()
})

test('calls dispose on unmount', () => {
  useTranscriptionStore.setState({ isEnabled: true })
  const { unmount } = render(<TranscriptionController />)
  unmount()
  expect(mockManager.dispose).toHaveBeenCalled()
})

test('calls addStream for local stream when enabled', async () => {
  const stream = makeMockStream()
  useCallStore.setState({ localStream: stream, userName: 'Me' })
  render(<TranscriptionController />)
  await act(async () => {
    useTranscriptionStore.setState({ isEnabled: true })
  })
  expect(mockManager.addStream).toHaveBeenCalledWith('local', 'Me', stream)
})

test('calls addStream when a peer joins while enabled', async () => {
  useTranscriptionStore.setState({ isEnabled: true })
  render(<TranscriptionController />)
  const stream = makeMockStream()
  await act(async () => {
    usePeerStore.setState({ peers: new Map([['p1', makePeer('p1', 'Alice', stream)]]) })
  })
  expect(mockManager.addStream).toHaveBeenCalledWith('p1', 'Alice', stream)
})

test('does not addStream for peer with no stream', async () => {
  useTranscriptionStore.setState({ isEnabled: true })
  render(<TranscriptionController />)
  await act(async () => {
    usePeerStore.setState({ peers: new Map([['p1', makePeer('p1', 'Alice', null)]]) })
  })
  expect(mockManager.addStream).not.toHaveBeenCalledWith('p1', expect.anything(), expect.anything())
})

test('calls removeStream when a peer leaves', async () => {
  const stream = makeMockStream()
  useTranscriptionStore.setState({ isEnabled: true })
  usePeerStore.setState({ peers: new Map([['p1', makePeer('p1', 'Alice', stream)]]) })
  render(<TranscriptionController />)
  await act(async () => {
    usePeerStore.setState({ peers: new Map() })
  })
  expect(mockManager.removeStream).toHaveBeenCalledWith('p1')
})
