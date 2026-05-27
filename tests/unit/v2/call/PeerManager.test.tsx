import { render, act } from '@testing-library/react'
import { createRef } from 'react'
import { usePeerStore } from '../../../../src/v2/store/usePeerStore'
import { useSessionStore } from '../../../../src/v2/store/useSessionStore'
import { useCallStore } from '../../../../src/v2/store/useCallStore'
import type { PeerManagerHandle } from '../../../../src/v2/call/PeerManager'

// Event-capturing simple-peer mock — overrides global jest.setup.js mock for this file
const peerCallbacks: Record<string, Function> = {}
const mockPeerInstance = {
  on: jest.fn((event: string, cb: Function) => { peerCallbacks[event] = cb }),
  signal: jest.fn(),
  destroy: jest.fn(),
  addTrack: jest.fn(),
  destroyed: false,
}
jest.mock('simple-peer', () => jest.fn(() => mockPeerInstance))

// Local socket mock — overrides any global mock for this file
const socketCallbacks: Record<string, Function[]> = {}
const mockSocket = {
  on: jest.fn((event: string, cb: Function) => {
    if (!socketCallbacks[event]) socketCallbacks[event] = []
    socketCallbacks[event].push(cb)
  }),
  // Enforce single-fire semantics so tests match real socket.io behaviour
  once: jest.fn((event: string, cb: Function) => {
    const wrapper = (...args: unknown[]) => {
      cb(...args)
      if (socketCallbacks[event]) {
        socketCallbacks[event] = socketCallbacks[event].filter((h) => h !== wrapper)
      }
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

function fireSocketEvent(event: string, payload?: unknown) {
  socketCallbacks[event]?.forEach((cb) => cb(payload))
}

// Import AFTER mock is defined
let PeerManager: typeof import('../../../../src/v2/call/PeerManager').PeerManager

beforeAll(async () => {
  PeerManager = (await import('../../../../src/v2/call/PeerManager')).PeerManager
})

afterEach(() => { jest.useRealTimers() })

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
  useSessionStore.setState({ messages: [] })
  useCallStore.setState({ userName: 'Ralph' })
})

test('emits request-room-token on connect', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => { fireSocketEvent('connect') })
  expect(mockSocket.emit).toHaveBeenCalledWith('request-room-token', { roomId: 'room-1', userName: 'Ralph' })
})

test('emits join-room after receiving room-token', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => { fireSocketEvent('connect'); fireSocketEvent('room-token', { token: 'tok-123' }) })
  expect(mockSocket.emit).toHaveBeenCalledWith('join-room', expect.objectContaining({ roomId: 'room-1', token: 'tok-123' }))
})

test('re-joins on reconnect (room-token fires again after second connect)', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => { fireSocketEvent('connect'); fireSocketEvent('room-token', { token: 'tok-1' }) })
  mockSocket.emit.mockClear()
  // Simulate Socket.io internal reconnect
  act(() => { fireSocketEvent('connect'); fireSocketEvent('room-token', { token: 'tok-2' }) })
  expect(mockSocket.emit).toHaveBeenCalledWith('join-room', expect.objectContaining({ token: 'tok-2' }))
})

test('creates peer records for all-users', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('all-users', [
      { id: 'peer-a', name: 'Alice', role: 'host' },
      { id: 'peer-b', name: 'Bob', role: 'guest' },
    ])
  })
  expect(usePeerStore.getState().peers.get('peer-a')?.name).toBe('Alice')
  expect(usePeerStore.getState().peers.get('peer-a')?.role).toBe('host')
  expect(usePeerStore.getState().peers.get('peer-b')?.name).toBe('Bob')
})

test('creates peer record when a user joins after us (user-joined)', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('user-joined', { callerID: 'peer-c', name: 'Carol', role: 'guest', signal: null })
  })
  expect(usePeerStore.getState().peers.get('peer-c')?.name).toBe('Carol')
  expect(usePeerStore.getState().peers.get('peer-c')?.connectionState).toBe('connecting')
})

test('removes peer on user-left', async () => {
  usePeerStore.getState().setPeer('peer-a', { id: 'peer-a', name: 'Alice', role: 'guest', stream: null, isMuted: false, isCamOff: false, videoEnabled: false, isScreenSharing: false, connectionState: 'connected', networkQuality: 'good', isSpeaking: false, isPinned: false, hasRaisedHand: false, handRaisedAt: null, reaction: null, isAway: false, isTyping: false })
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => { fireSocketEvent('user-left', 'peer-a') })
  expect(usePeerStore.getState().peers.has('peer-a')).toBe(false)
})

