# V2 Feature Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution order:**
> - Task 1 first (ControlBar — standalone)
> - After Task 1 lands: dispatch **Task 2** and **Task 3** in parallel (different files)
> - After Task 3 lands: dispatch **Task 4** (same PeerManager files — cannot overlap with Task 3)
> - After Task 2 lands: dispatch **Task 5** (same RoomV2 files — cannot overlap with Task 2)
>
> Tasks 3+4 share `PeerManager.tsx`. Tasks 2+5 share `RoomV2.tsx`. Do not run either pair simultaneously.

**Goal:** Close the functional gaps that make v2 feel broken — unreachable chat, silent reactions, missing participants list, socket ID names in history, and unrendered polls.

**Architecture:** All fixes live in `src/v2/`. No new stores needed — the stores already model everything correctly. Gaps are purely in the rendering and socket layers. Two new components (ParticipantsPanel, PollBanner) follow the exact same pattern as ChatPanel. PeerManager gets one new socket handler and one bug fix.

**Tech Stack:** React 18, TypeScript, Zustand, socket.io-client, @testing-library/react, Jest

---

## Context for every subagent

Working directory: `/Users/ralphucious/App Builds/decentralized-video-app/.worktrees/v2-modernization`

Run a single test file:
```bash
npx jest <test-file-path> --no-coverage
```

Run full suite with coverage:
```bash
npx jest --coverage --coverageReporters=text-summary
```

All thresholds (branches 70, functions/lines/statements 80) must stay green.

Commit messages must end with:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Write commit messages to `/tmp/<taskN>-commit.txt` and use `git commit -F /tmp/<taskN>-commit.txt`.

---

## File map

| File | Action | Why |
|------|--------|-----|
| `src/v2/call/ControlBar.tsx` | Modify | Add chat + participants toggle buttons |
| `src/v2/pages/RoomV2.tsx` | Modify | Render ParticipantsPanel + PollBanner when open |
| `src/v2/call/ParticipantsPanel.tsx` | Create | Peer list panel — mirrors ChatPanel structure |
| `src/v2/call/PollBanner.tsx` | Create | Active poll display — reads useSessionStore |
| `src/v2/call/PeerManager.tsx` | Modify | Add `new-reaction` handler + fix `chat-history` peerName |
| `tests/unit/v2/call/ControlBar.test.tsx` | Modify | Cover new buttons |
| `tests/unit/v2/pages/RoomV2.test.tsx` | Modify | Cover participants panel visibility |
| `tests/unit/v2/call/ParticipantsPanel.test.tsx` | Create | Full coverage of new component |
| `tests/unit/v2/call/PollBanner.test.tsx` | Create | Full coverage of new component |
| `tests/unit/v2/call/PeerManager.test.tsx` | Modify | Cover new-reaction handler + chat-history fix |

---

## Task 1 (CRITICAL): Chat + participants toggle buttons in ControlBar

**Why:** The chat panel is fully built but unreachable — there is no button to open it. Same for participants. This makes both features invisible to users.

**How ControlBar works today:** It reads `isMuted`/`isCamOff` from `useCallStore` directly and calls store actions on click. The same pattern applies for `isChatOpen`/`isParticipantsOpen` from `useUIStore`.

**Files:**
- Modify: `src/v2/call/ControlBar.tsx`
- Modify: `tests/unit/v2/call/ControlBar.test.tsx`

---

- [ ] **Step 1: Read the existing files**

```bash
cat src/v2/call/ControlBar.tsx
cat tests/unit/v2/call/ControlBar.test.tsx
```

Understand: where store selectors are declared, where buttons are rendered, where the framer-motion mock is.

---

- [ ] **Step 2: Write failing tests**

Add these tests at the end of `tests/unit/v2/call/ControlBar.test.tsx`.

The existing `beforeEach` sets `useCallStore.setState(...)` — add `useUIStore` state reset alongside it. You'll need to import `useUIStore`.

```tsx
import { useUIStore } from '../../../../src/v2/store/useUIStore'
```

Add to `beforeEach`:
```tsx
useUIStore.setState({ isChatOpen: false, isParticipantsOpen: false })
```

