import { create } from 'zustand'
import type { ChatMessage, Poll, Question } from '../types'

interface SessionStore {
  messages: ChatMessage[]
  pinnedMessage: ChatMessage | null
  activePoll: Poll | null
  pollResponses: Record<string, string>
  recordingState: 'idle' | 'recording' | 'paused'
  recordingConsentPeers: string[]
  questions: Question[]
  addMessage: (msg: ChatMessage) => void
  pinMessage: (msg: ChatMessage) => void
  unpinMessage: () => void
  setActivePoll: (poll: Poll | null) => void
  recordPollResponse: (peerId: string, choiceId: string) => void
  setRecordingState: (state: 'idle' | 'recording' | 'paused') => void
  addRecordingConsent: (peerId: string) => void
  addQuestion: (q: Question) => void
  updateQuestion: (q: Question) => void
  setQuestionsHistory: (qs: Question[]) => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  messages: [],
  pinnedMessage: null,
  activePoll: null,
  pollResponses: {},
  recordingState: 'idle',
  recordingConsentPeers: [],
  questions: [],

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  pinMessage: (msg) => set({ pinnedMessage: msg }),
  unpinMessage: () => set({ pinnedMessage: null }),
  setActivePoll: (poll) => set({ activePoll: poll, pollResponses: {} }),
  recordPollResponse: (peerId, choiceId) =>
    set((s) => ({ pollResponses: { ...s.pollResponses, [peerId]: choiceId } })),
  setRecordingState: (state) => set({ recordingState: state }),
  addRecordingConsent: (peerId) => {
    if (!get().recordingConsentPeers.includes(peerId)) {
      set((s) => ({ recordingConsentPeers: [...s.recordingConsentPeers, peerId] }))
    }
  },
  addQuestion: (q) => set((s) => ({ questions: [...s.questions, q] })),
  updateQuestion: (q) => set((s) => {
    const idx = s.questions.findIndex((x) => x.id === q.id)
    if (idx === -1) return { questions: [...s.questions, q] }
    const next = [...s.questions]
    next[idx] = q
    return { questions: next }
  }),
  setQuestionsHistory: (qs) => set({ questions: qs }),
}))
