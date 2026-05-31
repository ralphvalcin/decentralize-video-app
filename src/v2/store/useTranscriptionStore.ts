import { create } from 'zustand'
import type { TranscriptSegment } from '../types'

const MAX_SEGMENTS = 200

interface TranscriptionStore {
  isEnabled: boolean
  isLoading: boolean
  segments: TranscriptSegment[]
  enable: () => void
  disable: () => void
  setLoading: (value: boolean) => void
  addSegment: (segment: TranscriptSegment) => void
  clear: () => void
}

export const useTranscriptionStore = create<TranscriptionStore>((set) => ({
  isEnabled: false,
  isLoading: false,
  segments: [],
  enable: () => set({ isEnabled: true }),
  disable: () => set({ isEnabled: false }),
  setLoading: (value) => set({ isLoading: value }),
  addSegment: (segment) => set((s) => {
    const next = [...s.segments, segment]
    return { segments: next.length > MAX_SEGMENTS ? next.slice(-MAX_SEGMENTS) : next }
  }),
  clear: () => set({ segments: [] }),
}))
