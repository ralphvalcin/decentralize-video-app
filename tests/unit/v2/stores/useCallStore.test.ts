import { useCallStore } from '../../../../src/v2/store/useCallStore'

beforeEach(() => {
  useCallStore.setState({
    localStream: null,
    isMuted: false,
    isCamOff: false,
    isNoiseSuppressed: true,
    userName: '',
    socketId: null,
    screenSharePeerId: null,
    mediaError: null,
    isHost: false,
  })
})

test('initial state has no roomId field', () => {
  expect('roomId' in useCallStore.getState()).toBe(false)
})

test('initial state is correct', () => {
  const state = useCallStore.getState()
  expect(state.localStream).toBeNull()
  expect(state.isMuted).toBe(false)
  expect(state.isCamOff).toBe(false)
  expect(state.userName).toBe('')
  expect(state.screenSharePeerId).toBeNull()
})

test('setUserName stores the user name', () => {
  useCallStore.getState().setUserName('Alice')
  expect(useCallStore.getState().userName).toBe('Alice')
})

test('setMuted toggles mute state', () => {
  useCallStore.getState().setMuted(true)
  expect(useCallStore.getState().isMuted).toBe(true)
  useCallStore.getState().setMuted(false)
  expect(useCallStore.getState().isMuted).toBe(false)
})

test('setCamOff toggles camera state', () => {
  useCallStore.getState().setCamOff(true)
  expect(useCallStore.getState().isCamOff).toBe(true)
})

test('setScreenSharePeerId sets and clears screen share', () => {
  useCallStore.getState().setScreenSharePeerId('peer-2')
  expect(useCallStore.getState().screenSharePeerId).toBe('peer-2')
  useCallStore.getState().setScreenSharePeerId(null)
  expect(useCallStore.getState().screenSharePeerId).toBeNull()
})

test('reset sets isMuted and isCamOff to false', () => {
  useCallStore.setState({ isMuted: true, isCamOff: true })
  useCallStore.getState().reset()
  expect(useCallStore.getState().isMuted).toBe(false)
  expect(useCallStore.getState().isCamOff).toBe(false)
})

test('reset does not clear userName', () => {
  useCallStore.setState({ userName: 'Ralph' })
  useCallStore.getState().reset()
  expect(useCallStore.getState().userName).toBe('Ralph')
})

test('reset does not clear localStream', () => {
  const stream = { getTracks: () => [] } as unknown as MediaStream
  useCallStore.setState({ localStream: stream })
  useCallStore.getState().reset()
  expect(useCallStore.getState().localStream).toBe(stream)
})

test('setMediaError stores error message and reset clears it', () => {
  useCallStore.getState().setMediaError('NotAllowedError')
  expect(useCallStore.getState().mediaError).toBe('NotAllowedError')
  useCallStore.getState().reset()
  expect(useCallStore.getState().mediaError).toBeNull()
})

test('isNoiseSuppressed defaults to true', () => {
  expect(useCallStore.getState().isNoiseSuppressed).toBe(true)
})

test('toggleNoiseSuppression flips isNoiseSuppressed', () => {
  useCallStore.getState().toggleNoiseSuppression()
  expect(useCallStore.getState().isNoiseSuppressed).toBe(false)
  useCallStore.getState().toggleNoiseSuppression()
  expect(useCallStore.getState().isNoiseSuppressed).toBe(true)
})

test('reset restores isNoiseSuppressed to true', () => {
  useCallStore.getState().toggleNoiseSuppression() // set to false
  useCallStore.getState().reset()
  expect(useCallStore.getState().isNoiseSuppressed).toBe(true)
})

test('isHost defaults to false', () => {
  expect(useCallStore.getState().isHost).toBe(false)
})

test('setIsHost(true) sets isHost to true', () => {
  useCallStore.getState().setIsHost(true)
  expect(useCallStore.getState().isHost).toBe(true)
})

test('setIsHost(false) clears isHost', () => {
  useCallStore.setState({ isHost: true })
  useCallStore.getState().setIsHost(false)
  expect(useCallStore.getState().isHost).toBe(false)
})

test('reset does not clear isHost', () => {
  useCallStore.setState({ isHost: true })
  useCallStore.getState().reset()
  expect(useCallStore.getState().isHost).toBe(true)
})

test('setSocketId stores the socket ID', () => {
  useCallStore.getState().setSocketId('socket-abc')
  expect(useCallStore.getState().socketId).toBe('socket-abc')
})

test('reset clears socketId', () => {
  useCallStore.setState({ socketId: 'socket-abc' })
  useCallStore.getState().reset()
  expect(useCallStore.getState().socketId).toBeNull()
})
