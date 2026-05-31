/**
 * Integration: PeerManager + usePeerStore + useSessionStore + useCallStore
 *
 * Unit tests mock everything in isolation. These tests fire socket events in
 * realistic sequences and assert the combined state across all three stores —
 * the thing nobody was watching before.
 */
import { render, act } from '@testing-library/react'
import { usePeerStore } from '../../../src/v2/store/usePeerStore'
import { useSessionStore } from '../../../src/v2/store/useSessionStore'
import { useCallStore } from '../../../src/v2/store/useCallStore'

// ── Socket mock ────────────────────────────────────────────────────────────────
const socketCallbacks: Record<string, Function[]> = {}
const mockSocket = {
  on: jest.fn((event: string, cb: Function) => {
    if (!socketCallbacks[event]) socketCallbacks[event] = []
    socketCallbacks[event].push(cb)
  }),
  once: jest.fn((event: string, cb: Function) => {
    const wrapper = (...args: unknown[]) => {
      cb(...args)
      socketCallbacks[event] = socketCallbacks[event]?.filter((h) => h !== wrapper)
    }
    if (!socketCallbacks[event]) socketCallbacks[event] = []
    socketCallbacks[event].push(wrapper)
  }),
  off: jest.fn((event: string) => {
    socketCallbacks[event] = []
  }),
  emit: jest.fn(),
  disconnect: jest.fn(),
  id: 'mock-socket-id',
}
jest.mock('socket.io-client', () => ({ io: jest.fn(() => mockSocket) }))

// ── simple-peer mock ───────────────────────────────────────────────────────────
const peerCallbacks: Record<string, Function> = {}
const mockPeerInstance = {
  on: jest.fn((event: string, cb: Function) => { peerCallbacks[event] = cb }),
  signal: jest.fn(),
  destroy: jest.fn(),
  addTrack: jest.fn(),
  destroyed: false,
}
jest.mock('simple-peer', () => jest.fn(() => mockPeerInstance))

function fire(event: string, payload?: unknown) {
  socketCallbacks[event]?.forEach((cb) => cb(payload))
}

let PeerManager: typeof import('../../../src/v2/call/PeerManager').PeerManager

beforeAll(async () => {
  PeerManager = (await import('../../../src/v2/call/PeerManager')).PeerManager
})

beforeEach(() => {
  Object.keys(socketCallbacks).forEach((k) => delete socketCallbacks[k])
  Object.keys(peerCallbacks).forEach((k) => delete peerCallbacks[k])
  mockSocket.emit.mockClear()
  mockSocket.disconnect.mockClear()
  mockSocket.on.mockClear()
  mockSocket.once.mockClear()
  mockPeerInstance.signal.mockClear()
  mockPeerInstance.destroy.mockClear()
  mockPeerInstance.addTrack.mockClear()
  mockPeerInstance.destroyed = false
  usePeerStore.setState({ peers: new Map() })
  useSessionStore.setState({
    messages: [], pinnedMessage: null,
    activePoll: null, pollResponses: {},
    recordingState: 'idle', recordingConsentPeers: [],
  })
  useCallStore.setState({ roomId: 'room-1', userName: 'Ralph', localStream: null })
})

// ── Tests ──────────────────────────────────────────────────────────────────────

test('full join sequence: peers and auth state land in correct stores', async () => {
  await act(async () => { render(<PeerManager />) })

  act(() => {
    fire('connect')
    fire('room-token', { token: 'tok-abc' })
    fire('all-users', [
      { id: 'peer-a', name: 'Alice', role: 'host' },
      { id: 'peer-b', name: 'Bob',   role: 'guest' },
    ])
  })

  // usePeerStore: both peers registered
  const peers = usePeerStore.getState().peers
  expect(peers.size).toBe(2)
  expect(peers.get('peer-a')?.name).toBe('Alice')
  expect(peers.get('peer-a')?.role).toBe('host')
  expect(peers.get('peer-b')?.connectionState).toBe('connecting')

  // signaling emitted join-room with the token received from room-token
  expect(mockSocket.emit).toHaveBeenCalledWith('join-room',
    expect.objectContaining({ roomId: 'room-1', token: 'tok-abc' })
  )
})

