import { useCallStore } from '../../../../src/v2/store/useCallStore'

beforeEach(() => {
  useCallStore.setState({
    localStream: null,
    isMuted: false,
    isCamOff: false,
    userName: '',
    screenSharePeerId: null,
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