Then add the tests:

```tsx
test('chat button toggles isChatOpen in store', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-chat'))
  expect(useUIStore.getState().isChatOpen).toBe(true)
  fireEvent.click(screen.getByTestId('btn-chat'))
  expect(useUIStore.getState().isChatOpen).toBe(false)
})

test('participants button toggles isParticipantsOpen in store', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-participants'))
  expect(useUIStore.getState().isParticipantsOpen).toBe(true)
  fireEvent.click(screen.getByTestId('btn-participants'))
  expect(useUIStore.getState().isParticipantsOpen).toBe(false)
})

test('chat button renders with primary variant when isChatOpen', () => {
  useUIStore.setState({ isChatOpen: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  // Button variant="primary" renders with bg-[var(--text-primary)] class
  const btn = screen.getByTestId('btn-chat')
  expect(btn.className).toMatch(/text-primary/)
})

test('participants button renders with primary variant when isParticipantsOpen', () => {
  useUIStore.setState({ isParticipantsOpen: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  const btn = screen.getByTestId('btn-participants')
  expect(btn.className).toMatch(/text-primary/)
})

test('opening chat closes participants (mutual exclusion)', () => {
  useUIStore.setState({ isParticipantsOpen: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-chat'))
  expect(useUIStore.getState().isChatOpen).toBe(true)
  expect(useUIStore.getState().isParticipantsOpen).toBe(false)
})
```

---

- [ ] **Step 3: Run to verify they fail**

```bash
npx jest tests/unit/v2/call/ControlBar.test.tsx --no-coverage
```

Expected: 5 new tests fail with "Unable to find an element by: [data-testid="btn-chat"]"

---

- [ ] **Step 4: Implement the changes in ControlBar**

Replace the full content of `src/v2/call/ControlBar.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCallStore } from '../store/useCallStore'
import { useUIStore } from '../store/useUIStore'
import { Button } from '../ui/Button'

interface ControlBarProps {
  onEndCall: () => void
  onSendReaction?: (emoji: string) => void
}

const REACTIONS = ['👍', '❤️', '😂', '😮', '👏']
const HIDE_AFTER_MS = 3000

export function ControlBar({ onEndCall, onSendReaction }: ControlBarProps) {
  const isMuted = useCallStore((s) => s.isMuted)
  const isCamOff = useCallStore((s) => s.isCamOff)
  const setMuted = useCallStore((s) => s.setMuted)
  const setCamOff = useCallStore((s) => s.setCamOff)
  const isChatOpen = useUIStore((s) => s.isChatOpen)
  const toggleChat = useUIStore((s) => s.toggleChat)
  const isParticipantsOpen = useUIStore((s) => s.isParticipantsOpen)
  const toggleParticipants = useUIStore((s) => s.toggleParticipants)
  const [showReactions, setShowReactions] = useState(false)
  const [visible, setVisible] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function resetTimer() {
    setVisible(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(false), HIDE_AFTER_MS)
  }

  useEffect(() => {
    resetTimer()
    window.addEventListener('mousemove', resetTimer)
    return () => {
      window.removeEventListener('mousemove', resetTimer)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          data-testid="control-bar"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-3 bg-[var(--surface-overlay)] border border-[var(--border-default)] rounded-full"
        >
          <Button
            data-testid="btn-mute"
            variant={isMuted ? 'danger' : 'ghost'}
            onClick={() => setMuted(!isMuted)}
          >
            {isMuted ? '🔇 Unmute' : '🎙 Mute'}
          </Button>

          <Button
            data-testid="btn-cam"
            variant={isCamOff ? 'danger' : 'ghost'}
            onClick={() => setCamOff(!isCamOff)}
          >
            {isCamOff ? '📷 Start Cam' : '🎥 Stop Cam'}
          </Button>

          <div className="relative">
            <Button
              data-testid="btn-reactions"
              variant="ghost"
              onClick={() => setShowReactions((v) => !v)}
            >
              😊
            </Button>
            {showReactions && (
              <div
                data-testid="reaction-picker"
                className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-1 bg-[var(--surface-overlay)] border border-[var(--border-default)] rounded-full px-2 py-1"
              >
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => { onSendReaction?.(emoji); setShowReactions(false) }}
                    className="text-lg hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            data-testid="btn-chat"
            variant={isChatOpen ? 'primary' : 'ghost'}
            onClick={toggleChat}
          >
            💬
          </Button>

          <Button
            data-testid="btn-participants"
            variant={isParticipantsOpen ? 'primary' : 'ghost'}
            onClick={toggleParticipants}
          >
            👥
          </Button>

          <Button
            data-testid="btn-end-call"
            variant="danger"
            onClick={onEndCall}
          >
            Leave
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

---

- [ ] **Step 5: Run tests — all should pass**

```bash
npx jest tests/unit/v2/call/ControlBar.test.tsx --no-coverage
```

Expected: all tests pass (14 total).

---

- [ ] **Step 6: Commit**

```bash
cat > /tmp/task1-commit.txt << 'EOF'
feat(v2/ControlBar): add chat and participants toggle buttons

