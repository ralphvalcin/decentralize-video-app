import { create } from 'zustand'

interface CallStore {
  localStream: MediaStream | null
  isMuted: boolean
  isCamOff: boolean
  roomId: string
  userName: string
  screenSharePeerId: string | null
  setLocalStream: (stream: MediaStream | null) => void
  setMuted: (value: boolean) => void
  setCamOff: (value: boolean) => void
  setRoomId: (id: string) => void
  setUserName: (name: string) => void
  setScreenSharePeerId: (id: string | null) => void
}

export const useCallStore = create<CallStore>((set) => ({
  localStream: null,
  isMuted: false,
  isCamOff: false,
  roomId: '',
  userName: '',
  screenSharePeerId: null,
  setLocalStream: (stream) => set({ localStream: stream }),
  setMuted: (value) => set({ isMuted: value }),
  setCamOff: (value) => set({ isCamOff: value }),
  setRoomId: (id) => set({ roomId: id }),
  setUserName: (name) => set({ userName: name }),
  setScreenSharePeerId: (id) => set({ screenSharePeerId: id }),
}))
