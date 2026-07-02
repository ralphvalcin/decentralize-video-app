import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import Peer from 'simple-peer'
import { io, Socket } from 'socket.io-client'
import { useCallStore } from '../store/useCallStore'
import { usePeerStore } from '../store/usePeerStore'
import { useSessionStore } from '../store/useSessionStore'
import { useUIStore } from '../store/useUIStore'
import { useWhiteboardStore } from '../store/useWhiteboardStore'
import type { PeerRecord, Poll, Question, Stroke } from '../types'
import { deriveKey, encryptMessage, decryptMessage } from '../lib/chatCrypto'

// process.env is replaced at build time by vite.config.ts define; also works in Jest
const SIGNALING_URL = process.env.VITE_SIGNALING_SERVER_URL || 'wss://decentralize-video-app-2.onrender.com'

export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export interface PeerManagerHandle {
  sendMessage: (text: string) => void
  sendReaction: (emoji: string) => void
  votePoll: (pollId: string, optionIndex: number) => void
  raiseHand: () => void
  lowerHand: () => void
  submitQuestion: (text: string) => void
  voteQuestion: (questionId: string) => void
  answerQuestion: (questionId: string, answer: string) => void
  getPeerConnections: () => Map<string, RTCPeerConnection>
  broadcastRecordingStarted: () => void
  broadcastRecordingStopped: () => void
  broadcastWhiteboardStroke: (stroke: Stroke) => void
  broadcastWhiteboardClear: () => void
  broadcastWhiteboardGrant: (peerId: string) => void
  broadcastWhiteboardRevoke: (peerId: string) => void
}

interface PeerManagerProps {
  roomId: string
}

export function makePeerRecord(id: string, name: string, role: 'host' | 'guest'): PeerRecord {
  return {
    id, name, role,
    stream: null, isMuted: false, isCamOff: false, videoEnabled: false, isScreenSharing: false,
    connectionState: 'connecting', networkQuality: 'good',
    isSpeaking: false, isPinned: false,
    hasRaisedHand: false, handRaisedAt: null,
    reaction: null, isAway: false, isTyping: false,
  }
}