Chat was fully implemented but unreachable — no button existed to open it.
Participants panel same. Both buttons read from useUIStore directly
(consistent with how mute/cam read from useCallStore). Active state uses
variant="primary" so users can see which panel is open.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
git add src/v2/call/ControlBar.tsx tests/unit/v2/call/ControlBar.test.tsx
git commit -F /tmp/task1-commit.txt
```

---

## Task 2 (HIGH — after Task 1): ParticipantsPanel component + RoomV2 wiring

**Why:** `isParticipantsOpen` is now togglable but nothing renders when it's true. This task creates the component and wires it into RoomV2 alongside ChatPanel.

**How ChatPanel is wired in RoomV2:** `{isChatOpen && <ChatPanel ... />}` renders the panel to the right of the main content flex row. ParticipantsPanel follows the identical pattern.

**Files:**
- Create: `src/v2/call/ParticipantsPanel.tsx`
- Modify: `src/v2/pages/RoomV2.tsx`
- Create: `tests/unit/v2/call/ParticipantsPanel.test.tsx`
- Modify: `tests/unit/v2/pages/RoomV2.test.tsx`

---

- [ ] **Step 1: Read existing files**

```bash
cat src/v2/pages/RoomV2.tsx
cat src/v2/call/ChatPanel.tsx
cat tests/unit/v2/pages/RoomV2.test.tsx
```

Understand: how `isChatOpen` renders ChatPanel, how the flex layout works, how RoomV2 tests use `useUIStore.getState()`.

---

- [ ] **Step 2: Write failing tests for ParticipantsPanel**

Create `tests/unit/v2/call/ParticipantsPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { ParticipantsPanel } from '../../../../src/v2/call/ParticipantsPanel'
import { usePeerStore } from '../../../../src/v2/store/usePeerStore'
import type { PeerRecord } from '../../../../src/v2/types'

function makePeer(overrides: Partial<PeerRecord> = {}): PeerRecord {
  return {
    id: 'peer-1', name: 'Alice', role: 'guest',
    stream: null, isMuted: false, isCamOff: false, videoEnabled: false, isScreenSharing: false,
    connectionState: 'connected', networkQuality: 'good',
    isSpeaking: false, isPinned: false,
    hasRaisedHand: false, handRaisedAt: null,
    reaction: null, isAway: false, isTyping: false,
    ...overrides,
  }
}

beforeEach(() => {
  usePeerStore.setState({ peers: new Map() })
})

test('renders panel with header', () => {
  render(<ParticipantsPanel />)
  expect(screen.getByTestId('participants-panel')).toBeInTheDocument()
  expect(screen.getByText(/participants/i)).toBeInTheDocument()
})

test('shows empty state when no peers', () => {
  render(<ParticipantsPanel />)
  expect(screen.getByText('No other participants yet.')).toBeInTheDocument()
})

test('shows peer name', () => {
  usePeerStore.setState({ peers: new Map([['peer-1', makePeer({ name: 'Alice' })]]) })
  render(<ParticipantsPanel />)
  expect(screen.getByText('Alice')).toBeInTheDocument()
})

