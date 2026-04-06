import { useCallStore } from '../../../../src/v2/store/useCallStore'

beforeEach(() => {
  useCallStore.setState({
    localStream: null,
    isMuted: false,
    isCamOff: false,
    roomId: '',
    userName: '',
    screenSharePeerId: null,
  })
})

test('initial state is empty', () => {
  const state = useCallStore.getState()
  expect(state.localStream).toBeNull()
  expect(state.isMuted).toBe(false)
  expect(state.isCamOff).toBe(false)
  expect(state.roomId).toBe('')
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

test('setRoomId stores the room id', () => {
  useCallStore.getState().setRoomId('design-sync')
  expect(useCallStore.getState().roomId).toBe('design-sync')
})

test('setScreenSharePeerId sets and clears screen share', () => {
  useCallStore.getState().setScreenSharePeerId('peer-2')
  expect(useCallStore.getState().screenSharePeerId).toBe('peer-2')
  useCallStore.getState().setScreenSharePeerId(null)
  expect(useCallStore.getState().screenSharePeerId).toBeNull()
})
