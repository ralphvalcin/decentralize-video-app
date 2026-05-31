import { create } from 'zustand'
import { useWhiteboardStore } from './useWhiteboardStore'

interface CallStore {
  localStream: MediaStream | null
  isMuted: boolean
  isCamOff: boolean
  isNoiseSuppressed: boolean
  isHost: boolean
  userName: string
  socketId: string | null
  screenSharePeerId: string | null
  mediaError: string | null
  setLocalStream: (stream: MediaStream | null) => void
  setMuted: (value: boolean) => void
  setCamOff: (value: boolean) => void
  toggleNoiseSuppression: () => void
  setIsHost: (value: boolean) => void
  setUserName: (name: string) => void
  setSocketId: (id: string | null) => void
  setScreenSharePeerId: (id: string | null) => void
  setMediaError: (err: string | null) => void
  reset: () => void
}

export const useCallStore = create<CallStore>((set) => ({
  localStream: null,
  isMuted: false,
  isCamOff: false,
  isNoiseSuppressed: true,
  isHost: false,
  userName: '',
  socketId: null,
  screenSharePeerId: null,
  mediaError: null,
  setLocalStream: (stream) => set({ localStream: stream }),
  setMuted: (value) => set({ isMuted: value }),
  setCamOff: (value) => set({ isCamOff: value }),
  toggleNoiseSuppression: () => set((s) => ({ isNoiseSuppressed: !s.isNoiseSuppressed })),
  setIsHost: (value) => set({ isHost: value }),
  setUserName: (name) => set({ userName: name }),
  setSocketId: (id) => set({ socketId: id }),
  setScreenSharePeerId: (id) => set({ screenSharePeerId: id }),
  setMediaError: (err) => set({ mediaError: err }),
  reset: () => {
    useWhiteboardStore.getState().reset()
    set({ isMuted: false, isCamOff: false, mediaError: null, isNoiseSuppressed: true, socketId: null })
  },
}))
