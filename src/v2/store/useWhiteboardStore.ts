import { create } from 'zustand'
import type { Stroke } from '../types'

interface WhiteboardStore {
  strokes: Stroke[]
  grantedPeerIds: Set<string>
  currentTool: 'pen' | 'eraser'
  currentColor: string
  addStroke: (stroke: Stroke) => void
  clearStrokes: () => void
  grantDrawing: (peerId: string) => void
  revokeDrawing: (peerId: string) => void
  setTool: (tool: 'pen' | 'eraser') => void
  setColor: (color: string) => void
}

export const useWhiteboardStore = create<WhiteboardStore>((set) => ({
  strokes: [],
  grantedPeerIds: new Set(),
  currentTool: 'pen',
  currentColor: '#222222',

  addStroke: (stroke) => set((s) => ({ strokes: [...s.strokes, stroke] })),
  clearStrokes: () => set({ strokes: [] }),
  grantDrawing: (peerId) =>
    set((s) => ({ grantedPeerIds: new Set([...s.grantedPeerIds, peerId]) })),
  revokeDrawing: (peerId) =>
    set((s) => {
      const next = new Set(s.grantedPeerIds)
      next.delete(peerId)
      return { grantedPeerIds: next }
    }),
  setTool: (tool) => set({ currentTool: tool }),
  setColor: (color) => set({ currentColor: color }),
}))
