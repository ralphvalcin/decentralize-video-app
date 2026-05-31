# Velo v2 — Foundation + HomeV2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v2 design system, shared types, four Zustand stores, UI primitives, and the HomeV2 screen — all in `src/v2/` — without touching any existing code.

**Architecture:** Parallel rebuild in `src/v2/`. HomeV2 available at `/v2` for validation. Existing `/` and `/room/:roomId` routes are untouched until the separate cutover task at the end. Tests live in `tests/unit/v2/`.

**Tech Stack:** React 18, TypeScript, Zustand 4 (already installed), Framer Motion (to install), @fontsource/inter (to install), Jest + @testing-library/react, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-05-modernization-design.md`

**Plan 2 (RoomV2):** `docs/superpowers/plans/2026-04-05-v2-room.md` — do not start until this plan is complete and HomeV2 is live at `/`.

---

## File Map

```
src/v2/
  types/
    index.ts                 ← PeerRecord, Reaction, ChatMessage, Poll, Toast
  design-system/
    tokens.ts                ← CSS custom property values as JS constants
    index.css                ← :root { --surface-base: ... } via @layer base
  store/
    usePeerStore.ts          ← peers: Map<string, PeerRecord>
    useCallStore.ts          ← local stream, mute, cam, roomId
    useUIStore.ts            ← panels, modals, layout, toasts
    useSessionStore.ts       ← messages, poll, recording, pinned
  ui/
    Button.tsx               ← primary / ghost / danger variants
    Avatar.tsx               ← initials fallback, size sm/md/lg
    Badge.tsx                ← live / warn / muted variants
    VideoTile.tsx            ← video element + overlay (name, quality, reactions)
  pages/
    HomeV2.tsx               ← split layout shell, imports left + right panels
    home/
      JoinForm.tsx           ← left half: name + room ID + create/join buttons
      PreflightPanel.tsx     ← right half: camera preview + quick rejoin strip

tests/unit/v2/
  stores/
    usePeerStore.test.ts
    useCallStore.test.ts
    useUIStore.test.ts
    useSessionStore.test.ts
  ui/
    Button.test.tsx
    Avatar.test.tsx
    Badge.test.tsx
    VideoTile.test.tsx
  pages/
    HomeV2.test.tsx
    JoinForm.test.tsx
    PreflightPanel.test.tsx
```

**Files modified (existing):**
- `src/App.jsx` — add `/v2` and `/v2/room/:roomId` routes (lazy loaded), then swap `/` at cutover
- `src/main.jsx` — import `src/v2/design-system/index.css`

---

## Task 1: Install Dependencies

**Files:** `package.json` (modified by npm)

- [ ] **Step 1: Install Framer Motion, Inter font, and missing Jest dependency**

```bash
npm install framer-motion @fontsource/inter
npm install --save-dev identity-obj-proxy
```

Expected output: `added N packages` with no errors on each command.

- [ ] **Step 2: Verify install**

```bash
node -e "require('./node_modules/framer-motion/package.json'); console.log('framer-motion ok')"
node -e "require('./node_modules/@fontsource/inter/package.json'); console.log('inter ok')"
node -e "require('./node_modules/identity-obj-proxy/package.json'); console.log('identity-obj-proxy ok')"
```

Expected: two lines printed, no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install framer-motion, @fontsource/inter, identity-obj-proxy for v2"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/v2/types/index.ts`

- [ ] **Step 1: Create the types file**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --skipLibCheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/v2/types/index.ts
git commit -m "feat(v2): add shared types — PeerRecord, Reaction, ChatMessage, Poll, Toast"
```

---

## Task 3: Design System

**Files:**
- Create: `src/v2/design-system/tokens.ts`
- Create: `src/v2/design-system/index.css`
- Modify: `src/main.jsx`

- [ ] **Step 1: Create tokens.ts**

```typescript
// src/v2/design-system/tokens.ts

export const surface = {
  base:    '#000000',
  raised:  '#0a0a0a',
  overlay: '#111111',
  hover:   '#1a1a1a',
} as const

export const border = {
  subtle:  '#1e1e1e',
  default: '#2e2e2e',
  strong:  '#ffffff',
} as const

export const text = {
  primary:   '#ffffff',
  secondary: '#888888',
  muted:     '#444444',
} as const

export const accent = {
  live:   '#22c55e',
  danger: '#ef4444',
  warn:   '#f59e0b',
  info:   '#3b82f6',
} as const
```

- [ ] **Step 2: Create index.css**

```css
/* src/v2/design-system/index.css */
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/inter/600.css';
@import '@fontsource/inter/700.css';

