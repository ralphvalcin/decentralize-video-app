import { create } from 'zustand'

interface CallStore {
  localStream: MediaStream | null
  isMuted: boolean
  isCamOff: boolean
  isNoiseSuppressed: boolean
  userName: string
  screenSharePeerId: string | null
  mediaError: string | null
  setLocalStream: (stream: MediaStream | null) => void
  setMuted: (value: boolean) => void
  setCamOff: (value: boolean) => void
  toggleNoiseSuppression: () => void
  setUserName: (name: string) => void
  setScreenSharePeerId: (id: string | null) => void
  setMediaError: (err: string | null) => void
  reset: () => void
}

export const useCallStore = create<CallStore>((set) => ({
  localStream: null,
  isMuted: false,
  isCamOff: false,
  isNoiseSuppressed: true,
  userName: '',
  screenSharePeerId: null,
  mediaError: null,
  setLocalStream: (stream) => set({ localStream: stream }),
  setMuted: (value) => set({ isMuted: value }),
  setCamOff: (value) => set({ isCamOff: value }),
  toggleNoiseSuppression: () => set((s) => ({ isNoiseSuppressed: !s.isNoiseSuppressed })),
  setUserName: (name) => set({ userName: name }),
  setScreenSharePeerId: (id) => set({ screenSharePeerId: id }),
  setMediaError: (err) => set({ mediaError: err }),
  reset: () => set({ isMuted: false, isCamOff: false, mediaError: null, isNoiseSuppressed: true }),
}))