test('loads chat-history into store', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('chat-history', [
      { id: 'msg-0', sender: 'peer-a', senderName: 'Alice', text: 'hey', timestamp: 500 },
    ])
  })
  expect(useSessionStore.getState().messages[0]?.text).toBe('hey')
  expect(useSessionStore.getState().messages[0]?.peerId).toBe('peer-a')
  expect(useSessionStore.getState().messages[0]?.peerName).toBe('Alice')
})

test('adds incoming chat messages to store', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('new-message', { id: 'msg-1', sender: 'peer-a', senderName: 'Alice', text: 'Hello!', timestamp: 1000 })
  })
  expect(useSessionStore.getState().messages[0]?.text).toBe('Hello!')
  expect(useSessionStore.getState().messages[0]?.peerName).toBe('Alice')
})

test('new-message falls back to sender id when senderName missing', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('new-message', { id: 'msg-2', sender: 'peer-b', text: 'hi', timestamp: 2000 })
  })
  expect(useSessionStore.getState().messages[0]?.peerName).toBe('peer-b')
})

test('new-poll sets activePoll in session store', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('new-poll', { id: 'poll-1', question: 'Cats or dogs?', options: ['Cats', 'Dogs'], createdAt: 1000 })
  })
  expect(useSessionStore.getState().activePoll?.id).toBe('poll-1')
  expect(useSessionStore.getState().activePoll?.options).toEqual(['Cats', 'Dogs'])
})

test('logs server error event without throwing', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => { fireSocketEvent('error', { message: 'rate limit exceeded', code: 'RATE_LIMIT' }) })
  expect(consoleSpy).toHaveBeenCalledWith('[PeerManager] server error:', expect.objectContaining({ code: 'RATE_LIMIT' }))
  consoleSpy.mockRestore()
})

test('sendMessage emits send-message via socket', async () => {
  const ref = createRef<PeerManagerHandle>()
  await act(async () => { render(<PeerManager ref={ref} roomId="room-1" />) })
  act(() => { ref.current?.sendMessage('Hi there') })
  expect(mockSocket.emit).toHaveBeenCalledWith('send-message', expect.objectContaining({ text: 'Hi there' }))
})

test('sendReaction emits send-reaction via socket', async () => {
  const ref = createRef<PeerManagerHandle>()
  await act(async () => { render(<PeerManager ref={ref} roomId="room-1" />) })
  act(() => { ref.current?.sendReaction('👍') })
  expect(mockSocket.emit).toHaveBeenCalledWith('send-reaction', { emoji: '👍' })
})

test('roomId change: emits user-leaving and disconnects old socket before reconnecting', async () => {
  const { io } = require('socket.io-client')
  io.mockClear()
  mockSocket.disconnect.mockClear()
  mockSocket.emit.mockClear()

  let rerender!: ReturnType<typeof render>['rerender']
  await act(async () => {
    const result = render(<PeerManager roomId="room-1" />)
    rerender = result.rerender
  })
  expect(io).toHaveBeenCalledTimes(1)

  act(() => { rerender(<PeerManager roomId="room-2" />) })

  expect(mockSocket.emit).toHaveBeenCalledWith('user-leaving')
  expect(mockSocket.disconnect).toHaveBeenCalled()
  expect(io).toHaveBeenCalledTimes(2)
})

test('roomId cleared after connect: disconnects and does not reconnect', async () => {
  const { io } = require('socket.io-client')
  io.mockClear()
  mockSocket.disconnect.mockClear()

  let rerender!: ReturnType<typeof render>['rerender']
  await act(async () => {
    const result = render(<PeerManager roomId="room-1" />)
    rerender = result.rerender
  })
  expect(io).toHaveBeenCalledTimes(1)

  act(() => { rerender(<PeerManager roomId="" />) })

  expect(mockSocket.disconnect).toHaveBeenCalled()
  expect(io).toHaveBeenCalledTimes(1)
})

test('does not connect when roomId prop is empty', async () => {
  const { io } = require('socket.io-client')
  io.mockClear()
  useCallStore.setState({ userName: 'Ralph' })
  await act(async () => { render(<PeerManager roomId="" />) })
  expect(io).not.toHaveBeenCalled()
})