@layer base {
  .v2 {
    /* Surface */
    --surface-base:    #000000;
    --surface-raised:  #0a0a0a;
    --surface-overlay: #111111;
    --surface-hover:   #1a1a1a;

    /* Border */
    --border-subtle:   #1e1e1e;
    --border-default:  #2e2e2e;
    --border-strong:   #ffffff;

    /* Text */
    --text-primary:    #ffffff;
    --text-secondary:  #888888;
    --text-muted:      #444444;

    /* Accent */
    --accent-live:     #22c55e;
    --accent-danger:   #ef4444;
    --accent-warn:     #f59e0b;
    --accent-info:     #3b82f6;

    font-family: 'Inter', sans-serif;
    background-color: var(--surface-base);
    color: var(--text-primary);
  }
}
```

Note: All v2 screen roots get `className="v2"` so tokens are scoped and don't affect existing components.

- [ ] **Step 3: Import CSS in main.jsx**

In `src/main.jsx`, add this import after the existing CSS imports:
```javascript
import './v2/design-system/index.css'
```

- [ ] **Step 4: Verify dev server starts without errors**

```bash
npm run dev
```

Expected: server starts on port 5173, no CSS import errors in console.

- [ ] **Step 5: Commit**

```bash
git add src/v2/design-system/tokens.ts src/v2/design-system/index.css src/main.jsx
git commit -m "feat(v2): add design system tokens and Inter font"
```

---

## Task 4: usePeerStore

**Files:**
- Create: `src/v2/store/usePeerStore.ts`
- Create: `tests/unit/v2/stores/usePeerStore.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/v2/stores/usePeerStore.test.ts
import { usePeerStore } from '../../../../src/v2/store/usePeerStore'
import type { PeerRecord } from '../../../../src/v2/types'

const makePeer = (overrides: Partial<PeerRecord> = {}): PeerRecord => ({
  id: 'peer-1',
  name: 'Alice',
  role: 'guest',
  stream: null,
  isMuted: false,
  isCamOff: false,
  videoEnabled: true,
  isScreenSharing: false,
  connectionState: 'new',
  networkQuality: 'good',
  isSpeaking: false,
  isPinned: false,
  hasRaisedHand: false,
  handRaisedAt: null,
  reaction: null,
  isAway: false,
  isTyping: false,
  ...overrides,
})

beforeEach(() => {
  usePeerStore.setState({ peers: new Map() })
})

test('setPeer adds a new peer', () => {
  const peer = makePeer()
  usePeerStore.getState().setPeer('peer-1', peer)
  expect(usePeerStore.getState().peers.get('peer-1')).toEqual(peer)
})

test('setPeer merges a partial update', () => {
  usePeerStore.getState().setPeer('peer-1', makePeer())
  usePeerStore.getState().setPeer('peer-1', { isMuted: true })
  expect(usePeerStore.getState().peers.get('peer-1')?.isMuted).toBe(true)
  expect(usePeerStore.getState().peers.get('peer-1')?.name).toBe('Alice')
})

test('removePeer deletes all peer data in one operation', () => {
  usePeerStore.getState().setPeer('peer-1', makePeer())
  usePeerStore.getState().removePeer('peer-1')
  expect(usePeerStore.getState().peers.has('peer-1')).toBe(false)
})

