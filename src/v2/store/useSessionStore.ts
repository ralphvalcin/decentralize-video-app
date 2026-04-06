import { create } from 'zustand'
import type { ChatMessage, Poll } from '../types'

interface SessionStore {
  messages: ChatMessage[]
  pinnedMessage: ChatMessage | null
  activePoll: Poll | null
  pollResponses: Record<string, string>
  recordingState: 'idle' | 'recording' | 'paused'
  recordingConsentPeers: string[]
  addMessage: (msg: ChatMessage) => void
  pinMessage: (msg: ChatMessage) => void
  unpinMessage: () => void
  setActivePoll: (poll: Poll | null) => void
  recordPollResponse: (peerId: string, choiceId: string) => void
  setRecordingState: (state: 'idle' | 'recording' | 'paused') => void
  addRecordingConsent: (peerId: string) => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  messages: [],
  pinnedMessage: null,
  activePoll: null,
  pollResponses: {},
  recordingState: 'idle',
  recordingConsentPeers: [],

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
}))