test('disconnects socket on unmount', async () => {
  let unmount!: () => void
  await act(async () => { unmount = render(<PeerManager roomId="room-1" />).unmount })
  act(() => { unmount() })
  expect(mockSocket.disconnect).toHaveBeenCalled()
})

test('creates initiator Peer for each user in all-users', async () => {
  const Peer = require('simple-peer')
  Peer.mockClear()
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })
  expect(Peer).toHaveBeenCalledWith(expect.objectContaining({ initiator: true }))
})

test('creates receiver Peer when user-joined arrives with signal', async () => {
  const Peer = require('simple-peer')
  Peer.mockClear()
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('user-joined', { signal: { type: 'offer', sdp: 'sdp' }, callerID: 'peer-b', name: 'Bob', role: 'guest' })
  })
  expect(Peer).toHaveBeenCalledWith(expect.objectContaining({ initiator: false }))
})

test('ignores WebRTC creation for user-joined without signal', async () => {
  const Peer = require('simple-peer')
  Peer.mockClear()
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('user-joined', { signal: null, callerID: 'peer-b', name: 'Bob', role: 'guest' })
  })
  expect(Peer).not.toHaveBeenCalled()
})

test('patchPeer sets stream and connected state on peer stream event', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })
  const fakeStream = { id: 'stream-1' } as unknown as MediaStream
  act(() => { peerCallbacks['stream']?.(fakeStream) })
  const peer = usePeerStore.getState().peers.get('peer-a')
  expect(peer?.stream).toBe(fakeStream)
  expect(peer?.connectionState).toBe('connected')
  expect(peer?.videoEnabled).toBe(true)
})

test('patchPeer sets disconnected on peer close event', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })
  act(() => { peerCallbacks['close']?.() })
  expect(usePeerStore.getState().peers.get('peer-a')?.connectionState).toBe('disconnected')
})

test('signals initiator peer on receiving-returned-signal', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })
  act(() => {
    fireSocketEvent('receiving-returned-signal', { signal: { type: 'answer', sdp: 'sdp' }, id: 'peer-a' })
  })
  expect(mockPeerInstance.signal).toHaveBeenCalledWith({ type: 'answer', sdp: 'sdp' })
})

test('destroys peer connections on unmount', async () => {
  let unmount!: () => void
  await act(async () => { unmount = render(<PeerManager roomId="room-1" />).unmount })
  act(() => {
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })
  act(() => { unmount() })
  expect(mockPeerInstance.destroy).toHaveBeenCalled()
})

test('addTrack called on existing peers when localStream arrives after connection', async () => {
  // Peers join before getUserMedia resolves — stream is null
  useCallStore.setState({ localStream: null })
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })

  // Stream arrives late
  const mockTrack = { kind: 'video' } as MediaStreamTrack
  const mockStream = { getTracks: () => [mockTrack] } as unknown as MediaStream
  act(() => { useCallStore.getState().setLocalStream(mockStream) })

  expect(mockPeerInstance.addTrack).toHaveBeenCalledWith(mockTrack, mockStream)
})

test('addTrack not called when localStream is null', async () => {
  useCallStore.setState({ localStream: null })
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })
  expect(mockPeerInstance.addTrack).not.toHaveBeenCalled()
})

test('peer created with stream in constructor when localStream already set at all-users time', async () => {
  const mockTrack = { kind: 'video' } as MediaStreamTrack
  const mockStream = { getTracks: () => [mockTrack] } as unknown as MediaStream
  useCallStore.setState({ localStream: mockStream })

  const Peer = require('simple-peer')
  Peer.mockClear()

  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })

  // Stream passed via constructor — addTrack must NOT be called (no double-add)
  expect(Peer).toHaveBeenCalledWith(expect.objectContaining({ stream: mockStream }))
  expect(mockPeerInstance.addTrack).not.toHaveBeenCalled()
})

test('peer error sets connectionState failed and destroys conn', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })
  act(() => { peerCallbacks['error']?.(new Error('ice fail')) })
  expect(usePeerStore.getState().peers.get('peer-a')?.connectionState).toBe('failed')
  expect(mockPeerInstance.destroy).toHaveBeenCalled()
  jest.restoreAllMocks()
})

test('peer error logs message without throwing', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })
  act(() => { peerCallbacks['error']?.(new Error('ice fail')) })
  expect(spy).toHaveBeenCalledWith('[PeerManager] peer error:', 'peer-a', 'ice fail')
  spy.mockRestore()
})

