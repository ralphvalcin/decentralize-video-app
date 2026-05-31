import { create } from 'zustand'
import type { PeerRecord } from '../types'

interface PeerStore {
  peers: Map<string, PeerRecord>
  setPeer: (id: string, record: PeerRecord) => void
  patchPeer: (id: string, partial: Partial<PeerRecord>) => void
  removePeer: (id: string) => void
}

export const usePeerStore = create<PeerStore>((set, get) => ({
  peers: new Map(),

  setPeer: (id, record) => {
    const peers = new Map(get().peers)
    peers.set(id, { ...record, id })
    set({ peers })
  },

  patchPeer: (id, partial) => {
    const peers = new Map(get().peers)
    const existing = peers.get(id)
    if (!existing) return
    peers.set(id, { ...existing, ...partial })
    set({ peers })
  },

  removePeer: (id) => {
    if (!get().peers.has(id)) return
    const peers = new Map(get().peers)
    peers.delete(id)
    set({ peers })
  },
}))
