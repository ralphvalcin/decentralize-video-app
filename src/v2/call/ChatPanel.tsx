import { useRef, useState } from 'react'
import { useSessionStore } from '../store/useSessionStore'
import { usePeerStore } from '../store/usePeerStore'
import type { ChatMessage } from '../types'

interface ChatPanelProps {
  onSendMessage: (text: string) => void
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ChatPanel({ onSendMessage }: ChatPanelProps) {
  const messages = useSessionStore((s) => s.messages)
  const pinnedMessage = useSessionStore((s) => s.pinnedMessage)
  const peers = usePeerStore((s) => s.peers)
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const typingPeers = Array.from(peers.values()).filter((p) => p.isTyping)

  function handleSend() {
    const text = input.trim()
    if (!text) return
    onSendMessage(text)
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div data-testid="chat-panel" className="w-[280px] shrink-0 border-l border-[var(--border-subtle)] flex flex-col bg-[var(--surface-base)]">
      {pinnedMessage && (
        <div data-testid="pinned-message" className="px-4 py-2 bg-[var(--surface-raised)] border-b border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
          📌 {pinnedMessage.text}
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-0">
        {messages.map((msg: ChatMessage) => (
          <div key={msg.id} className="flex flex-col gap-0.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[var(--text-secondary)] text-[10px] font-medium">{msg.peerName}</span>
              <span className="text-[var(--text-muted)] text-[9px]">{formatTime(msg.sentAt)}</span>
            </div>
            <p className="text-[var(--text-primary)] text-xs leading-relaxed">{msg.text}</p>
          </div>
        ))}
      </div>

      {typingPeers.length > 0 && (
        <div data-testid="typing-indicator" className="px-4 py-1 text-[var(--text-muted)] text-[10px]">
          {typingPeers.map((p) => p.name).join(', ')} typing...
        </div>
      )}

      <div className="px-3 py-3 border-t border-[var(--border-subtle)] flex gap-2">
        <input
          data-testid="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          className="flex-1 bg-[var(--surface-raised)] border border-[var(--border-default)] rounded-[8px] px-3 py-2 text-[var(--text-primary)] text-xs outline-none focus:border-[var(--border-strong)] placeholder:text-[var(--text-muted)]"
        />
        <button
          data-testid="chat-send"
          onClick={handleSend}
          disabled={!input.trim()}
          className="text-[var(--text-secondary)] disabled:opacity-40 text-sm px-2"
        >
          →
        </button>
      </div>
    </div>
  )
}