test('chat message and poll land in sessionStore simultaneously', async () => {
  await act(async () => { render(<PeerManager />) })

  act(() => {
    fire('connect')
    fire('room-token', { token: 'tok-1' })
    fire('new-message', { id: 'msg-1', sender: 'peer-a', senderName: 'Alice', text: 'Ready?', timestamp: 1000 })
    fire('new-poll', { id: 'poll-1', question: 'Go?', options: ['Yes', 'No'], createdAt: 1000 })
  })

  const session = useSessionStore.getState()
  expect(session.messages[0]?.text).toBe('Ready?')
  expect(session.activePoll?.id).toBe('poll-1')
  // pollResponses reset when poll arrived — nothing recorded yet
  expect(session.pollResponses).toEqual({})
})

test('user-left removes peer without touching session messages', async () => {
  await act(async () => { render(<PeerManager />) })

  act(() => {
    fire('connect')
    fire('room-token', { token: 'tok-1' })
    fire('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
    fire('new-message', { id: 'msg-1', sender: 'peer-a', senderName: 'Alice', text: 'hi', timestamp: 500 })
    fire('user-left', 'peer-a')
  })

  expect(usePeerStore.getState().peers.has('peer-a')).toBe(false)
  // message history survives the departure
  expect(useSessionStore.getState().messages).toHaveLength(1)
  expect(useSessionStore.getState().messages[0]?.text).toBe('hi')
})

test('chat-history populates messages while peers populate peerStore independently', async () => {
  await act(async () => { render(<PeerManager />) })

  act(() => {
    fire('connect')
    fire('room-token', { token: 'tok-1' })
    fire('all-users', [{ id: 'peer-a', name: 'Alice', role: 'host' }])
    fire('chat-history', [
      { id: 'h-1', sender: 'peer-a', text: 'before you joined', timestamp: 100 },
      { id: 'h-2', sender: 'peer-a', text: 'still waiting',    timestamp: 200 },
    ])
  })

  expect(useSessionStore.getState().messages).toHaveLength(2)
  expect(usePeerStore.getState().peers.get('peer-a')?.name).toBe('Alice')
})

test('late localStream: addTrack called on existing peer connection', async () => {
  useCallStore.setState({ localStream: null })
  await act(async () => { render(<PeerManager />) })

  act(() => {
    fire('connect')
    fire('room-token', { token: 'tok-1' })
    fire('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })

  expect(mockPeerInstance.addTrack).not.toHaveBeenCalled()

  const mockTrack = { kind: 'video' } as MediaStreamTrack
  const mockStream = { getTracks: () => [mockTrack] } as unknown as MediaStream

  act(() => { useCallStore.getState().setLocalStream(mockStream) })

  expect(mockPeerInstance.addTrack).toHaveBeenCalledWith(mockTrack, mockStream)
  // peer record still in store — addTrack doesn't evict it
  expect(usePeerStore.getState().peers.has('peer-a')).toBe(true)
})

test('new poll replaces previous poll and resets responses', async () => {
  await act(async () => { render(<PeerManager />) })

  act(() => {
    fire('new-poll', { id: 'poll-1', question: 'First?', options: ['A', 'B'], createdAt: 1000 })
  })
  useSessionStore.getState().recordPollResponse('peer-a', 'A')

  act(() => {
    fire('new-poll', { id: 'poll-2', question: 'Second?', options: ['X', 'Y'], createdAt: 2000 })
  })

  const session = useSessionStore.getState()
  expect(session.activePoll?.id).toBe('poll-2')
  expect(session.pollResponses).toEqual({})
})