test('shows muted indicator when peer is muted', () => {
  usePeerStore.setState({ peers: new Map([['peer-1', makePeer({ isMuted: true })]]) })
  render(<ParticipantsPanel />)
  expect(screen.getByTestId('peer-muted-peer-1')).toBeInTheDocument()
})

test('shows cam-off indicator when peer cam is off', () => {
  usePeerStore.setState({ peers: new Map([['peer-1', makePeer({ isCamOff: true })]]) })
  render(<ParticipantsPanel />)
  expect(screen.getByTestId('peer-cam-off-peer-1')).toBeInTheDocument()
})

test('shows connected status dot for connected peer', () => {
  usePeerStore.setState({ peers: new Map([['peer-1', makePeer({ connectionState: 'connected' })]]) })
  render(<ParticipantsPanel />)
  expect(screen.getByTestId('peer-status-peer-1')).toHaveClass('bg-[var(--accent-live)]')
})

test('shows failed status dot for failed peer', () => {
  usePeerStore.setState({ peers: new Map([['peer-1', makePeer({ connectionState: 'failed' })]]) })
  render(<ParticipantsPanel />)
  expect(screen.getByTestId('peer-status-peer-1')).toHaveClass('bg-[var(--accent-danger)]')
})
```

---

- [ ] **Step 3: Run to verify they fail**

```bash
npx jest tests/unit/v2/call/ParticipantsPanel.test.tsx --no-coverage
```

Expected: FAIL — "Cannot find module '../../../../src/v2/call/ParticipantsPanel'"

---

- [ ] **Step 4: Create ParticipantsPanel**

Create `src/v2/call/ParticipantsPanel.tsx`:

```tsx
import { usePeerStore } from '../store/usePeerStore'

export function ParticipantsPanel() {
  const peers = usePeerStore((s) => s.peers)
  const list = Array.from(peers.values())

  return (
    <div data-testid="participants-panel" className="w-[240px] shrink-0 border-l border-[var(--border-subtle)] flex flex-col bg-[var(--surface-base)]">
      <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
        <span className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wide">
          Participants ({list.length + 1})
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        <div data-testid="participant-local" className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              data-testid="peer-status-local"
              className="w-1.5 h-1.5 rounded-full bg-[var(--accent-live)]"
            />
            <span className="text-[var(--text-primary)] text-xs">You</span>
          </div>
        </div>

        {list.map((peer) => (
          <div
            key={peer.id}
            data-testid={`participant-${peer.id}`}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span
                data-testid={`peer-status-${peer.id}`}
                className={`w-1.5 h-1.5 rounded-full ${
                  peer.connectionState === 'connected'
                    ? 'bg-[var(--accent-live)]'
                    : peer.connectionState === 'failed'
                    ? 'bg-[var(--accent-danger)]'
                    : 'bg-[var(--text-muted)]'
                }`}
              />
              <span className="text-[var(--text-primary)] text-xs">{peer.name}</span>
            </div>
            <div className="flex items-center gap-1">
              {peer.isMuted && (
                <span data-testid={`peer-muted-${peer.id}`} className="text-[var(--text-muted)] text-[10px]">🔇</span>
              )}
              {peer.isCamOff && (
                <span data-testid={`peer-cam-off-${peer.id}`} className="text-[var(--text-muted)] text-[10px]">📷</span>
              )}
            </div>
          </div>
        ))}

        {list.length === 0 && (
          <p className="text-[var(--text-muted)] text-xs">No other participants yet.</p>
        )}
      </div>
    </div>
  )
}
```

---

- [ ] **Step 5: Run ParticipantsPanel tests**

```bash
npx jest tests/unit/v2/call/ParticipantsPanel.test.tsx --no-coverage
```

Expected: all 7 tests pass.

---

- [ ] **Step 6: Write failing RoomV2 test for participants panel visibility**

Add to `tests/unit/v2/pages/RoomV2.test.tsx`:

```tsx
test('participants panel is hidden by default', async () => {
  await renderRoom()
  await screen.findByTestId('room-v2')
  expect(screen.queryByTestId('participants-panel')).not.toBeInTheDocument()
})

