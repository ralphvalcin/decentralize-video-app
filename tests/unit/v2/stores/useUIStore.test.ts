import { useUIStore } from '../../../../src/v2/store/useUIStore'
import type { Toast } from '../../../../src/v2/types'

beforeEach(() => {
  useUIStore.setState({
    isChatOpen: false,
    isParticipantsOpen: false,
    activeModal: null,
    toasts: [],
    layout: 'spotlight',
  })
})

test('toggleChat flips isChatOpen', () => {
  useUIStore.getState().toggleChat()
  expect(useUIStore.getState().isChatOpen).toBe(true)
  useUIStore.getState().toggleChat()
  expect(useUIStore.getState().isChatOpen).toBe(false)
})

test('opening participants closes chat', () => {
  useUIStore.setState({ isChatOpen: true })
  useUIStore.getState().toggleParticipants()
  expect(useUIStore.getState().isParticipantsOpen).toBe(true)
  expect(useUIStore.getState().isChatOpen).toBe(false)
})

test('opening chat closes participants', () => {
  useUIStore.setState({ isParticipantsOpen: true })
  useUIStore.getState().toggleChat()
  expect(useUIStore.getState().isChatOpen).toBe(true)
  expect(useUIStore.getState().isParticipantsOpen).toBe(false)
})


test('addToast appends and removeToast removes', () => {
  const toast: Toast = { id: 't1', message: 'Hello', variant: 'info' }
  useUIStore.getState().addToast(toast)
  expect(useUIStore.getState().toasts).toHaveLength(1)
  useUIStore.getState().removeToast('t1')
  expect(useUIStore.getState().toasts).toHaveLength(0)
})

test('setLayout updates layout', () => {
  useUIStore.getState().setLayout('grid')
  expect(useUIStore.getState().layout).toBe('grid')
})

test('setActiveModal sets and clears modal', () => {
  useUIStore.getState().setActiveModal('settings')
  expect(useUIStore.getState().activeModal).toBe('settings')
  useUIStore.getState().setActiveModal(null)
  expect(useUIStore.getState().activeModal).toBeNull()
})