export const PeerManager = forwardRef<PeerManagerHandle, PeerManagerProps>(({ roomId }, ref) => {
  const socketRef = useRef<Socket | null>(null)
  const peerConnsRef = useRef<Map<string, { peer: InstanceType<typeof Peer>; name: string; role: 'host' | 'guest' }>>(new Map())
  const reactionTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const iceServersRef = useRef<RTCIceServer[]>(ICE_SERVERS)
  const cryptoKeyRef = useRef<CryptoKey | null>(null)
  const userName = useCallStore((s) => s.userName)
  const localStream = useCallStore((s) => s.localStream)
  const setPeer = usePeerStore((s) => s.setPeer)
  const removePeer = usePeerStore((s) => s.removePeer)
  const patchPeer = usePeerStore((s) => s.patchPeer)
  const addMessage = useSessionStore((s) => s.addMessage)
  const setActivePoll = useSessionStore((s) => s.setActivePoll)
  const addQuestion = useSessionStore((s) => s.addQuestion)
  const updateQuestion = useSessionStore((s) => s.updateQuestion)
  const setQuestionsHistory = useSessionStore((s) => s.setQuestionsHistory)
  const setIsHost = useCallStore((s) => s.setIsHost)
  const setSocketId = useCallStore((s) => s.setSocketId)
  const setRecordingState = useSessionStore((s) => s.setRecordingState)
  const addToast = useUIStore((s) => s.addToast)

  useImperativeHandle(ref, () => ({
    sendMessage: (text) => {
      const key = cryptoKeyRef.current
      if (!socketRef.current || !key) return
      encryptMessage(text, key)
        .then((ciphertext) => {
          socketRef.current?.emit('send-message', { text: ciphertext, timestamp: Date.now() })
        })
        .catch((err) => {
          console.error('[PeerManager] failed to encrypt message:', err)
        })
    },
    sendReaction: (emoji) => {
      socketRef.current?.emit('send-reaction', { emoji })
    },
    votePoll: (pollId, optionIndex) => {
      socketRef.current?.emit('vote-poll', { pollId, optionIndex })
    },
    raiseHand: () => {
      socketRef.current?.emit('raise-hand')
    },
    lowerHand: () => {
      socketRef.current?.emit('lower-hand')
    },
    submitQuestion: (text) => {
      socketRef.current?.emit('submit-question', { text })
    },
    voteQuestion: (questionId) => {
      socketRef.current?.emit('vote-question', { questionId })
    },
    answerQuestion: (questionId, answer) => {
      socketRef.current?.emit('answer-question', { questionId, answer })
    },
    getPeerConnections: () => {
      const result = new Map<string, RTCPeerConnection>()
      peerConnsRef.current.forEach((conn, id) => {
        const rtc = (conn.peer as unknown as { _pc: RTCPeerConnection | null })._pc
        if (rtc) result.set(id, rtc)
      })
      return result
    },
    broadcastRecordingStarted: () => {
      if (!socketRef.current?.connected) return
      socketRef.current.emit('recording-started')
    },
    broadcastRecordingStopped: () => {
      if (!socketRef.current?.connected) return
      socketRef.current.emit('recording-stopped')
    },
    broadcastWhiteboardStroke: (stroke) => {
      if (!socketRef.current?.connected) return
      socketRef.current.emit('whiteboard-stroke', stroke)
    },
    broadcastWhiteboardClear: () => {
      if (!socketRef.current?.connected) return
      socketRef.current.emit('whiteboard-clear')
    },
    broadcastWhiteboardGrant: (peerId) => {
      if (!socketRef.current?.connected) return
      socketRef.current.emit('whiteboard-grant', { peerId })
    },
    broadcastWhiteboardRevoke: (peerId) => {
      if (!socketRef.current?.connected) return
      socketRef.current.emit('whiteboard-revoke', { peerId })
    },
  }), [])

  // If localStream arrives after peers are already connected (race: signaling faster than getUserMedia),
  // add tracks to each live connection so the remote side receives our media.
  useEffect(() => {
    if (!localStream) return
    peerConnsRef.current.forEach(({ peer }) => {
      localStream.getTracks().forEach((track) => {
        try { peer.addTrack(track, localStream) } catch (_) {}
      })
    })
  }, [localStream])

  useEffect(() => {
    if (!roomId || !userName) return

    function destroyPeerConn(id: string) {
      const conn = peerConnsRef.current.get(id)
      if (conn && !conn.peer.destroyed) conn.peer.destroy()
      peerConnsRef.current.delete(id)
    }

    function wirePeerEvents(peer: InstanceType<typeof Peer>, peerId: string) {
      peer.on('stream', (remoteStream: MediaStream) => {
        patchPeer(peerId, { stream: remoteStream, connectionState: 'connected', videoEnabled: true })
      })
      peer.on('close', () => {
        patchPeer(peerId, { connectionState: 'disconnected', stream: null })
        destroyPeerConn(peerId)
      })
      peer.on('error', (err: Error) => {
        console.error('[PeerManager] peer error:', peerId, err?.message)
        patchPeer(peerId, { connectionState: 'failed', stream: null })
        destroyPeerConn(peerId)
      })
    }

    const secret = process.env.VITE_CHAT_ENCRYPTION_SECRET ?? ''
    deriveKey(roomId, secret)
      .then((key) => {
        cryptoKeyRef.current = key
      })
      .catch((err) => {
        console.error('[PeerManager] Failed to derive encryption key:', err)
      })

    const socket = io(SIGNALING_URL, { reconnectionAttempts: 5 })
    socketRef.current = socket

    socket.on('connect', () => {
      setSocketId(socket.id ?? null)
      socket.emit('request-room-token', { roomId, userName })
    })

    // Use on (not once) so reconnects re-join correctly
    socket.on('room-token', ({ token }: { token: string }) => {
      socket.emit('join-room', { roomId, token, name: userName, role: 'guest' })

      // Request TURN credentials right after joining; update ref when they arrive.
      // iceServersRef starts as ICE_SERVERS so peer creation never blocks.
      // Off before re-registering: prevents stale listeners from prior cycles on reconnect.
      socket.off('turn-credentials')
      socket.off('turn-credentials-error')
      socket.emit('request-turn-credentials')
      socket.once('turn-credentials', (config: { servers: RTCIceServer[] }) => {
        if (Array.isArray(config?.servers) && config.servers.length > 0) {
          iceServersRef.current = config.servers
        }
      })
      socket.once('turn-credentials-error', (err: { code: string }) => {
        console.warn('[PeerManager] TURN credential error:', err?.code, '— using STUN fallback')
      })
    })

    socket.on('all-users', (users: Array<{ id: string; name: string; role?: string }>) => {
      users.forEach((u) => {
        const role = (u.role as 'host' | 'guest') ?? 'guest'
        // On reconnect the server re-sends all-users; destroy any stale connection first
        // so we don't orphan a Peer with open data channels and listeners.
        if (peerConnsRef.current.has(u.id)) destroyPeerConn(u.id)
        setPeer(u.id, makePeerRecord(u.id, u.name, role))
        const stream = useCallStore.getState().localStream
        const peer = new Peer({
          initiator: true,
          trickle: false,
          stream: stream ?? undefined,
          config: { iceServers: iceServersRef.current },
        })
        wirePeerEvents(peer, u.id)
        peer.on('signal', (signal) => {
          socket.emit('sending-signal', { userToSignal: u.id, callerID: socket.id, signal })
        })
        peerConnsRef.current.set(u.id, { peer, name: u.name, role })
      })
    })

    socket.on('user-joined', ({ signal, callerID, name, role }: { signal: unknown; callerID: string; name: string; role?: string }) => {
      const peerRole = (role as 'host' | 'guest') ?? 'guest'
      setPeer(callerID, makePeerRecord(callerID, name, peerRole))
      if (!signal) return   // no signal = peer record only, no WebRTC yet
      const stream = useCallStore.getState().localStream
      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: stream ?? undefined,
        config: { iceServers: iceServersRef.current },
      })
      wirePeerEvents(peer, callerID)
      peer.on('signal', (returnSignal) => {
        socket.emit('returning-signal', { signal: returnSignal, callerID })
      })
      peer.signal(signal as any)
      peerConnsRef.current.set(callerID, { peer, name, role: peerRole })
    })

    socket.on('receiving-returned-signal', ({ signal, id }: { signal: unknown; id: string }) => {
      const conn = peerConnsRef.current.get(id)
      if (conn && !conn.peer.destroyed) conn.peer.signal(signal as any)
    })

    socket.on('user-left', (socketId: string) => {
      removePeer(socketId)
      destroyPeerConn(socketId)
      useWhiteboardStore.getState().revokeDrawing(socketId)
    })

    socket.on('chat-history', async (messages: Array<{ id: string; sender: string; senderName?: string; text: string; timestamp: number }>) => {
      const key = cryptoKeyRef.current
      for (const m of messages) {
        const text = key
          ? await decryptMessage(m.text, key).catch(() => '[encrypted message]')
          : m.text
        addMessage({ id: m.id, peerId: m.sender, peerName: m.senderName ?? m.sender, text, sentAt: m.timestamp })
      }
    })

    socket.on('new-message', async (m: { id: string; sender: string; senderName?: string; text: string; timestamp: number }) => {
      const key = cryptoKeyRef.current
      const text = key
        ? await decryptMessage(m.text, key).catch(() => '[encrypted message]')
        : m.text
      addMessage({ id: m.id, peerId: m.sender, peerName: m.senderName ?? m.sender, text, sentAt: m.timestamp })
    })

    socket.on('new-poll', (poll: Poll) => {
      setActivePoll(poll)
    })

    socket.on('poll-ended', () => {
      setActivePoll(null)
    })

    socket.on('poll-updated', (poll: Poll) => {
      setActivePoll(poll)
    })

    socket.on('polls-history', (polls: Poll[]) => {
      const active = polls.findLast((p) => p.isActive) ?? null
      setActivePoll(active)
    })

    socket.on('hand-raised', ({ userId, timestamp }: { userId: string; userName: string; timestamp: number }) => {
      if (userId === socket.id) {
        useCallStore.getState().setHandRaised(true)
      } else {
        patchPeer(userId, { hasRaisedHand: true, handRaisedAt: timestamp })
      }
    })

    socket.on('hand-lowered', ({ userId }: { userId: string }) => {
      if (userId === socket.id) {
        useCallStore.getState().setHandRaised(false)
      } else {
        patchPeer(userId, { hasRaisedHand: false, handRaisedAt: null })
      }
    })

    socket.on('new-question', (q: Question) => {
      addQuestion(q)
    })

    socket.on('question-updated', (q: Question) => {
      updateQuestion(q)
    })

    socket.on('questions-history', (qs: Question[]) => {
      setQuestionsHistory(qs)
    })

    socket.on('new-reaction', ({ peerId, emoji }: { peerId: string; emoji: string }) => {
      const existing = reactionTimersRef.current.get(peerId)
      if (existing) clearTimeout(existing)
      patchPeer(peerId, { reaction: { emoji, sentAt: Date.now() } })
      const timer = setTimeout(() => {
        patchPeer(peerId, { reaction: null })
        reactionTimersRef.current.delete(peerId)
      }, 3000)
      reactionTimersRef.current.set(peerId, timer)
    })

    socket.on('error', (err: { message: string; code: string }) => {
      console.error('[PeerManager] server error:', err)
    })

    socket.on('you-are-host', () => {
      setIsHost(true)
    })

    socket.on('recording-started', () => {
      setRecordingState('recording')
      addToast({ id: `rec-start-${Date.now()}`, message: 'Recording has started', variant: 'info' })
    })

    socket.on('recording-stopped', () => {
      setRecordingState('idle')
      addToast({ id: `rec-stop-${Date.now()}`, message: 'Recording ended', variant: 'info' })
    })

    socket.on('whiteboard-stroke', (stroke: Stroke) => {
      useWhiteboardStore.getState().addStroke(stroke)
    })

    socket.on('whiteboard-clear', () => {
      useWhiteboardStore.getState().clearStrokes()
    })

    socket.on('whiteboard-grant', ({ peerId }: { peerId: string }) => {
      useWhiteboardStore.getState().grantDrawing(peerId)
    })

    socket.on('whiteboard-revoke', ({ peerId }: { peerId: string }) => {
      useWhiteboardStore.getState().revokeDrawing(peerId)
    })

    return () => {
      cryptoKeyRef.current = null
      socketRef.current?.off('connect')
      socketRef.current?.off('room-token')
      socketRef.current?.off('all-users')
      socketRef.current?.off('user-joined')
      socketRef.current?.off('receiving-returned-signal')
      socketRef.current?.off('user-left')
      socketRef.current?.off('chat-history')
      socketRef.current?.off('new-message')
      socketRef.current?.off('new-poll')
      socketRef.current?.off('poll-ended')
      socketRef.current?.off('poll-updated')
      socketRef.current?.off('polls-history')
      socketRef.current?.off('new-question')
      socketRef.current?.off('question-updated')
      socketRef.current?.off('questions-history')
      socketRef.current?.off('new-reaction')
      socketRef.current?.off('error')
      socketRef.current?.off('turn-credentials')
      socketRef.current?.off('turn-credentials-error')
      socketRef.current?.off('you-are-host')
      socketRef.current?.off('recording-started')
      socketRef.current?.off('recording-stopped')
      socketRef.current?.off('whiteboard-stroke')
      socketRef.current?.off('whiteboard-clear')
      socketRef.current?.off('whiteboard-grant')
      socketRef.current?.off('whiteboard-revoke')
      setSocketId(null)
      // If recording was active when this peer leaves, notify others
      if (useSessionStore.getState().recordingState === 'recording' && socketRef.current?.connected) {
        socketRef.current.emit('recording-stopped')
      }
      socketRef.current?.emit('user-leaving')
      socketRef.current?.disconnect()
      peerConnsRef.current.forEach((_, id) => destroyPeerConn(id))
      peerConnsRef.current.clear()
      socketRef.current = null
      reactionTimersRef.current.forEach(clearTimeout)
      reactionTimersRef.current.clear()
    }
  }, [roomId, userName, setPeer, removePeer, patchPeer, addMessage, setActivePoll, addQuestion, updateQuestion, setQuestionsHistory, setIsHost, setSocketId, setRecordingState, addToast])

  return null
})

PeerManager.displayName = 'PeerManager'
