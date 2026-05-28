import { create } from 'zustand'
import type { Toast } from '../types'

interface UIStore {
  isChatOpen: boolean
  isParticipantsOpen: boolean
  isQAOpen: boolean
  activeModal: string | null
  toasts: Toast[]
  layout: 'spotlight' | 'grid'
  toggleChat: () => void
  toggleParticipants: () => void
  toggleQA: () => void
  setActiveModal: (modal: string | null) => void
  addToast: (toast: Toast) => void
  removeToast: (id: string) => void
  setLayout: (layout: 'spotlight' | 'grid') => void
}

export const useUIStore = create<UIStore>((set) => ({
  isChatOpen: false,
  isParticipantsOpen: false,
  isQAOpen: false,
  activeModal: null,
  toasts: [],
  layout: 'spotlight',

  // Panels are mutually exclusive: opening any one closes the other two.
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen, isParticipantsOpen: false, isQAOpen: false })),
  toggleParticipants: () => set((s) => ({ isParticipantsOpen: !s.isParticipantsOpen, isChatOpen: false, isQAOpen: false })),
  toggleQA: () => set((s) => ({ isQAOpen: !s.isQAOpen, isChatOpen: false, isParticipantsOpen: false })),

  setActiveModal: (modal) => set({ activeModal: modal }),
  addToast: (toast) => set((s) => ({ toasts: [...s.toasts, toast] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setLayout: (layout) => set({ layout }),
}))