test('initiator peer signal callback emits sending-signal', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  mockSocket.emit.mockClear()
  act(() => {
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })
  act(() => { peerCallbacks['signal']?.({ type: 'offer', sdp: 'sdp-offer' }) })
  expect(mockSocket.emit).toHaveBeenCalledWith('sending-signal', expect.objectContaining({
    userToSignal: 'peer-a',
    signal: { type: 'offer', sdp: 'sdp-offer' },
  }))
})

test('receiver peer signal callback emits returning-signal', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  mockSocket.emit.mockClear()
  act(() => {
    fireSocketEvent('user-joined', { signal: { type: 'offer', sdp: 'sdp' }, callerID: 'peer-b', name: 'Bob', role: 'guest' })
  })
  act(() => { peerCallbacks['signal']?.({ type: 'answer', sdp: 'sdp-answer' }) })
  expect(mockSocket.emit).toHaveBeenCalledWith('returning-signal', expect.objectContaining({
    callerID: 'peer-b',
    signal: { type: 'answer', sdp: 'sdp-answer' },
  }))
})

test('destroyPeerConn skips destroy when peer already destroyed', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })
  mockPeerInstance.destroyed = true
  mockPeerInstance.destroy.mockClear()
  act(() => { fireSocketEvent('user-left', 'peer-a') })
  expect(mockPeerInstance.destroy).not.toHaveBeenCalled()
})

test('new-reaction sets reaction on peer in store', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => { fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }]) })
  act(() => { fireSocketEvent('new-reaction', { peerId: 'peer-a', emoji: '👍' }) })
  const peer = usePeerStore.getState().peers.get('peer-a')
  expect(peer?.reaction?.emoji).toBe('👍')
  expect(peer?.reaction?.sentAt).toBeGreaterThan(0)
})

test('new-reaction auto-clears after 3000ms', async () => {
  jest.useFakeTimers()
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => { fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }]) })
  act(() => { fireSocketEvent('new-reaction', { peerId: 'peer-a', emoji: '👍' }) })
  expect(usePeerStore.getState().peers.get('peer-a')?.reaction?.emoji).toBe('👍')
  act(() => { jest.advanceTimersByTime(3000) })
  expect(usePeerStore.getState().peers.get('peer-a')?.reaction).toBeNull()
  jest.useRealTimers()
})

test('new-reaction replaces existing reaction and resets timer', async () => {
  jest.useFakeTimers()
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => { fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }]) })
  act(() => { fireSocketEvent('new-reaction', { peerId: 'peer-a', emoji: '👍' }) })
  act(() => { jest.advanceTimersByTime(2000) })
  act(() => { fireSocketEvent('new-reaction', { peerId: 'peer-a', emoji: '❤️' }) })
  expect(usePeerStore.getState().peers.get('peer-a')?.reaction?.emoji).toBe('❤️')
  // 1000ms more (3000ms since first, 1000ms since second) — first timer would have fired, still set
  act(() => { jest.advanceTimersByTime(1000) })
  expect(usePeerStore.getState().peers.get('peer-a')?.reaction?.emoji).toBe('❤️')
  // Another 2000ms — 3000ms since second reaction — should be cleared
  act(() => { jest.advanceTimersByTime(2000) })
  expect(usePeerStore.getState().peers.get('peer-a')?.reaction).toBeNull()
  jest.useRealTimers()
})

test('chat-history uses senderName when server provides it', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('chat-history', [
      { id: 'msg-1', sender: 'socket-id-abc', senderName: 'Alice', text: 'Hello', timestamp: 1000 },
    ])
  })
  expect(useSessionStore.getState().messages[0].peerName).toBe('Alice')
})

test('all-users defaults role to guest when role field absent', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => { fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice' }]) })
  expect(usePeerStore.getState().peers.get('peer-a')?.role).toBe('guest')
})

test('user-joined defaults role to guest when role field absent', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => { fireSocketEvent('user-joined', { callerID: 'peer-b', name: 'Bob', signal: null }) })
  expect(usePeerStore.getState().peers.get('peer-b')?.role).toBe('guest')
})

test('receiving-returned-signal does nothing when conn not found', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => { fireSocketEvent('receiving-returned-signal', { signal: { type: 'answer', sdp: 'x' }, id: 'unknown-peer' }) })
  expect(mockPeerInstance.signal).not.toHaveBeenCalled()
})