test('participants panel appears when isParticipantsOpen is true', async () => {
  await renderRoom()
  await screen.findByTestId('room-v2')
  act(() => { useUIStore.getState().toggleParticipants() })
  expect(await screen.findByTestId('participants-panel')).toBeInTheDocument()
})
```

---

- [ ] **Step 7: Run RoomV2 tests to verify they fail**

```bash
npx jest tests/unit/v2/pages/RoomV2.test.tsx --no-coverage
```

Expected: 2 new tests fail — participants panel not found.

---

- [ ] **Step 8: Wire ParticipantsPanel into RoomV2**

Replace the full content of `src/v2/pages/RoomV2.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCallStore } from '../store/useCallStore'
import { useUIStore } from '../store/useUIStore'
import { MediaController } from '../call/MediaController'
import { PeerManager, type PeerManagerHandle } from '../call/PeerManager'
import { SpotlightView } from '../call/SpotlightView'
import { ThumbnailStrip } from '../call/ThumbnailStrip'
import { ControlBar } from '../call/ControlBar'
import { ChatPanel } from '../call/ChatPanel'
import { ParticipantsPanel } from '../call/ParticipantsPanel'
import { PollBanner } from '../call/PollBanner'

export default function RoomV2() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const peerManagerRef = useRef<PeerManagerHandle>(null)
  const setRoomId = useCallStore((s) => s.setRoomId)
  const isChatOpen = useUIStore((s) => s.isChatOpen)
  const isParticipantsOpen = useUIStore((s) => s.isParticipantsOpen)

  useEffect(() => {
    if (roomId) setRoomId(roomId)
  }, [roomId, setRoomId])

  return (
    <div className="v2 flex flex-col h-screen bg-[var(--surface-base)]" data-testid="room-v2">
      <MediaController />
      <PeerManager ref={peerManagerRef} />

      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-live)] shadow-[0_0_6px_var(--accent-live)]" />
          <span className="text-[var(--text-primary)] text-sm font-semibold">{roomId}</span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-w-0 relative">
          <SpotlightView />
          <ThumbnailStrip />
          <PollBanner />
          <ControlBar
            onEndCall={() => navigate('/')}
            onSendReaction={(emoji) => peerManagerRef.current?.sendReaction(emoji)}
          />
        </div>

        {isChatOpen && (
          <ChatPanel onSendMessage={(text) => peerManagerRef.current?.sendMessage(text)} />
        )}

        {isParticipantsOpen && (
          <ParticipantsPanel />
        )}
      </div>
    </div>
  )
}
```

**Note:** `PollBanner` is imported here even though it doesn't exist yet (Task 5). If Task 5 is not yet done, create a temporary stub:

```tsx
// src/v2/call/PollBanner.tsx  — temporary stub until Task 5
export function PollBanner() { return null }
```

---

- [ ] **Step 9: Run all RoomV2 tests**

```bash
npx jest tests/unit/v2/pages/RoomV2.test.tsx --no-coverage
```

Expected: all tests pass (10 total).

---

- [ ] **Step 10: Commit**

```bash
cat > /tmp/task2-commit.txt << 'EOF'
feat(v2): add ParticipantsPanel component and wire into RoomV2

Creates ParticipantsPanel showing peer names, connection status dots,
and muted/cam-off indicators. Wires into RoomV2 alongside ChatPanel —
renders when isParticipantsOpen is true (toggled by the btn-participants
button added in Task 1).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
git add src/v2/call/ParticipantsPanel.tsx src/v2/pages/RoomV2.tsx \
  tests/unit/v2/call/ParticipantsPanel.test.tsx tests/unit/v2/pages/RoomV2.test.tsx