test('removePeer on unknown id is a no-op', () => {
  expect(() => usePeerStore.getState().removePeer('ghost')).not.toThrow()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/v2/stores/usePeerStore.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../../../src/v2/store/usePeerStore'`

- [ ] **Step 3: Implement usePeerStore**

```typescript
// src/v2/store/usePeerStore.ts
import { create } from 'zustand'
import type { PeerRecord } from '../types'

interface PeerStore {
  peers: Map<string, PeerRecord>
  setPeer: (id: string, partial: Partial<PeerRecord>) => void
  removePeer: (id: string) => void
}

export const usePeerStore = create<PeerStore>((set, get) => ({
  peers: new Map(),

  setPeer: (id, partial) => {
    const peers = new Map(get().peers)
    const existing = peers.get(id)
    peers.set(id, existing ? { ...existing, ...partial } : (partial as PeerRecord))
    set({ peers })
  },

  removePeer: (id) => {
    const peers = new Map(get().peers)
    peers.delete(id)
    set({ peers })
  },
}))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/unit/v2/stores/usePeerStore.test.ts --no-coverage
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/v2/store/usePeerStore.ts tests/unit/v2/stores/usePeerStore.test.ts
git commit -m "feat(v2): add usePeerStore with setPeer and removePeer"
```

---

## Task 5: useCallStore

**Files:**
- Create: `src/v2/store/useCallStore.ts`
- Create: `tests/unit/v2/stores/useCallStore.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/v2/stores/useCallStore.test.ts
import { useCallStore } from '../../../../src/v2/store/useCallStore'

beforeEach(() => {
  useCallStore.setState({
    localStream: null,
    isMuted: false,
    isCamOff: false,
    roomId: '',
    screenSharePeerId: null,
  })
})

test('initial state is empty', () => {
  const state = useCallStore.getState()
  expect(state.localStream).toBeNull()
  expect(state.isMuted).toBe(false)
  expect(state.isCamOff).toBe(false)
  expect(state.roomId).toBe('')
  expect(state.screenSharePeerId).toBeNull()
})

test('setMuted toggles mute state', () => {
  useCallStore.getState().setMuted(true)
  expect(useCallStore.getState().isMuted).toBe(true)
  useCallStore.getState().setMuted(false)
  expect(useCallStore.getState().isMuted).toBe(false)
})

test('setCamOff toggles camera state', () => {
  useCallStore.getState().setCamOff(true)
  expect(useCallStore.getState().isCamOff).toBe(true)
})

test('setRoomId stores the room id', () => {
  useCallStore.getState().setRoomId('design-sync')
  expect(useCallStore.getState().roomId).toBe('design-sync')
})

test('setScreenSharePeerId sets and clears screen share', () => {
  useCallStore.getState().setScreenSharePeerId('peer-2')
  expect(useCallStore.getState().screenSharePeerId).toBe('peer-2')
  useCallStore.getState().setScreenSharePeerId(null)
  expect(useCallStore.getState().screenSharePeerId).toBeNull()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/v2/stores/useCallStore.test.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement useCallStore**

```typescript
// src/v2/store/useCallStore.ts
import { create } from 'zustand'

interface CallStore {
  localStream: MediaStream | null
  isMuted: boolean
  isCamOff: boolean
  roomId: string
  screenSharePeerId: string | null
  setLocalStream: (stream: MediaStream | null) => void
  setMuted: (value: boolean) => void
  setCamOff: (value: boolean) => void
  setRoomId: (id: string) => void
  setScreenSharePeerId: (id: string | null) => void
}

export const useCallStore = create<CallStore>((set) => ({
  localStream: null,
  isMuted: false,
  isCamOff: false,
  roomId: '',
  screenSharePeerId: null,
  setLocalStream: (stream) => set({ localStream: stream }),
  setMuted: (value) => set({ isMuted: value }),
  setCamOff: (value) => set({ isCamOff: value }),
  setRoomId: (id) => set({ roomId: id }),
  setScreenSharePeerId: (id) => set({ screenSharePeerId: id }),
}))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/unit/v2/stores/useCallStore.test.ts --no-coverage
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/v2/store/useCallStore.ts tests/unit/v2/stores/useCallStore.test.ts
git commit -m "feat(v2): add useCallStore"
```

---

## Task 6: useUIStore

**Files:**
- Create: `src/v2/store/useUIStore.ts`
- Create: `tests/unit/v2/stores/useUIStore.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/v2/stores/useUIStore.test.ts
import { useUIStore } from '../../../../src/v2/store/useUIStore'
import type { Toast } from '../../../../src/v2/types'

beforeEach(() => {
  useUIStore.setState({
    isChatOpen: false,
    isParticipantsOpen: false,
    activeModal: null,
    toasts: [],
    layout: 'spotlight',
  })
})

test('toggleChat flips isChatOpen', () => {
  useUIStore.getState().toggleChat()
  expect(useUIStore.getState().isChatOpen).toBe(true)
  useUIStore.getState().toggleChat()
  expect(useUIStore.getState().isChatOpen).toBe(false)
})

test('opening participants closes chat', () => {
  useUIStore.setState({ isChatOpen: true })
  useUIStore.getState().toggleParticipants()
  expect(useUIStore.getState().isParticipantsOpen).toBe(true)
  expect(useUIStore.getState().isChatOpen).toBe(false)
})

test('opening chat closes participants', () => {
  useUIStore.setState({ isParticipantsOpen: true })
  useUIStore.getState().toggleChat()
  expect(useUIStore.getState().isChatOpen).toBe(true)
  expect(useUIStore.getState().isParticipantsOpen).toBe(false)
})

test('addToast appends and removeToast removes', () => {
  const toast: Toast = { id: 't1', message: 'Hello', variant: 'info' }
  useUIStore.getState().addToast(toast)
  expect(useUIStore.getState().toasts).toHaveLength(1)
  useUIStore.getState().removeToast('t1')
  expect(useUIStore.getState().toasts).toHaveLength(0)
})

test('setLayout updates layout', () => {
  useUIStore.getState().setLayout('grid')
  expect(useUIStore.getState().layout).toBe('grid')
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/v2/stores/useUIStore.test.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement useUIStore**

```typescript
// src/v2/store/useUIStore.ts
import { create } from 'zustand'
import type { Toast } from '../types'

interface UIStore {
  isChatOpen: boolean
  isParticipantsOpen: boolean
  activeModal: string | null
  toasts: Toast[]
  layout: 'spotlight' | 'grid'
  toggleChat: () => void
  toggleParticipants: () => void
  setActiveModal: (modal: string | null) => void
  addToast: (toast: Toast) => void
  removeToast: (id: string) => void
  setLayout: (layout: 'spotlight' | 'grid') => void
}

export const useUIStore = create<UIStore>((set, get) => ({
  isChatOpen: false,
  isParticipantsOpen: false,
  activeModal: null,
  toasts: [],
  layout: 'spotlight',

  toggleChat: () => set((s) => ({
    isChatOpen: !s.isChatOpen,
    isParticipantsOpen: s.isChatOpen ? s.isParticipantsOpen : false,
  })),

  toggleParticipants: () => set((s) => ({
    isParticipantsOpen: !s.isParticipantsOpen,
    isChatOpen: s.isParticipantsOpen ? s.isChatOpen : false,
  })),

  setActiveModal: (modal) => set({ activeModal: modal }),
  addToast: (toast) => set((s) => ({ toasts: [...s.toasts, toast] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setLayout: (layout) => set({ layout }),
}))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/unit/v2/stores/useUIStore.test.ts --no-coverage
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/v2/store/useUIStore.ts tests/unit/v2/stores/useUIStore.test.ts
git commit -m "feat(v2): add useUIStore — panels, layout, toasts"
```

---

## Task 7: useSessionStore

**Files:**
- Create: `src/v2/store/useSessionStore.ts`
- Create: `tests/unit/v2/stores/useSessionStore.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/v2/stores/useSessionStore.test.ts
import { useSessionStore } from '../../../../src/v2/store/useSessionStore'
import type { ChatMessage, Poll } from '../../../../src/v2/types'

const makeMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'msg-1',
  peerId: 'peer-1',
  peerName: 'Alice',
  text: 'Hello',
  sentAt: Date.now(),
  ...overrides,
})

beforeEach(() => {
  useSessionStore.setState({
    messages: [],
    pinnedMessage: null,
    activePoll: null,
    pollResponses: {},
    recordingState: 'idle',
    recordingConsentPeers: [],
  })
})

test('addMessage appends to messages', () => {
  useSessionStore.getState().addMessage(makeMessage())
  expect(useSessionStore.getState().messages).toHaveLength(1)
})

test('pinMessage sets pinnedMessage', () => {
  const msg = makeMessage()
  useSessionStore.getState().addMessage(msg)
  useSessionStore.getState().pinMessage(msg)
  expect(useSessionStore.getState().pinnedMessage?.id).toBe('msg-1')
})

test('unpinMessage clears pinnedMessage', () => {
  useSessionStore.setState({ pinnedMessage: makeMessage() })
  useSessionStore.getState().unpinMessage()
  expect(useSessionStore.getState().pinnedMessage).toBeNull()
})

test('recordPollResponse stores peerId → choiceId', () => {
  useSessionStore.getState().recordPollResponse('peer-1', 'Yes')
  expect(useSessionStore.getState().pollResponses['peer-1']).toBe('Yes')
})

test('setRecordingState transitions state', () => {
  useSessionStore.getState().setRecordingState('recording')
  expect(useSessionStore.getState().recordingState).toBe('recording')
})

test('addRecordingConsent adds peerId once', () => {
  useSessionStore.getState().addRecordingConsent('peer-1')
  useSessionStore.getState().addRecordingConsent('peer-1')
  expect(useSessionStore.getState().recordingConsentPeers).toHaveLength(1)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/v2/stores/useSessionStore.test.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement useSessionStore**

```typescript
// src/v2/store/useSessionStore.ts
import { create } from 'zustand'
import type { ChatMessage, Poll } from '../types'

interface SessionStore {
  messages: ChatMessage[]
  pinnedMessage: ChatMessage | null
  activePoll: Poll | null
  pollResponses: Record<string, string>
  recordingState: 'idle' | 'recording' | 'paused'
  recordingConsentPeers: string[]
  addMessage: (msg: ChatMessage) => void
  pinMessage: (msg: ChatMessage) => void
  unpinMessage: () => void
  setActivePoll: (poll: Poll | null) => void
  recordPollResponse: (peerId: string, choiceId: string) => void
  setRecordingState: (state: 'idle' | 'recording' | 'paused') => void
  addRecordingConsent: (peerId: string) => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  messages: [],
  pinnedMessage: null,
  activePoll: null,
  pollResponses: {},
  recordingState: 'idle',
  recordingConsentPeers: [],

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  pinMessage: (msg) => set({ pinnedMessage: msg }),
  unpinMessage: () => set({ pinnedMessage: null }),
  setActivePoll: (poll) => set({ activePoll: poll, pollResponses: {} }),
  recordPollResponse: (peerId, choiceId) =>
    set((s) => ({ pollResponses: { ...s.pollResponses, [peerId]: choiceId } })),
  setRecordingState: (state) => set({ recordingState: state }),
  addRecordingConsent: (peerId) => {
    if (!get().recordingConsentPeers.includes(peerId)) {
      set((s) => ({ recordingConsentPeers: [...s.recordingConsentPeers, peerId] }))
    }
  },
}))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/unit/v2/stores/useSessionStore.test.ts --no-coverage
```

Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/v2/store/useSessionStore.ts tests/unit/v2/stores/useSessionStore.test.ts
git commit -m "feat(v2): add useSessionStore — chat, polls, recording"
```

---

## Task 8: Button Component

**Files:**
- Create: `src/v2/ui/Button.tsx`
- Create: `tests/unit/v2/ui/Button.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/v2/ui/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../../../../src/v2/ui/Button'

test('renders children', () => {
  render(<Button>Click me</Button>)
  expect(screen.getByText('Click me')).toBeInTheDocument()
})

test('calls onClick when clicked', () => {
  const onClick = jest.fn()
  render(<Button onClick={onClick}>Go</Button>)
  fireEvent.click(screen.getByText('Go'))
  expect(onClick).toHaveBeenCalledTimes(1)
})

test('danger variant applies danger styling', () => {
  render(<Button variant="danger">End</Button>)
  const btn = screen.getByText('End')
  expect(btn.className).toMatch(/danger/)
})

test('disabled button does not call onClick', () => {
  const onClick = jest.fn()
  render(<Button disabled onClick={onClick}>Nope</Button>)
  fireEvent.click(screen.getByText('Nope'))
  expect(onClick).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/v2/ui/Button.test.tsx --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement Button**

```typescript
// src/v2/ui/Button.tsx
import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
}

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-[var(--text-primary)] text-[var(--surface-base)]',
    ghost:   'bg-[var(--surface-raised)] text-[var(--text-secondary)] border border-[var(--border-default)]',
    danger:  'bg-[var(--accent-danger)] text-white border-[var(--accent-danger)]',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/unit/v2/ui/Button.test.tsx --no-coverage
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/v2/ui/Button.tsx tests/unit/v2/ui/Button.test.tsx
git commit -m "feat(v2): add Button component — primary, ghost, danger variants"
```

---

## Task 9: Avatar and Badge Components

**Files:**
- Create: `src/v2/ui/Avatar.tsx`
- Create: `src/v2/ui/Badge.tsx`
- Create: `tests/unit/v2/ui/Avatar.test.tsx`
- Create: `tests/unit/v2/ui/Badge.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/v2/ui/Avatar.test.tsx
import { render, screen } from '@testing-library/react'
import { Avatar } from '../../../../src/v2/ui/Avatar'

test('shows initials from name', () => {
  render(<Avatar name="Ralph Valcin" />)
  expect(screen.getByText('RV')).toBeInTheDocument()
})

test('shows single initial for single-word name', () => {
  render(<Avatar name="Ralph" />)
  expect(screen.getByText('R')).toBeInTheDocument()
})

test('applies size class', () => {
  render(<Avatar name="Alice" size="lg" />)
  const el = screen.getByText('A').parentElement
  expect(el?.className).toMatch(/lg/)
})
```

```typescript
// tests/unit/v2/ui/Badge.test.tsx
import { render, screen } from '@testing-library/react'
import { Badge } from '../../../../src/v2/ui/Badge'

test('renders label', () => {
  render(<Badge variant="live">Live</Badge>)
  expect(screen.getByText('Live')).toBeInTheDocument()
})

test('live variant has green dot', () => {
  render(<Badge variant="live">On</Badge>)
  const dot = screen.getByTestId('badge-dot')
  expect(dot.className).toMatch(/accent-live/)
})

test('warn variant has amber dot', () => {
  render(<Badge variant="warn">Fair</Badge>)
  const dot = screen.getByTestId('badge-dot')
  expect(dot.className).toMatch(/accent-warn/)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/v2/ui/Avatar.test.tsx tests/unit/v2/ui/Badge.test.tsx --no-coverage
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement Avatar**

```typescript
// src/v2/ui/Avatar.tsx
interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-12 h-12 text-base',
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ name, size = 'md', className = '' }: AvatarProps) {
  return (
    <div className={`${sizes[size]} rounded-full bg-[var(--surface-overlay)] border border-[var(--border-subtle)] flex items-center justify-center font-semibold text-[var(--text-secondary)] ${className}`}>
      <span>{initials(name)}</span>
    </div>
  )
}
```

- [ ] **Step 4: Implement Badge**

```typescript
// src/v2/ui/Badge.tsx
import { ReactNode } from 'react'

interface BadgeProps {
  variant: 'live' | 'warn' | 'muted'
  children: ReactNode
}

const dots = {
  live:  'bg-[var(--accent-live)]',
  warn:  'bg-[var(--accent-warn)]',
  muted: 'bg-[var(--surface-hover)]',
}

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-[var(--text-muted)]">
      <span data-testid="badge-dot" className={`w-1.5 h-1.5 rounded-full ${dots[variant]}`} />
      {children}
    </span>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest tests/unit/v2/ui/Avatar.test.tsx tests/unit/v2/ui/Badge.test.tsx --no-coverage
```

Expected: PASS — 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/v2/ui/Avatar.tsx src/v2/ui/Badge.tsx tests/unit/v2/ui/Avatar.test.tsx tests/unit/v2/ui/Badge.test.tsx
git commit -m "feat(v2): add Avatar and Badge UI primitives"
```

---

## Task 10: VideoTile Component

**Files:**
- Create: `src/v2/ui/VideoTile.tsx`
- Create: `tests/unit/v2/ui/VideoTile.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/v2/ui/VideoTile.test.tsx
import { render, screen } from '@testing-library/react'
import { VideoTile } from '../../../../src/v2/ui/VideoTile'

const defaultProps = {
  peerId: 'peer-1',
  name: 'Alice',
  stream: null,
  isMuted: false,
  isCamOff: false,
  networkQuality: 'good' as const,
  isAway: false,
  reaction: null,
  hasRaisedHand: false,
}

test('shows name overlay', () => {
  render(<VideoTile {...defaultProps} />)
  expect(screen.getByText('Alice')).toBeInTheDocument()
})

test('shows avatar when cam is off', () => {
  render(<VideoTile {...defaultProps} isCamOff={true} />)
  expect(screen.getByText('A')).toBeInTheDocument() // Avatar initials
})

test('shows away overlay when isAway', () => {
  render(<VideoTile {...defaultProps} isAway={true} />)
  expect(screen.getByText(/away/i)).toBeInTheDocument()
})

test('shows reaction emoji when set', () => {
  render(<VideoTile {...defaultProps} reaction={{ emoji: '👍', sentAt: Date.now() }} />)
  expect(screen.getByText('👍')).toBeInTheDocument()
})

test('shows raised hand badge', () => {
  render(<VideoTile {...defaultProps} hasRaisedHand={true} />)
  expect(screen.getByTestId('raised-hand')).toBeInTheDocument()
})

test('shows muted indicator', () => {
  render(<VideoTile {...defaultProps} isMuted={true} />)
  expect(screen.getByTestId('muted-indicator')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/v2/ui/VideoTile.test.tsx --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement VideoTile**

```typescript
// src/v2/ui/VideoTile.tsx
import { useEffect, useRef } from 'react'
import { Avatar } from './Avatar'
import type { Reaction } from '../types'

interface VideoTileProps {
  peerId: string
  name: string
  stream: MediaStream | null
  isMuted: boolean
  isCamOff: boolean
  networkQuality: 'good' | 'fair' | 'poor'
  isAway: boolean
  reaction: Reaction | null
  hasRaisedHand: boolean
  className?: string
}

const qualityColors = {
  good: 'var(--accent-live)',
  fair: 'var(--accent-warn)',
  poor: 'var(--accent-danger)',
}

export function VideoTile({
  name, stream, isMuted, isCamOff, networkQuality,
  isAway, reaction, hasRaisedHand, className = '',
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div className={`relative bg-[var(--surface-raised)] rounded-[var(--r-md,8px)] overflow-hidden ${className}`}>
      {/* Video or Avatar */}
      {!isCamOff && stream ? (
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Avatar name={name} size="lg" />
        </div>
      )}

      {/* Away overlay */}
      {isAway && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <span className="text-[var(--text-muted)] text-xs uppercase tracking-widest">Away</span>
        </div>
      )}

      {/* Reaction */}
      {reaction && (
        <div className="absolute top-2 right-2 text-xl">{reaction.emoji}</div>
      )}

      {/* Bottom overlay: name + indicators */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
        <span className="text-[var(--text-primary)] text-xs font-medium truncate">{name}</span>
        <div className="flex items-center gap-1.5">
          {isMuted && (
            <span data-testid="muted-indicator" className="w-1.5 h-1.5 rounded-full bg-[var(--accent-danger)]" />
          )}
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: qualityColors[networkQuality] }} />
        </div>
      </div>

      {/* Raised hand */}
      {hasRaisedHand && (
        <div data-testid="raised-hand" className="absolute top-2 left-2 text-base">✋</div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/unit/v2/ui/VideoTile.test.tsx --no-coverage
```

Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/v2/ui/VideoTile.tsx tests/unit/v2/ui/VideoTile.test.tsx
git commit -m "feat(v2): add VideoTile component — stream, overlays, indicators"
```

---

## Task 11: HomeV2 Shell + Route

**Files:**
- Create: `src/v2/pages/HomeV2.tsx`
- Create: `src/v2/pages/home/JoinForm.tsx` (stub — filled in Task 12)
- Create: `src/v2/pages/home/PreflightPanel.tsx` (stub — filled in Task 13)
- Modify: `src/App.jsx`
- Create: `tests/unit/v2/pages/HomeV2.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/v2/pages/HomeV2.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomeV2 from '../../../../src/v2/pages/HomeV2'

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

test('renders without crashing', () => {
  wrap(<HomeV2 />)
})

test('renders both panels', () => {
  wrap(<HomeV2 />)
  expect(screen.getByTestId('join-form')).toBeInTheDocument()
  expect(screen.getByTestId('preflight-panel')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/v2/pages/HomeV2.test.tsx --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create component stubs**

```typescript
// src/v2/pages/home/JoinForm.tsx
export function JoinForm() {
  return <div data-testid="join-form">JoinForm</div>
}
```

```typescript
// src/v2/pages/home/PreflightPanel.tsx
export function PreflightPanel() {
  return <div data-testid="preflight-panel">PreflightPanel</div>
}
```

```typescript
// src/v2/pages/HomeV2.tsx
import { JoinForm } from './home/JoinForm'
import { PreflightPanel } from './home/PreflightPanel'

export default function HomeV2() {
  return (
    <div className="v2 flex min-h-screen">
      <div className="flex-1 border-r border-[var(--border-subtle)]">
        <JoinForm />
      </div>
      <div className="flex-1">
        <PreflightPanel />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add route to App.jsx**

In `src/App.jsx`, add the lazy import and route. Add after the existing lazy imports:
```javascript
const HomeV2 = lazy(() => import('./v2/pages/HomeV2'))
```

Add inside `<Routes>` before the existing routes:
```jsx
<Route path="/v2" element={<HomeV2 />} />
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest tests/unit/v2/pages/HomeV2.test.tsx --no-coverage
```

Expected: PASS — 2 tests.

- [ ] **Step 6: Verify in browser**

```bash
npm run dev
```

Navigate to `http://localhost:5173/v2`. Expected: blank dark page with two side-by-side placeholder panels. Existing `/` still works.

- [ ] **Step 7: Commit**

```bash
git add src/v2/pages/HomeV2.tsx src/v2/pages/home/JoinForm.tsx src/v2/pages/home/PreflightPanel.tsx src/App.jsx tests/unit/v2/pages/HomeV2.test.tsx
git commit -m "feat(v2): add HomeV2 shell and /v2 route"
```

---

## Task 12: JoinForm — Left Half

**Files:**
- Modify: `src/v2/pages/home/JoinForm.tsx`
- Create: `tests/unit/v2/pages/JoinForm.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/v2/pages/JoinForm.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { JoinForm } from '../../../../src/v2/pages/home/JoinForm'

const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

beforeEach(() => {
  mockNavigate.mockClear()
})

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

test('renders name and room ID fields', () => {
  wrap(<JoinForm />)
  expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument()
  expect(screen.getByPlaceholderText(/room id/i)).toBeInTheDocument()
})

test('Create Room navigates to a new room id when room field is empty', () => {
  wrap(<JoinForm />)
  fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Ralph' } })
  fireEvent.click(screen.getByText(/create room/i))
  expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/v2\/room\/.+/))
})

test('Join navigates to the entered room id', () => {
  wrap(<JoinForm />)
  fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Ralph' } })
  fireEvent.change(screen.getByPlaceholderText(/room id/i), { target: { value: 'design-sync' } })
  fireEvent.click(screen.getByText(/join/i))
  expect(mockNavigate).toHaveBeenCalledWith('/v2/room/design-sync')
})

test('Create Room is disabled when name is empty', () => {
  wrap(<JoinForm />)
  expect(screen.getByText(/create room/i).closest('button')).toBeDisabled()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/v2/pages/JoinForm.test.tsx --no-coverage
```

Expected: FAIL.

- [ ] **Step 3: Implement JoinForm**

```typescript
// src/v2/pages/home/JoinForm.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../ui/Button'

function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 8)
}

export function JoinForm() {
  const [name, setName] = useState('')
  const [roomId, setRoomId] = useState('')
  const navigate = useNavigate()

  function handleCreate() {
    const id = roomId.trim() || generateRoomId()
    navigate(`/v2/room/${id}`)
  }

  function handleJoin() {
    navigate(`/v2/room/${roomId.trim()}`)
  }

  return (
    <div data-testid="join-form" className="flex flex-col justify-center h-full px-12 gap-8 max-w-md">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[var(--accent-live)] shadow-[0_0_8px_var(--accent-live)]" />
        <span className="text-[var(--text-primary)] text-xl font-bold tracking-tight">Velo</span>
      </div>

      {/* Tagline */}
      <div>
        <h1 className="text-[var(--text-primary)] text-2xl font-bold leading-tight tracking-tight">
          Private video.<br />No sign-up.
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-2">
          End-to-end encrypted · Peer-to-peer · Yours.
        </p>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest">
            Your name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="bg-[var(--surface-raised)] border border-[var(--border-default)] rounded-[8px] px-3.5 py-3 text-[var(--text-primary)] text-sm outline-none focus:border-[var(--border-strong)] transition-colors placeholder:text-[var(--text-muted)]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest">
            Room ID <span className="normal-case tracking-normal text-[var(--surface-hover)]">(leave blank to create new)</span>
          </label>
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Room ID"
            className="bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-[8px] px-3.5 py-3 text-[var(--text-primary)] text-sm outline-none focus:border-[var(--border-default)] transition-colors placeholder:text-[var(--text-muted)]"
          />
        </div>

        <div className="flex gap-2 mt-1">
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={handleCreate}
            className="flex-1 rounded-[8px]"
          >
            Create Room
          </Button>
          <Button
            variant="ghost"
            disabled={!name.trim() || !roomId.trim()}
            onClick={handleJoin}
            className="flex-1 rounded-[8px]"
          >
            Join →
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/unit/v2/pages/JoinForm.test.tsx --no-coverage
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/v2/pages/home/JoinForm.tsx tests/unit/v2/pages/JoinForm.test.tsx
git commit -m "feat(v2): implement JoinForm — name field, room ID, create and join"
```

---

## Task 13: PreflightPanel — Right Half

**Files:**
- Modify: `src/v2/pages/home/PreflightPanel.tsx`
- Create: `tests/unit/v2/pages/PreflightPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/v2/pages/PreflightPanel.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PreflightPanel } from '../../../../src/v2/pages/home/PreflightPanel'

const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

test('renders camera preview section', () => {
  wrap(<PreflightPanel />)
  expect(screen.getByTestId('camera-preview')).toBeInTheDocument()
})

test('shows mic and cam status indicators', async () => {
  wrap(<PreflightPanel />)
  await waitFor(() => {
    expect(screen.getByTestId('mic-status')).toBeInTheDocument()
    expect(screen.getByTestId('cam-status')).toBeInTheDocument()
  })
})

test('renders recent rooms section', () => {
  wrap(<PreflightPanel />)
  expect(screen.getByTestId('recent-rooms')).toBeInTheDocument()
})

test('shows stored-locally footer', () => {
  wrap(<PreflightPanel />)
  expect(screen.getByText(/stored locally/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/v2/pages/PreflightPanel.test.tsx --no-coverage
```

Expected: FAIL.

- [ ] **Step 3: Implement PreflightPanel**

```typescript
// src/v2/pages/home/PreflightPanel.tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../../ui/Avatar'

interface RecentRoom {
  id: string
  name: string
  lastVisited: number
  durationMs?: number
  isActive?: boolean
  participantCount?: number
}

function getRecentRooms(): RecentRoom[] {
  try {
    return JSON.parse(localStorage.getItem('velo_recent_rooms') || '[]')
  } catch {
    return []
  }
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return 'yesterday'
  return `${Math.floor(diff / 86400000)}d ago`
}

export function PreflightPanel() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [micReady, setMicReady] = useState(false)
  const [camReady, setCamReady] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isCamOff, setIsCamOff] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const recentRooms = getRecentRooms()
  const navigate = useNavigate()

  useEffect(() => {
    let acquired: MediaStream | null = null
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((s) => {
        acquired = s
        setStream(s)
        setMicReady(true)
        setCamReady(true)
        if (videoRef.current) videoRef.current.srcObject = s
      })
      .catch(() => {
        // Permission denied — stay in fallback state
      })
    return () => {
      acquired?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function toggleMic() {
    stream?.getAudioTracks().forEach((t) => { t.enabled = isMuted })
    setIsMuted((v) => !v)
  }

  function toggleCam() {
    stream?.getVideoTracks().forEach((t) => { t.enabled = isCamOff })
    setIsCamOff((v) => !v)
  }

  return (
    <div data-testid="preflight-panel" className="flex flex-col h-full px-12 py-12 gap-6">

      {/* Camera preview */}
      <div data-testid="camera-preview" className="relative flex-1 bg-[var(--surface-raised)] rounded-[12px] border border-[var(--border-subtle)] overflow-hidden flex items-center justify-center min-h-0">
        {!isCamOff && camReady ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : (
          <Avatar name="You" size="lg" />
        )}

        {/* Mic/Cam toggles */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          <button
            onClick={toggleMic}
            className="w-8 h-8 rounded-full bg-[var(--surface-overlay)] border border-[var(--border-default)] flex items-center justify-center text-sm hover:bg-[var(--surface-hover)] transition-colors"
          >
            {isMuted ? '🔇' : '🎙'}
          </button>
          <button
            onClick={toggleCam}
            className="w-8 h-8 rounded-full bg-[var(--surface-overlay)] border border-[var(--border-default)] flex items-center justify-center text-sm hover:bg-[var(--surface-hover)] transition-colors"
          >
            {isCamOff ? '📷' : '🎥'}
          </button>
        </div>
      </div>

      {/* Device status */}
      <div className="flex gap-2">
        <div data-testid="mic-status" className="flex-1 bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2 flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${micReady ? 'bg-[var(--accent-live)]' : 'bg-[var(--accent-warn)]'}`} />
          <span className="text-[var(--text-muted)] text-xs">{micReady ? 'Mic ready' : 'No mic'}</span>
        </div>
        <div data-testid="cam-status" className="flex-1 bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2 flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${camReady ? 'bg-[var(--accent-live)]' : 'bg-[var(--accent-warn)]'}`} />
          <span className="text-[var(--text-muted)] text-xs">{camReady ? 'Cam ready' : 'No cam'}</span>
        </div>
      </div>

      {/* Recent rooms */}
      <div data-testid="recent-rooms" className="flex flex-col gap-2">
        <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest">
          Recent rooms
        </span>
        {recentRooms.length === 0 && (
          <p className="text-[var(--text-muted)] text-xs">No recent rooms.</p>
        )}
        {recentRooms.slice(0, 4).map((room) => (
          <button
            key={room.id}
            onClick={() => navigate(`/v2/room/${room.id}`)}
            className="bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-[8px] px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--surface-hover)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${room.isActive ? 'bg-[var(--accent-live)] shadow-[0_0_6px_var(--accent-live)]' : 'bg-[var(--surface-hover)] border border-[var(--border-default)]'}`} />
              <div>
                <div className={`text-xs font-medium ${room.isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                  {room.name || room.id}
                </div>
                {room.isActive && room.participantCount && (
                  <div className="text-[10px] text-[var(--accent-live)]">{room.participantCount} active</div>
                )}
              </div>
            </div>
            <span className={`text-xs ${room.isActive ? 'text-[var(--accent-live)]' : 'text-[var(--text-muted)]'}`}>
              {room.isActive ? 'Rejoin →' : formatRelative(room.lastVisited)}
            </span>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[var(--border-subtle)]" />
        <span className="text-[var(--text-muted)] text-[10px]">stored locally · never uploaded</span>
        <div className="flex-1 h-px bg-[var(--border-subtle)]" />
      </div>

    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/unit/v2/pages/PreflightPanel.test.tsx --no-coverage
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Verify in browser at /v2**

```bash
npm run dev
```

Navigate to `http://localhost:5173/v2`. Expected: Split screen — left has logo + form, right has camera preview (with permission prompt) + device indicators + recent rooms section.

- [ ] **Step 6: Commit**

```bash
git add src/v2/pages/home/PreflightPanel.tsx tests/unit/v2/pages/PreflightPanel.test.tsx
git commit -m "feat(v2): implement PreflightPanel — camera preview, device status, recent rooms"
```

---

## Task 14: HomeV2 → Run All v2 Tests + Route Cutover

**Files:**
- Modify: `src/App.jsx` — swap `/` from `Home` to `HomeV2`

- [ ] **Step 1: Run all v2 tests together**

```bash
npx jest tests/unit/v2/ --no-coverage
```

Expected: All tests pass. Fix any failures before proceeding.

- [ ] **Step 2: Run full test suite to confirm no regressions**

```bash
npx jest --no-coverage
```

Expected: All tests pass. The existing `Room.test.jsx`, `auth.test.js`, `webrtc.test.js` must still pass.

- [ ] **Step 3: Cut over the `/` route**

In `src/App.jsx`, change the root route from `Home` to `HomeV2`:
```jsx
// Before
<Route path="/" element={<Home />} />

// After
<Route path="/" element={<HomeV2 />} />
```

The `/v2` route can stay as an alias or be removed — leave it for now.

- [ ] **Step 4: Verify in browser**

```bash
npm run dev
```

Navigate to `http://localhost:5173/`. Expected: HomeV2 loads — dark split screen, logo, form, camera preview. Old Home is no longer at `/`.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat(v2): cut over / route to HomeV2"
```

---

## Plan Complete

**Next plan:** `docs/superpowers/plans/2026-04-05-v2-room.md` — builds `RoomV2`, `PeerManager`, `MediaController`, `SpotlightView`, `ThumbnailStrip`, `ControlBar`, `ChatPanel`, and `ParticipantsPanel`.

Do not start Plan 2 until:
- [ ] All v2 tests pass
- [ ] HomeV2 is live at `/`
- [ ] No regressions in existing tests
