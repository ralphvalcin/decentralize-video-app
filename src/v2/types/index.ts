// src/v2/types/index.ts

export interface Reaction {
  emoji: string      // e.g. "👍", "❤️", "😂"
  sentAt: number     // Unix ms — auto-cleared after 3000ms by PeerManager
}

export interface ChatMessage {
  id: string
  peerId: string
  peerName: string
  text: string
  sentAt: number
}

export interface Poll {
  id: string
  question: string
  options: string[]   // e.g. ["Yes", "No", "Maybe"]
  createdAt: number
  createdBy: string
  isActive: boolean
  votes: Record<string, number>   // socketId → optionIndex
}

export interface Question {
  id: string
  text: string
  author: string
  authorId: string
  timestamp: number
  votes: number
  votedBy: string[]
  answer: string | null
  answeredBy: string | null
  answeredAt: number | null
  isAnswered: boolean
}

export interface Toast {
  id: string
  message: string
  variant: 'info' | 'warn' | 'danger'
}

export interface PeerRecord {
  // identity
  id: string
  name: string
  role: 'host' | 'guest'

  // media
  stream: MediaStream | null
  isMuted: boolean
  isCamOff: boolean
  videoEnabled: boolean       // stream exists but video track may be ended
  isScreenSharing: boolean

  // connection
  connectionState: RTCPeerConnectionState
  networkQuality: 'good' | 'fair' | 'poor'

  // interactions (broadcast except isPinned)
  isSpeaking: boolean         // local: Web Audio API then broadcast. remote: received cache.
  isPinned: boolean           // LOCAL ONLY — never emit over Socket.io
  hasRaisedHand: boolean
  handRaisedAt: number | null // enables ordered speaker queue
  reaction: Reaction | null   // auto-cleared after 3000ms
  isAway: boolean             // Page Visibility API
  isTyping: boolean           // typing indicator in chat
}