git commit -F /tmp/task2-commit.txt
```

---

## Task 3 (CRITICAL — independent of Task 2): Incoming reactions + auto-clear in PeerManager

**Why:** `sendReaction` emits `send-reaction` to the server. The server presumably broadcasts it back as `new-reaction`. But PeerManager has no handler for `new-reaction`, so remote peers' reactions are never received. The `reaction` field in PeerRecord is never populated from the network.

**Auto-clear:** The types say reactions auto-clear after 3000ms. This is implemented here via `setTimeout` tracked in a `reactionTimersRef` so they're cancelled cleanly on disconnect.

**Files:**
- Modify: `src/v2/call/PeerManager.tsx`
- Modify: `tests/unit/v2/call/PeerManager.test.tsx`

---

- [ ] **Step 1: Read the existing files**

```bash
cat src/v2/call/PeerManager.tsx
cat tests/unit/v2/call/PeerManager.test.tsx
```

Understand: where socket handlers are registered (inside the big `useEffect`), how `patchPeer` works, how `socketCallbacks` dict captures handlers in tests, how `peerCallbacks` captures peer events.

---

- [ ] **Step 2: Write the failing tests**

Add at the end of `tests/unit/v2/call/PeerManager.test.tsx`:

```tsx
test('new-reaction sets reaction on peer in store', async () => {
  await act(async () => { render(<PeerManager />) })
  act(() => { fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }]) })
  act(() => { fireSocketEvent('new-reaction', { peerId: 'peer-a', emoji: '👍' }) })
  const peer = usePeerStore.getState().peers.get('peer-a')
  expect(peer?.reaction?.emoji).toBe('👍')
  expect(peer?.reaction?.sentAt).toBeGreaterThan(0)
})

test('new-reaction auto-clears after 3000ms', async () => {
  jest.useFakeTimers()
  await act(async () => { render(<PeerManager />) })
  act(() => { fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }]) })
  act(() => { fireSocketEvent('new-reaction', { peerId: 'peer-a', emoji: '👍' }) })
  expect(usePeerStore.getState().peers.get('peer-a')?.reaction?.emoji).toBe('👍')
  act(() => { jest.advanceTimersByTime(3000) })
  expect(usePeerStore.getState().peers.get('peer-a')?.reaction).toBeNull()
  jest.useRealTimers()
})

test('new-reaction replaces existing reaction and resets timer', async () => {
  jest.useFakeTimers()
  await act(async () => { render(<PeerManager />) })
  act(() => { fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }]) })
  act(() => { fireSocketEvent('new-reaction', { peerId: 'peer-a', emoji: '👍' }) })
  act(() => { jest.advanceTimersByTime(2000) })
  // Second reaction before first expires — should reset timer
  act(() => { fireSocketEvent('new-reaction', { peerId: 'peer-a', emoji: '❤️' }) })
  expect(usePeerStore.getState().peers.get('peer-a')?.reaction?.emoji).toBe('❤️')
  // 1000ms more (3000ms since first, 1000ms since second) — should still be set
  act(() => { jest.advanceTimersByTime(1000) })
  expect(usePeerStore.getState().peers.get('peer-a')?.reaction?.emoji).toBe('❤️')
  // Another 2000ms — 3000ms since second reaction — should be cleared
  act(() => { jest.advanceTimersByTime(2000) })
  expect(usePeerStore.getState().peers.get('peer-a')?.reaction).toBeNull()
  jest.useRealTimers()
})
```

---

- [ ] **Step 3: Run to verify they fail**

```bash
npx jest tests/unit/v2/call/PeerManager.test.tsx --no-coverage -t "new-reaction"
```

Expected: 3 failures — `new-reaction` handler does not exist.

---

- [ ] **Step 4: Implement in PeerManager**

Two changes to `src/v2/call/PeerManager.tsx`:

**A) Add `reactionTimersRef` at the top of the component body** (after the existing refs):

```tsx
const reactionTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
```

**B) Add the `new-reaction` socket handler** inside the big `useEffect`, after the `new-poll` handler (around line 162):

```tsx
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
```

**C) Clear timers in the cleanup return** (inside the `useEffect`, in the existing `return () => { ... }` block):

```tsx
return () => {
  socket.emit('user-leaving')
  socket.disconnect()
  peerConnsRef.current.forEach((_, id) => destroyPeerConn(id))
  peerConnsRef.current.clear()
  socketRef.current = null
  reactionTimersRef.current.forEach(clearTimeout)
  reactionTimersRef.current.clear()
}
```

---

- [ ] **Step 5: Run tests**

```bash
npx jest tests/unit/v2/call/PeerManager.test.tsx --no-coverage
```

Expected: all tests pass.

---

- [ ] **Step 6: Commit**

```bash
cat > /tmp/task3-commit.txt << 'EOF'
feat(v2/PeerManager): receive incoming reactions and auto-clear after 3s

