import { useUIStore } from '../../../../src/v2/store/useUIStore'
import { useTranscriptionStore } from '../../../../src/v2/store/useTranscriptionStore'
import type { Toast } from '../../../../src/v2/types'

beforeEach(() => {
  useUIStore.setState({
    isChatOpen: false,
    isParticipantsOpen: false,
    isQAOpen: false,
    isAIOpen: false,
    isCaptionsOpen: false,
    activeModal: null,
    toasts: [],
    layout: 'spotlight',
  })
  useTranscriptionStore.setState({ isEnabled: false, isLoading: false, segments: [] })
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

test('toggleQA flips isQAOpen', () => {
  useUIStore.getState().toggleQA()
  expect(useUIStore.getState().isQAOpen).toBe(true)
  useUIStore.getState().toggleQA()
  expect(useUIStore.getState().isQAOpen).toBe(false)
})

test('opening QA closes chat and participants', () => {
  useUIStore.setState({ isChatOpen: true, isParticipantsOpen: true })
  useUIStore.getState().toggleQA()
  expect(useUIStore.getState().isQAOpen).toBe(true)
  expect(useUIStore.getState().isChatOpen).toBe(false)
  expect(useUIStore.getState().isParticipantsOpen).toBe(false)
})

test('opening chat closes QA', () => {
  useUIStore.setState({ isQAOpen: true })
  useUIStore.getState().toggleChat()
  expect(useUIStore.getState().isChatOpen).toBe(true)
  expect(useUIStore.getState().isQAOpen).toBe(false)
})

test('opening participants closes QA', () => {
  useUIStore.setState({ isQAOpen: true })
  useUIStore.getState().toggleParticipants()
  expect(useUIStore.getState().isParticipantsOpen).toBe(true)
  expect(useUIStore.getState().isQAOpen).toBe(false)
})

test('toggleAI flips isAIOpen', () => {
  useUIStore.getState().toggleAI()
  expect(useUIStore.getState().isAIOpen).toBe(true)
  useUIStore.getState().toggleAI()
  expect(useUIStore.getState().isAIOpen).toBe(false)
})

test('opening AI closes chat, participants, and QA', () => {
  useUIStore.setState({ isChatOpen: true, isParticipantsOpen: true, isQAOpen: true })
  useUIStore.getState().toggleAI()
  expect(useUIStore.getState().isAIOpen).toBe(true)
  expect(useUIStore.getState().isChatOpen).toBe(false)
  expect(useUIStore.getState().isParticipantsOpen).toBe(false)
  expect(useUIStore.getState().isQAOpen).toBe(false)
})

test('opening chat closes AI', () => {
  useUIStore.setState({ isAIOpen: true })
  useUIStore.getState().toggleChat()
  expect(useUIStore.getState().isChatOpen).toBe(true)
  expect(useUIStore.getState().isAIOpen).toBe(false)
})

test('opening participants closes AI', () => {
  useUIStore.setState({ isAIOpen: true })
  useUIStore.getState().toggleParticipants()
  expect(useUIStore.getState().isParticipantsOpen).toBe(true)
  expect(useUIStore.getState().isAIOpen).toBe(false)
})

test('opening QA closes AI', () => {
  useUIStore.setState({ isAIOpen: true })
  useUIStore.getState().toggleQA()
  expect(useUIStore.getState().isQAOpen).toBe(true)
  expect(useUIStore.getState().isAIOpen).toBe(false)
})

test('toggleCaptions flips isCaptionsOpen', () => {
  useUIStore.getState().toggleCaptions()
  expect(useUIStore.getState().isCaptionsOpen).toBe(true)
  useUIStore.getState().toggleCaptions()
  expect(useUIStore.getState().isCaptionsOpen).toBe(false)
})

test('toggleCaptions enables transcription store when opening', () => {
  useUIStore.getState().toggleCaptions()
  expect(useTranscriptionStore.getState().isEnabled).toBe(true)
})

test('toggleCaptions disables transcription store when closing', () => {
  useUIStore.setState({ isCaptionsOpen: true })
  useTranscriptionStore.setState({ isEnabled: true })
  useUIStore.getState().toggleCaptions()
  expect(useTranscriptionStore.getState().isEnabled).toBe(false)
})