test('poll-ended clears activePoll in session store', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  useSessionStore.setState({
    activePoll: { id: 'p1', question: 'Ready?', options: ['Yes', 'No'], createdAt: 1 },
  })
  expect(useSessionStore.getState().activePoll).not.toBeNull()
  act(() => { fireSocketEvent('poll-ended') })
  expect(useSessionStore.getState().activePoll).toBeNull()
})

test('reconnect: all-users destroys existing peer before creating a new one', async () => {
  const Peer = require('simple-peer')
  Peer.mockClear()
  await act(async () => { render(<PeerManager roomId="room-1" />) })

  // First all-users — creates peer for peer-a
  act(() => { fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }]) })
  expect(Peer).toHaveBeenCalledTimes(1)
  mockPeerInstance.destroy.mockClear()

  // Simulated reconnect: server sends all-users again with the same peer
  act(() => { fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }]) })

  // Old connection must have been destroyed before the new one was created
  expect(mockPeerInstance.destroy).toHaveBeenCalledTimes(1)
  // Two total Peer constructions (one per all-users)
  expect(Peer).toHaveBeenCalledTimes(2)
})

test('unmount removes turn-credentials listeners to prevent ghost callbacks', async () => {
  let unmount!: () => void
  await act(async () => { unmount = render(<PeerManager roomId="room-1" />).unmount })
  act(() => {
    fireSocketEvent('connect')
    fireSocketEvent('room-token', { token: 'tok' })
  })
  mockSocket.off.mockClear()
  act(() => { unmount() })
  expect(mockSocket.off).toHaveBeenCalledWith('turn-credentials')
  expect(mockSocket.off).toHaveBeenCalledWith('turn-credentials-error')
})

test('chat-history falls back to sender when senderName absent', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('chat-history', [
      { id: 'msg-2', sender: 'socket-id-abc', text: 'Hello', timestamp: 1000 },
    ])
  })
  expect(useSessionStore.getState().messages[0].peerName).toBe('socket-id-abc')
})

test('emits request-turn-credentials after join-room', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('connect')
    fireSocketEvent('room-token', { token: 'tok' })
  })
  expect(mockSocket.emit).toHaveBeenCalledWith('request-turn-credentials')
})

test('uses fetched TURN servers when turn-credentials arrives before all-users', async () => {
  const SimplePeer = (await import('simple-peer')).default as jest.MockedClass<any>
  const turnServers = [{ urls: ['turn:test.example.com:3478'], username: 'u', credential: 'p' }]
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('connect')
    fireSocketEvent('room-token', { token: 'tok' })
    fireSocketEvent('turn-credentials', { servers: turnServers })
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })
  const lastCall = SimplePeer.mock.calls[SimplePeer.mock.calls.length - 1]
  expect(lastCall[0].config.iceServers).toEqual(turnServers)
})

test('falls back to ICE_SERVERS when turn-credentials-error fires', async () => {
  const SimplePeer = (await import('simple-peer')).default as jest.MockedClass<any>
  const { ICE_SERVERS } = await import('../../../../src/v2/call/PeerManager')
  SimplePeer.mockClear()
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('connect')
    fireSocketEvent('room-token', { token: 'tok' })
    fireSocketEvent('turn-credentials-error', { code: 'NO_TURN_SERVERS' })
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })
  const lastCall = SimplePeer.mock.calls[SimplePeer.mock.calls.length - 1]
  expect(lastCall[0].config.iceServers).toEqual(ICE_SERVERS)
})

test('does not connect when userName is empty', async () => {
  const { io } = require('socket.io-client')
  io.mockClear()
  useCallStore.setState({ userName: '' })
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  expect(io).not.toHaveBeenCalled()
})

test('does not reconnect when unrelated store field changes', async () => {
  const { io } = require('socket.io-client')
  io.mockClear()
  useCallStore.setState({ userName: 'Ralph' })
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  expect(io).toHaveBeenCalledTimes(1)

  mockSocket.disconnect.mockClear()
  act(() => { useCallStore.getState().setMuted(true) })
  expect(io).toHaveBeenCalledTimes(1)
  expect(mockSocket.disconnect).not.toHaveBeenCalled()
})

test('reset() does not trigger reconnect', async () => {
  const { io } = require('socket.io-client')
  io.mockClear()
  useCallStore.setState({ userName: 'Ralph', isMuted: true })
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  expect(io).toHaveBeenCalledTimes(1)

  mockSocket.disconnect.mockClear()
  act(() => { useCallStore.getState().reset() })
  expect(mockSocket.disconnect).not.toHaveBeenCalled()
  expect(io).toHaveBeenCalledTimes(1)
})