Adds socket.on('new-reaction') handler that sets reaction on the peer
record and schedules clearance after 3000ms. A reactionTimersRef tracks
pending timers so they're cancelled cleanly on disconnect. Re-sending a
reaction before expiry replaces the emoji and resets the timer.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
git add src/v2/call/PeerManager.tsx tests/unit/v2/call/PeerManager.test.tsx
git commit -F /tmp/task3-commit.txt
```

---

## Task 4 (MEDIUM — independent of Tasks 2 and 3): Fix chat-history peerName bug

**Why:** The `chat-history` event handler sets `peerName: m.sender` where `m.sender` is a socket ID like `"abc123xyz"`. Historical chat messages display socket IDs as author names. The `new-message` handler already handles this correctly with `m.senderName ?? m.sender`.

**Files:**
- Modify: `src/v2/call/PeerManager.tsx`
- Modify: `tests/unit/v2/call/PeerManager.test.tsx`

---

- [ ] **Step 1: Write the failing test**

Add at the end of `tests/unit/v2/call/PeerManager.test.tsx`:

```tsx
test('chat-history uses senderName when server provides it', async () => {
  await act(async () => { render(<PeerManager />) })
  act(() => {
    fireSocketEvent('chat-history', [
      { id: 'msg-1', sender: 'socket-id-abc', senderName: 'Alice', text: 'Hello', timestamp: 1000 },
    ])
  })
  const messages = useSessionStore.getState().messages
  expect(messages[0].peerName).toBe('Alice')
})

test('chat-history falls back to sender when senderName absent', async () => {
  await act(async () => { render(<PeerManager />) })
  act(() => {
    fireSocketEvent('chat-history', [
      { id: 'msg-2', sender: 'socket-id-abc', text: 'Hello', timestamp: 1000 },
    ])
  })
  const messages = useSessionStore.getState().messages
  expect(messages[0].peerName).toBe('socket-id-abc')
})
```

---

- [ ] **Step 2: Run to verify they fail**

```bash
npx jest tests/unit/v2/call/PeerManager.test.tsx --no-coverage -t "chat-history"
```

Expected: first test fails — `peerName` is `'socket-id-abc'` not `'Alice'`.

---

- [ ] **Step 3: Fix the handler in PeerManager**

In `src/v2/call/PeerManager.tsx`, find the `chat-history` handler (around line 150) and update it:

```tsx
socket.on('chat-history', (messages: Array<{ id: string; sender: string; senderName?: string; text: string; timestamp: number }>) => {
  messages.forEach((m) => {
    addMessage({ id: m.id, peerId: m.sender, peerName: m.senderName ?? m.sender, text: m.text, sentAt: m.timestamp })
  })
})
```

---

- [ ] **Step 4: Run tests**

```bash
npx jest tests/unit/v2/call/PeerManager.test.tsx --no-coverage
```

Expected: all tests pass.

---

- [ ] **Step 5: Commit**

```bash
cat > /tmp/task4-commit.txt << 'EOF'
fix(v2/PeerManager): use senderName in chat-history, not socket ID

