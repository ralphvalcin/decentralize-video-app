import { create } from 'zustand'
import type { Toast } from '../types'

interface UIStore {
  isChatOpen: boolean
  isParticipantsOpen: boolean
  activeModal: string | null
  toasts: Toast[]
  layout: 'spotlight' | 'grid'
  toggleChat: () => void
  toggleParticipants: () => void
  setActiveModal: (modal: string | null) => void
  addToast: (toast: Toast) => void
  removeToast: (id: string) => void
  setLayout: (layout: 'spotlight' | 'grid') => void
}

export const useUIStore = create<UIStore>((set, get) => ({
  isChatOpen: false,
  isParticipantsOpen: false,
  activeModal: null,
  toasts: [],
  layout: 'spotlight',

  // Panels are mutually exclusive: opening either one always closes the other.
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen, isParticipantsOpen: false })),
  toggleParticipants: () => set((s) => ({ isParticipantsOpen: !s.isParticipantsOpen, isChatOpen: false })),

  setActiveModal: (modal) => set({ activeModal: modal }),
  addToast: (toast) => set((s) => ({ toasts: [...s.toasts, toast] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setLayout: (layout) => set({ layout }),
}))