chat-history was setting peerName: m.sender (socket ID). new-message
already did this correctly with m.senderName ?? m.sender. Apply the same
pattern to chat-history so historical messages show human names.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
git add src/v2/call/PeerManager.tsx tests/unit/v2/call/PeerManager.test.tsx
git commit -F /tmp/task4-commit.txt
```

---

## Task 5 (MEDIUM — independent of Tasks 2, 3, 4): PollBanner component

**Why:** `useSessionStore.activePoll` is populated correctly when the server fires `new-poll`. But no UI reads it. Active polls are invisible to users.

**Scope:** Display only — no voting yet. The server-side vote submission protocol is not defined. YAGNI.

**Files:**
- Create: `src/v2/call/PollBanner.tsx`
- Create: `tests/unit/v2/call/PollBanner.test.tsx`

**Note:** RoomV2 already imports and renders `<PollBanner />` from Task 2. If Task 2 created a stub, this task replaces it.

---

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/v2/call/PollBanner.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { PollBanner } from '../../../../src/v2/call/PollBanner'
import { useSessionStore } from '../../../../src/v2/store/useSessionStore'
import type { Poll } from '../../../../src/v2/types'

const poll: Poll = {
  id: 'poll-1',
  question: 'Best time to meet?',
  options: ['9am', '2pm', '5pm'],
  createdAt: Date.now(),
}

beforeEach(() => {
  useSessionStore.setState({ activePoll: null, pollResponses: {} })
})

test('renders nothing when no active poll', () => {
  const { container } = render(<PollBanner />)
  expect(container.firstChild).toBeNull()
})

test('renders poll question when poll is active', () => {
  useSessionStore.setState({ activePoll: poll })
  render(<PollBanner />)
  expect(screen.getByTestId('poll-banner')).toBeInTheDocument()
  expect(screen.getByText('Best time to meet?')).toBeInTheDocument()
})

test('renders all poll options', () => {
  useSessionStore.setState({ activePoll: poll })
  render(<PollBanner />)
  expect(screen.getByText('9am')).toBeInTheDocument()
  expect(screen.getByText('2pm')).toBeInTheDocument()
  expect(screen.getByText('5pm')).toBeInTheDocument()
})

test('each option has its own testid', () => {
  useSessionStore.setState({ activePoll: poll })
  render(<PollBanner />)
  expect(screen.getByTestId('poll-option-9am')).toBeInTheDocument()
  expect(screen.getByTestId('poll-option-2pm')).toBeInTheDocument()
  expect(screen.getByTestId('poll-option-5pm')).toBeInTheDocument()
})
```

---

- [ ] **Step 2: Run to verify they fail**

```bash
npx jest tests/unit/v2/call/PollBanner.test.tsx --no-coverage
```

Expected: FAIL — "Cannot find module '../../../../src/v2/call/PollBanner'"

---

- [ ] **Step 3: Create PollBanner**

Create `src/v2/call/PollBanner.tsx`:

```tsx
import { useSessionStore } from '../store/useSessionStore'

export function PollBanner() {
  const activePoll = useSessionStore((s) => s.activePoll)
  if (!activePoll) return null

  return (
    <div
      data-testid="poll-banner"
      className="absolute top-4 left-1/2 -translate-x-1/2 bg-[var(--surface-overlay)] border border-[var(--border-default)] rounded-[12px] px-6 py-4 max-w-sm w-full shadow-lg z-10"
    >
      <p className="text-[var(--text-primary)] text-sm font-medium mb-3">{activePoll.question}</p>
      <div className="flex flex-col gap-2">
        {activePoll.options.map((option) => (
          <button
            key={option}
            data-testid={`poll-option-${option}`}
            className="text-left text-xs text-[var(--text-secondary)] bg-[var(--surface-raised)] hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2 transition-colors"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
```

---

- [ ] **Step 4: Run tests**

```bash
npx jest tests/unit/v2/call/PollBanner.test.tsx --no-coverage
```

Expected: all 4 tests pass.

---

- [ ] **Step 5: Run full suite**

```bash
npx jest --coverage --coverageReporters=text-summary
```

Expected: all suites pass, all thresholds green.

---

- [ ] **Step 6: Commit**

```bash
cat > /tmp/task5-commit.txt << 'EOF'
feat(v2): add PollBanner component for active poll display

Reads activePoll from useSessionStore and renders the question and options
as buttons. Returns null when no poll is active. Display-only for now —
vote submission protocol not yet defined on the server.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
git add src/v2/call/PollBanner.tsx tests/unit/v2/call/PollBanner.test.tsx
git commit -F /tmp/task5-commit.txt
```

---

## Final verification

After all 5 tasks are committed:

```bash
npx jest --coverage --coverageReporters=text
```

Check:
- All 21 suites pass (19 existing + ParticipantsPanel + PollBanner)
- Branches > 85%
- No `act()` warnings in output
- `src/v2/call/ParticipantsPanel.tsx` and `src/v2/call/PollBanner.tsx` show 100% coverage
