# AI Components (Phase B Step 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `ConnectionQualityPredictions`, `TroubleshootingAssistant`, and `AIInsightsDashboard` as live TypeScript components in `src/v2/components/ai/`, contained in an `AISidePanel` accessible via a ControlBar toggle.

**Architecture:** Approach A — shared parent state. `AISidePanel` owns quality state; `ConnectionQualityPredictions` polls `RTCPeerConnection.getStats()` every 5s and reports upward via `onQualityChange(snapshot)`; `TroubleshootingAssistant` mounts when worst quality is `'Poor'` or any peer ICE state is `'failed'`; `AIInsightsDashboard` fetches `/metrics` independently every 30s.

**Tech Stack:** React 18, TypeScript, Zustand, `RTCPeerConnection.getStats()` (Web API), `fetch` (metrics), Jest + Testing Library

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/v2/store/useCallStore.ts` | Modify | Add `mediaError: string \| null` + `setMediaError` |
| `src/v2/call/MediaController.tsx` | Modify | Set `mediaError` in `getUserMedia` catch |
| `src/v2/store/useUIStore.ts` | Modify | Add `isAIOpen` + `toggleAI` (mutual exclusion) |
| `src/v2/call/PeerManager.tsx` | Modify | Add `getPeerConnections()` to imperative handle |
| `src/v2/call/ControlBar.tsx` | Modify | Add 🤖 AI toggle button |
| `src/v2/components/ai/ConnectionQualityPredictions.tsx` | Create | Poll getStats every 5s, classify quality, call onQualityChange |
| `src/v2/components/ai/TroubleshootingAssistant.tsx` | Create | Deterministic decision-tree warning card |
| `src/v2/components/ai/AIInsightsDashboard.tsx` | Create | Fetch /metrics every 30s, display stat tiles |
| `src/v2/call/AISidePanel.tsx` | Create | Panel shell owning quality snapshot state |
| `src/v2/pages/RoomV2.tsx` | Modify | Conditionally render AISidePanel |
| `tests/unit/v2/stores/useCallStore.test.ts` | Modify | Add mediaError test |
| `tests/unit/v2/call/MediaController.test.tsx` | Modify | Add setMediaError test |
| `tests/unit/v2/stores/useUIStore.test.ts` | Modify | Add isAIOpen + mutual exclusion tests |
| `tests/unit/v2/call/ControlBar.test.tsx` | Modify | Add AI button tests |
| `tests/unit/v2/call/PeerManager.test.tsx` | Modify | Add getPeerConnections test |
| `tests/unit/v2/components/ai/ConnectionQualityPredictions.test.tsx` | Create | Threshold, worst-peer, unmount tests |
| `tests/unit/v2/components/ai/TroubleshootingAssistant.test.tsx` | Create | Decision-tree + dismiss tests |
| `tests/unit/v2/components/ai/AIInsightsDashboard.test.tsx` | Create | Fetch, error state, re-poll tests |
| `tests/unit/v2/call/AISidePanel.test.tsx` | Create | Snapshot-driven show/hide TroubleshootingAssistant |
| `tests/unit/v2/pages/RoomV2.test.tsx` | Modify | AI panel show/hide test |

---

## Task 1: Add `mediaError` to `useCallStore` and `MediaController`

`TroubleshootingAssistant` rule 4 reads `useCallStore().mediaError`. The store currently has no error field.

**Files:**
- Modify: `src/v2/store/useCallStore.ts`
- Modify: `src/v2/call/MediaController.tsx`
- Modify: `tests/unit/v2/stores/useCallStore.test.ts`
- Modify: `tests/unit/v2/call/MediaController.test.tsx`

- [ ] **Step 1: Write the failing store test**

Add at the bottom of `tests/unit/v2/stores/useCallStore.test.ts`:

```ts
test('setMediaError stores error message and reset clears it', () => {
  useCallStore.getState().setMediaError('NotAllowedError')
  expect(useCallStore.getState().mediaError).toBe('NotAllowedError')
  useCallStore.getState().reset()
  expect(useCallStore.getState().mediaError).toBeNull()
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx jest tests/unit/v2/stores/useCallStore.test.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `setMediaError is not a function`

- [ ] **Step 3: Update `useCallStore.ts`**

Replace the entire file content:

```ts
import { create } from 'zustand'

interface CallStore {
  localStream: MediaStream | null
  isMuted: boolean
  isCamOff: boolean
  userName: string
  screenSharePeerId: string | null
  mediaError: string | null
  setLocalStream: (stream: MediaStream | null) => void
  setMuted: (value: boolean) => void
  setCamOff: (value: boolean) => void
  setUserName: (name: string) => void
  setScreenSharePeerId: (id: string | null) => void
  setMediaError: (err: string | null) => void
  reset: () => void
}

export const useCallStore = create<CallStore>((set) => ({
  localStream: null,
  isMuted: false,
  isCamOff: false,
  userName: '',
  screenSharePeerId: null,
  mediaError: null,
  setLocalStream: (stream) => set({ localStream: stream }),
  setMuted: (value) => set({ isMuted: value }),
  setCamOff: (value) => set({ isCamOff: value }),
  setUserName: (name) => set({ userName: name }),
  setScreenSharePeerId: (id) => set({ screenSharePeerId: id }),
  setMediaError: (err) => set({ mediaError: err }),
  reset: () => set({ isMuted: false, isCamOff: false, mediaError: null }),
}))
```

- [ ] **Step 4: Run store test to verify it passes**

```bash
npx jest tests/unit/v2/stores/useCallStore.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 5: Write the failing MediaController test**

Add at the bottom of the `describe('MediaController')` block in `tests/unit/v2/call/MediaController.test.tsx`:

```ts
test('permission denied: sets mediaError in store', async () => {
  jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(
    new DOMException('Permission denied', 'NotAllowedError')
  )
  jest.spyOn(console, 'error').mockImplementation(() => {})
  await act(async () => { render(<MediaController />) })
  expect(useCallStore.getState().mediaError).toBe('Permission denied')
})
```

Also update the `beforeEach` in that file to reset `mediaError`:

```ts
useCallStore.setState({ localStream: null, isMuted: false, isCamOff: false, mediaError: null })
```

- [ ] **Step 6: Run to verify it fails**

```bash
npx jest tests/unit/v2/call/MediaController.test.tsx --no-coverage 2>&1 | tail -20
```

Expected: FAIL — mediaError is null

- [ ] **Step 7: Update the `.catch()` in `MediaController.tsx`**

Replace the catch block (currently lines 32–34):

```ts
      .catch((err) => {
        console.error('[MediaController] getUserMedia failed:', err)
        useCallStore.getState().setMediaError(err instanceof Error ? err.message : String(err))
      })
```

- [ ] **Step 8: Run MediaController tests to verify all pass**

```bash
npx jest tests/unit/v2/call/MediaController.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: PASS (all 10 tests)

- [ ] **Step 9: Commit**

```bash
git add src/v2/store/useCallStore.ts src/v2/call/MediaController.tsx tests/unit/v2/stores/useCallStore.test.ts tests/unit/v2/call/MediaController.test.tsx
git commit -m "feat(store): add mediaError to useCallStore; MediaController sets it on getUserMedia failure"
```

---

## Task 2: Add `isAIOpen` + `toggleAI` to `useUIStore`

The AI panel follows the same mutual exclusion pattern as Chat/Participants/QA.

**Files:**
- Modify: `src/v2/store/useUIStore.ts`
- Modify: `tests/unit/v2/stores/useUIStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Add at the bottom of `tests/unit/v2/stores/useUIStore.test.ts`:

```ts
test('toggleAI flips isAIOpen', () => {
  useUIStore.getState().toggleAI()
  expect(useUIStore.getState().isAIOpen).toBe(true)
  useUIStore.getState().toggleAI()
  expect(useUIStore.getState().isAIOpen).toBe(false)
})

test('opening AI closes chat, participants, and QA', () => {
  useUIStore.setState({ isChatOpen: true, isParticipantsOpen: true, isQAOpen: true })
  useUIStore.getState().toggleAI()
  expect(useUIStore.getState().isAIOpen).toBe(true)
  expect(useUIStore.getState().isChatOpen).toBe(false)
  expect(useUIStore.getState().isParticipantsOpen).toBe(false)
  expect(useUIStore.getState().isQAOpen).toBe(false)
})

test('opening chat closes AI', () => {
  useUIStore.setState({ isAIOpen: true })
  useUIStore.getState().toggleChat()
  expect(useUIStore.getState().isChatOpen).toBe(true)
  expect(useUIStore.getState().isAIOpen).toBe(false)
})

test('opening participants closes AI', () => {
  useUIStore.setState({ isAIOpen: true })
  useUIStore.getState().toggleParticipants()
  expect(useUIStore.getState().isParticipantsOpen).toBe(true)
  expect(useUIStore.getState().isAIOpen).toBe(false)
})

test('opening QA closes AI', () => {
  useUIStore.setState({ isAIOpen: true })
  useUIStore.getState().toggleQA()
  expect(useUIStore.getState().isQAOpen).toBe(true)
  expect(useUIStore.getState().isAIOpen).toBe(false)
})
```

Also update the `beforeEach` to reset `isAIOpen`:

```ts
beforeEach(() => {
  useUIStore.setState({
    isChatOpen: false,
    isParticipantsOpen: false,
    isQAOpen: false,
    isAIOpen: false,
    activeModal: null,
    toasts: [],
    layout: 'spotlight',
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx jest tests/unit/v2/stores/useUIStore.test.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `toggleAI is not a function`

- [ ] **Step 3: Update `useUIStore.ts`**

Replace the entire file content:

```ts
import { create } from 'zustand'
import type { Toast } from '../types'

interface UIStore {
  isChatOpen: boolean
  isParticipantsOpen: boolean
  isQAOpen: boolean
  isAIOpen: boolean
  activeModal: string | null
  toasts: Toast[]
  layout: 'spotlight' | 'grid'
  toggleChat: () => void
  toggleParticipants: () => void
  toggleQA: () => void
  toggleAI: () => void
  setActiveModal: (modal: string | null) => void
  addToast: (toast: Toast) => void
  removeToast: (id: string) => void
  setLayout: (layout: 'spotlight' | 'grid') => void
}

export const useUIStore = create<UIStore>((set) => ({
  isChatOpen: false,
  isParticipantsOpen: false,
  isQAOpen: false,
  isAIOpen: false,
  activeModal: null,
  toasts: [],
  layout: 'spotlight',

  // Panels are mutually exclusive: opening any one closes all others.
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen, isParticipantsOpen: false, isQAOpen: false, isAIOpen: false })),
  toggleParticipants: () => set((s) => ({ isParticipantsOpen: !s.isParticipantsOpen, isChatOpen: false, isQAOpen: false, isAIOpen: false })),
  toggleQA: () => set((s) => ({ isQAOpen: !s.isQAOpen, isChatOpen: false, isParticipantsOpen: false, isAIOpen: false })),
  toggleAI: () => set((s) => ({ isAIOpen: !s.isAIOpen, isChatOpen: false, isParticipantsOpen: false, isQAOpen: false })),

  setActiveModal: (modal) => set({ activeModal: modal }),
  addToast: (toast) => set((s) => ({ toasts: [...s.toasts, toast] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setLayout: (layout) => set({ layout }),
}))
```

- [ ] **Step 4: Run UIStore tests**

```bash
npx jest tests/unit/v2/stores/useUIStore.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/v2/store/useUIStore.ts tests/unit/v2/stores/useUIStore.test.ts
git commit -m "feat(store): add isAIOpen + toggleAI with mutual exclusion to useUIStore"
```

---

## Task 3: Add `getPeerConnections()` to `PeerManager`

`AISidePanel` needs to give `ConnectionQualityPredictions` a way to fetch the live `RTCPeerConnection` for each peer. `simple-peer` exposes the underlying connection as `peer._pc`.

**Files:**
- Modify: `src/v2/call/PeerManager.tsx`
- Modify: `tests/unit/v2/call/PeerManager.test.tsx`

- [ ] **Step 1: Write the failing test**

In `tests/unit/v2/call/PeerManager.test.tsx`, add `_pc` to `mockPeerInstance` (near the top where it's defined):

```ts
const mockRTCConn = { getStats: jest.fn(), iceConnectionState: 'connected' as RTCIceConnectionState }
const mockPeerInstance = {
  on: jest.fn((event: string, cb: Function) => { peerCallbacks[event] = cb }),
  signal: jest.fn(),
  destroy: jest.fn(),
  addTrack: jest.fn(),
  destroyed: false,
  _pc: mockRTCConn,
}
```

Then add this test at the bottom of the file:

```ts
test('getPeerConnections returns RTCPeerConnection for each active peer', async () => {
  const ref = createRef<PeerManagerHandle>()
  await act(async () => { render(<PeerManager ref={ref} roomId="room-1" />) })
  act(() => {
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })
  const conns = ref.current?.getPeerConnections()
  expect(conns).toBeDefined()
  expect(conns?.size).toBe(1)
  expect(conns?.get('peer-a')).toBe(mockRTCConn)
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx jest tests/unit/v2/call/PeerManager.test.tsx --no-coverage -t "getPeerConnections" 2>&1 | tail -20
```

Expected: FAIL — `getPeerConnections is not a function`

- [ ] **Step 3: Add `getPeerConnections` to `PeerManager.tsx`**

In `src/v2/call/PeerManager.tsx`, add to the `PeerManagerHandle` interface:

```ts
export interface PeerManagerHandle {
  sendMessage: (text: string) => void
  sendReaction: (emoji: string) => void
  votePoll: (pollId: string, optionIndex: number) => void
  submitQuestion: (text: string) => void
  voteQuestion: (questionId: string) => void
  answerQuestion: (questionId: string, answer: string) => void
  getPeerConnections: () => Map<string, RTCPeerConnection>
}
```

Add to `useImperativeHandle` (after `answerQuestion`):

```ts
    getPeerConnections: () => {
      const result = new Map<string, RTCPeerConnection>()
      peerConnsRef.current.forEach((conn, id) => {
        const rtc = (conn.peer as unknown as { _pc: RTCPeerConnection | null })._pc
        if (rtc) result.set(id, rtc)
      })
      return result
    },
```

- [ ] **Step 4: Run the full PeerManager test suite**

```bash
npx jest tests/unit/v2/call/PeerManager.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/v2/call/PeerManager.tsx tests/unit/v2/call/PeerManager.test.tsx
git commit -m "feat(PeerManager): expose getPeerConnections() for AI quality polling"
```

---

## Task 4: Add AI Toggle Button to `ControlBar`

**Files:**
- Modify: `src/v2/call/ControlBar.tsx`
- Modify: `tests/unit/v2/call/ControlBar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `tests/unit/v2/call/ControlBar.test.tsx`:

```ts
test('AI button exists in control bar', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-ai')).toBeInTheDocument()
})

test('AI button toggles isAIOpen in store', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-ai'))
  expect(useUIStore.getState().isAIOpen).toBe(true)
  fireEvent.click(screen.getByTestId('btn-ai'))
  expect(useUIStore.getState().isAIOpen).toBe(false)
})

test('AI button renders with primary variant when isAIOpen', () => {
  useUIStore.setState({ isAIOpen: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-ai').className).toMatch(/bg-\[var\(--text-primary\)\]/)
})

test('opening AI closes chat (mutual exclusion)', () => {
  useUIStore.setState({ isChatOpen: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-ai'))
  expect(useUIStore.getState().isAIOpen).toBe(true)
  expect(useUIStore.getState().isChatOpen).toBe(false)
})
```

Also update the `beforeEach` in that file to include `isAIOpen: false`:

```ts
beforeEach(() => {
  useCallStore.setState({ isMuted: false, isCamOff: false })
  useUIStore.setState({ isChatOpen: false, isParticipantsOpen: false, isQAOpen: false, isAIOpen: false })
  jest.useFakeTimers()
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx jest tests/unit/v2/call/ControlBar.test.tsx --no-coverage -t "AI button" 2>&1 | tail -20
```

Expected: FAIL — `btn-ai` not found

- [ ] **Step 3: Update `ControlBar.tsx`**

Add to the imports from UIStore:

```ts
  const isAIOpen = useUIStore((s) => s.isAIOpen)
  const toggleAI = useUIStore((s) => s.toggleAI)
```

Add the button between the Q&A button and the Leave button:

```tsx
          <Button
            data-testid="btn-ai"
            variant={isAIOpen ? 'primary' : 'ghost'}
            onClick={toggleAI}
            aria-label="AI Insights"
          >
            🤖
          </Button>
```

- [ ] **Step 4: Run the full ControlBar test suite**

```bash
npx jest tests/unit/v2/call/ControlBar.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/v2/call/ControlBar.tsx tests/unit/v2/call/ControlBar.test.tsx
git commit -m "feat(ControlBar): add AI Insights toggle button"
```

---

## Task 5: Create `ConnectionQualityPredictions`

**Files:**
- Create: `src/v2/components/ai/ConnectionQualityPredictions.tsx`
- Create: `tests/unit/v2/components/ai/ConnectionQualityPredictions.test.tsx`

- [ ] **Step 1: Create the test file**

Create `tests/unit/v2/components/ai/ConnectionQualityPredictions.test.tsx`:

```tsx
import { render, act } from '@testing-library/react'
import { ConnectionQualityPredictions } from '../../../../src/v2/components/ai/ConnectionQualityPredictions'
import type { QualitySnapshot } from '../../../../src/v2/components/ai/ConnectionQualityPredictions'

function makeStatsReport(packetsLost: number, packetsReceived: number, jitter = 0.01, rtt = 0.05) {
  return new Map([
    ['entry-1', { type: 'remote-inbound-rtp', packetsLost, packetsReceived, jitter, currentRoundTripTime: rtt }],
  ])
}

function makeConn(packetsLost: number, packetsReceived: number, jitter = 0.01) {
  return {
    getStats: jest.fn().mockResolvedValue(makeStatsReport(packetsLost, packetsReceived, jitter)),
    iceConnectionState: 'connected' as RTCIceConnectionState,
  } as unknown as RTCPeerConnection
}

beforeEach(() => { jest.useFakeTimers() })
afterEach(() => { jest.useRealTimers() })

test('classifies Excellent when packet loss < 1%', async () => {
  const onQualityChange = jest.fn()
  const conn = makeConn(1, 199)  // 0.5% loss
  render(
    <ConnectionQualityPredictions
      getPeerConnections={() => new Map([['p1', conn]])}
      onQualityChange={onQualityChange}
    />
  )
  await act(async () => {})
  expect(onQualityChange).toHaveBeenCalledWith(expect.objectContaining({ worst: 'Excellent' }))
})

test('classifies Good when packet loss is 2%', async () => {
  const onQualityChange = jest.fn()
  const conn = makeConn(2, 98)  // 2% loss
  render(
    <ConnectionQualityPredictions
      getPeerConnections={() => new Map([['p1', conn]])}
      onQualityChange={onQualityChange}
    />
  )
  await act(async () => {})
  expect(onQualityChange).toHaveBeenCalledWith(expect.objectContaining({ worst: 'Good' }))
})

test('classifies Fair when packet loss is 5%', async () => {
  const onQualityChange = jest.fn()
  const conn = makeConn(5, 95)  // 5% loss
  render(
    <ConnectionQualityPredictions
      getPeerConnections={() => new Map([['p1', conn]])}
      onQualityChange={onQualityChange}
    />
  )
  await act(async () => {})
  expect(onQualityChange).toHaveBeenCalledWith(expect.objectContaining({ worst: 'Fair' }))
})

test('classifies Poor when packet loss > 8%', async () => {
  const onQualityChange = jest.fn()
  const conn = makeConn(10, 90)  // 10% loss
  render(
    <ConnectionQualityPredictions
      getPeerConnections={() => new Map([['p1', conn]])}
      onQualityChange={onQualityChange}
    />
  )
  await act(async () => {})
  expect(onQualityChange).toHaveBeenCalledWith(expect.objectContaining({ worst: 'Poor' }))
})

test('reports worst quality when multiple peers have different quality', async () => {
  const onQualityChange = jest.fn()
  const excellentConn = makeConn(0, 200)   // 0% → Excellent
  const poorConn = makeConn(10, 90)        // 10% → Poor
  render(
    <ConnectionQualityPredictions
      getPeerConnections={() => new Map([['p1', excellentConn], ['p2', poorConn]])}
      onQualityChange={onQualityChange}
    />
  )
  await act(async () => {})
  const snapshot: QualitySnapshot = onQualityChange.mock.calls[0][0]
  expect(snapshot.worst).toBe('Poor')
})

test('snapshot includes worstPacketLoss and worstJitter', async () => {
  const onQualityChange = jest.fn()
  const conn = makeConn(10, 90, 0.15)  // 10% loss, 0.15s = 150ms jitter
  render(
    <ConnectionQualityPredictions
      getPeerConnections={() => new Map([['p1', conn]])}
      onQualityChange={onQualityChange}
    />
  )
  await act(async () => {})
  const snapshot: QualitySnapshot = onQualityChange.mock.calls[0][0]
  expect(snapshot.worstPacketLoss).toBeCloseTo(10)
  expect(snapshot.worstJitter).toBeCloseTo(150)
})

test('clears interval on unmount', async () => {
  const clearIntervalSpy = jest.spyOn(global, 'clearInterval')
  const { unmount } = render(
    <ConnectionQualityPredictions
      getPeerConnections={() => new Map()}
      onQualityChange={jest.fn()}
    />
  )
  await act(async () => {})
  unmount()
  expect(clearIntervalSpy).toHaveBeenCalled()
  clearIntervalSpy.mockRestore()
})

test('calls onQualityChange with null worst when no connections', async () => {
  const onQualityChange = jest.fn()
  render(
    <ConnectionQualityPredictions
      getPeerConnections={() => new Map()}
      onQualityChange={onQualityChange}
    />
  )
  await act(async () => {})
  expect(onQualityChange).toHaveBeenCalledWith(expect.objectContaining({ worst: null }))
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx jest tests/unit/v2/components/ai/ConnectionQualityPredictions.test.tsx --no-coverage 2>&1 | tail -20
```

Expected: FAIL — cannot find module

- [ ] **Step 3: Create `src/v2/components/ai/ConnectionQualityPredictions.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'

export type Quality = 'Excellent' | 'Good' | 'Fair' | 'Poor'

export interface QualitySnapshot {
  worst: Quality | null
  worstPacketLoss: number
  worstJitter: number
  connections: Map<string, RTCPeerConnection>
}

interface PeerRow {
  peerId: string
  quality: Quality
  packetLoss: number
  jitter: number
  rtt: number
}

interface Props {
  getPeerConnections: () => Map<string, RTCPeerConnection> | undefined
  onQualityChange: (snapshot: QualitySnapshot) => void
}

const QUALITY_RANK: Record<Quality, number> = { Excellent: 0, Good: 1, Fair: 2, Poor: 3 }

function classify(packetLoss: number): Quality {
  if (packetLoss < 1) return 'Excellent'
  if (packetLoss < 3) return 'Good'
  if (packetLoss <= 8) return 'Fair'
  return 'Poor'
}

function worse(a: Quality, b: Quality): Quality {
  return QUALITY_RANK[a] >= QUALITY_RANK[b] ? a : b
}

const BADGE_COLOR: Record<Quality, string> = {
  Excellent: 'bg-green-500',
  Good: 'bg-blue-400',
  Fair: 'bg-yellow-400',
  Poor: 'bg-red-500',
}

export function ConnectionQualityPredictions({ getPeerConnections, onQualityChange }: Props) {
  const [rows, setRows] = useState<PeerRow[]>([])
  const callbackRef = useRef(onQualityChange)
  callbackRef.current = onQualityChange

  useEffect(() => {
    async function poll() {
      const conns = getPeerConnections()
      if (!conns || conns.size === 0) {
        setRows([])
        callbackRef.current({ worst: null, worstPacketLoss: 0, worstJitter: 0, connections: new Map() })
        return
      }

      const next: PeerRow[] = []
      for (const [peerId, rtc] of conns) {
        try {
          const report = await rtc.getStats()
          let packetLoss = 0
          let jitter = 0
          let rtt = 0
          report.forEach((entry) => {
            const e = entry as RTCStats & {
              packetsLost?: number
              packetsReceived?: number
              jitter?: number
              currentRoundTripTime?: number
            }
            if (e.type === 'remote-inbound-rtp') {
              const lost = e.packetsLost ?? 0
              const received = e.packetsReceived ?? 0
              const total = lost + received
              packetLoss = total > 0 ? (lost / total) * 100 : 0
              jitter = (e.jitter ?? 0) * 1000
              rtt = (e.currentRoundTripTime ?? 0) * 1000
            }
          })
          next.push({ peerId, quality: classify(packetLoss), packetLoss, jitter, rtt })
        } catch {
          // peer may have disconnected between getPeerConnections and getStats
        }
      }

      setRows(next)

      if (next.length === 0) {
        callbackRef.current({ worst: null, worstPacketLoss: 0, worstJitter: 0, connections: conns })
        return
      }

      let worst: Quality = 'Excellent'
      let worstPacketLoss = 0
      let worstJitter = 0
      for (const row of next) {
        worst = worse(worst, row.quality)
        if (row.packetLoss > worstPacketLoss) worstPacketLoss = row.packetLoss
        if (row.jitter > worstJitter) worstJitter = row.jitter
      }
      callbackRef.current({ worst, worstPacketLoss, worstJitter, connections: conns })
    }

    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [getPeerConnections])

  if (rows.length === 0) return null

  return (
    <div data-testid="connection-quality" className="flex flex-col gap-1">
      <p className="text-[var(--text-secondary)] text-[10px] font-semibold uppercase tracking-wide">
        Connection Quality
      </p>
      {rows.map((row) => (
        <div key={row.peerId} className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-primary)] truncate max-w-[140px]">{row.peerId}</span>
          <span
            className={`text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${BADGE_COLOR[row.quality]}`}
          >
            {row.quality}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest tests/unit/v2/components/ai/ConnectionQualityPredictions.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/v2/components/ai/ConnectionQualityPredictions.tsx tests/unit/v2/components/ai/ConnectionQualityPredictions.test.tsx
git commit -m "feat: ConnectionQualityPredictions — RTCPeerConnection.getStats() polling every 5s"
```

---

## Task 6: Create `TroubleshootingAssistant`

**Files:**
- Create: `src/v2/components/ai/TroubleshootingAssistant.tsx`
- Create: `tests/unit/v2/components/ai/TroubleshootingAssistant.test.tsx`

- [ ] **Step 1: Create the test file**

Create `tests/unit/v2/components/ai/TroubleshootingAssistant.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { TroubleshootingAssistant } from '../../../../src/v2/components/ai/TroubleshootingAssistant'
import { useCallStore } from '../../../../src/v2/store/useCallStore'

function makeConn(iceState: RTCIceConnectionState) {
  return { iceConnectionState: iceState } as unknown as RTCPeerConnection
}

beforeEach(() => {
  useCallStore.setState({ mediaError: null })
})

test('shows TURN message when any peer ICE state is failed', () => {
  render(
    <TroubleshootingAssistant
      peerConnections={new Map([['p1', makeConn('failed')]])}
      packetLoss={0}
      jitter={0}
    />
  )
  expect(screen.getByTestId('troubleshooting-assistant')).toBeInTheDocument()
  expect(screen.getByText(/TURN relay server/i)).toBeInTheDocument()
})

test('ICE failed takes priority over high packet loss', () => {
  render(
    <TroubleshootingAssistant
      peerConnections={new Map([['p1', makeConn('failed')]])}
      packetLoss={15}
      jitter={0}
    />
  )
  expect(screen.getByText(/TURN relay server/i)).toBeInTheDocument()
  expect(screen.queryByText(/background applications/i)).not.toBeInTheDocument()
})

test('shows background-apps message when packet loss > 8 and ICE ok', () => {
  render(
    <TroubleshootingAssistant
      peerConnections={new Map([['p1', makeConn('connected')]])}
      packetLoss={10}
      jitter={0}
    />
  )
  expect(screen.getByText(/background applications/i)).toBeInTheDocument()
})

test('shows wired message when jitter > 100 and packet loss ok', () => {
  render(
    <TroubleshootingAssistant
      peerConnections={new Map([['p1', makeConn('connected')]])}
      packetLoss={0}
      jitter={120}
    />
  )
  expect(screen.getByText(/wired.*Ethernet/i)).toBeInTheDocument()
})

test('shows media error message when mediaError is set', () => {
  useCallStore.setState({ mediaError: 'NotAllowedError' })
  render(
    <TroubleshootingAssistant
      peerConnections={new Map([['p1', makeConn('connected')]])}
      packetLoss={0}
      jitter={0}
    />
  )
  expect(screen.getByText(/browser settings/i)).toBeInTheDocument()
})

test('renders nothing when all metrics are healthy', () => {
  render(
    <TroubleshootingAssistant
      peerConnections={new Map([['p1', makeConn('connected')]])}
      packetLoss={0}
      jitter={0}
    />
  )
  expect(screen.queryByTestId('troubleshooting-assistant')).not.toBeInTheDocument()
})

test('dismiss button hides the card', () => {
  render(
    <TroubleshootingAssistant
      peerConnections={new Map([['p1', makeConn('failed')]])}
      packetLoss={0}
      jitter={0}
    />
  )
  expect(screen.getByTestId('troubleshooting-assistant')).toBeInTheDocument()
  fireEvent.click(screen.getByTestId('dismiss-btn'))
  expect(screen.queryByTestId('troubleshooting-assistant')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx jest tests/unit/v2/components/ai/TroubleshootingAssistant.test.tsx --no-coverage 2>&1 | tail -20
```

Expected: FAIL — cannot find module

- [ ] **Step 3: Create `src/v2/components/ai/TroubleshootingAssistant.tsx`**

```tsx
import { useState } from 'react'
import { useCallStore } from '../../store/useCallStore'

interface Props {
  peerConnections: Map<string, RTCPeerConnection>
  packetLoss: number
  jitter: number
}

function diagnose(
  peerConnections: Map<string, RTCPeerConnection>,
  packetLoss: number,
  jitter: number,
  mediaError: string | null,
): string | null {
  for (const rtc of peerConnections.values()) {
    if (rtc.iceConnectionState === 'failed') {
      return 'Connection blocked — check your firewall or try a different network. If the problem persists, a TURN relay server may be required.'
    }
  }
  if (packetLoss > 8) {
    return 'High packet loss detected — close background applications and pause any large downloads. Switching to a wired connection may help.'
  }
  if (jitter > 100) {
    return 'Unstable network — a wired (Ethernet) connection will significantly improve call stability.'
  }
  if (mediaError) {
    return 'Camera or microphone access was denied — open your browser settings and allow this site to use your devices.'
  }
  return null
}

export function TroubleshootingAssistant({ peerConnections, packetLoss, jitter }: Props) {
  const mediaError = useCallStore((s) => s.mediaError)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const message = diagnose(peerConnections, packetLoss, jitter, mediaError)
  if (!message) return null

  return (
    <div
      data-testid="troubleshooting-assistant"
      className="flex flex-col gap-2 p-3 bg-[var(--surface-raised)] border border-[var(--border-default)] rounded-lg text-xs"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span aria-hidden>⚠️</span>
          <p className="text-[var(--text-primary)] leading-relaxed">{message}</p>
        </div>
        <button
          data-testid="dismiss-btn"
          onClick={() => setDismissed(true)}
          className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] shrink-0"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest tests/unit/v2/components/ai/TroubleshootingAssistant.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/v2/components/ai/TroubleshootingAssistant.tsx tests/unit/v2/components/ai/TroubleshootingAssistant.test.tsx
git commit -m "feat: TroubleshootingAssistant — deterministic decision-tree diagnostic card"
```

---

## Task 7: Create `AIInsightsDashboard`

**Files:**
- Create: `src/v2/components/ai/AIInsightsDashboard.tsx`
- Create: `tests/unit/v2/components/ai/AIInsightsDashboard.test.tsx`

- [ ] **Step 1: Create the test file**

Create `tests/unit/v2/components/ai/AIInsightsDashboard.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react'
import { AIInsightsDashboard } from '../../../../src/v2/components/ai/AIInsightsDashboard'

const SAMPLE_METRICS = {
  connections: { total: 5, peak: 8, connectionRate: 3, byRoom: {} },
  messages: { totalSent: 42, totalReceived: 40, avgResponseTime: 12, errorCount: 0 },
  rooms: { active: 2, totalCreated: 10, averageParticipants: 2.5 },
}

beforeEach(() => {
  jest.useFakeTimers()
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

test('displays stat tiles when fetch succeeds', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => SAMPLE_METRICS,
  })
  await act(async () => { render(<AIInsightsDashboard />) })
  expect(screen.getByTestId('ai-insights-dashboard')).toBeInTheDocument()
  expect(screen.getByText('3')).toBeInTheDocument()   // connectionRate
  expect(screen.getByText('42')).toBeInTheDocument()  // totalSent
  expect(screen.getByText('12 ms')).toBeInTheDocument() // avgResponseTime
})

test('shows Metrics unavailable when fetch rejects', async () => {
  ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))
  await act(async () => { render(<AIInsightsDashboard />) })
  expect(screen.getByTestId('metrics-unavailable')).toBeInTheDocument()
})

test('shows Metrics unavailable when response is not ok', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 })
  await act(async () => { render(<AIInsightsDashboard />) })
  expect(screen.getByTestId('metrics-unavailable')).toBeInTheDocument()
})

test('re-fetches after 30s', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => SAMPLE_METRICS,
  })
  await act(async () => { render(<AIInsightsDashboard />) })
  expect(global.fetch).toHaveBeenCalledTimes(1)
  await act(async () => { jest.advanceTimersByTime(30_000) })
  expect(global.fetch).toHaveBeenCalledTimes(2)
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx jest tests/unit/v2/components/ai/AIInsightsDashboard.test.tsx --no-coverage 2>&1 | tail -20
```

Expected: FAIL — cannot find module

- [ ] **Step 3: Create `src/v2/components/ai/AIInsightsDashboard.tsx`**

```tsx
import { useEffect, useState } from 'react'

const METRICS_URL = (
  process.env.VITE_SIGNALING_SERVER_URL || 'wss://decentralize-video-app-2.onrender.com'
).replace(/^wss:/, 'https:').replace(/^ws:/, 'http:') + '/metrics'

interface Metrics {
  connections: { total: number; peak: number; connectionRate: number; byRoom: Record<string, number> }
  messages: { totalSent: number; totalReceived: number; avgResponseTime: number; errorCount: number }
  rooms: { active: number; totalCreated: number; averageParticipants: number }
}

function StatTile({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="text-[var(--text-primary)] font-semibold">
        {value}{unit ? ` ${unit}` : ''}
      </span>
    </div>
  )
}

export function AIInsightsDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch(METRICS_URL)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: Metrics = await res.json()
        setMetrics(data)
        setError(false)
        setLastUpdated(Date.now())
        setSecondsAgo(0)
      } catch {
        setError(true)
      }
    }

    fetchMetrics()
    const id = setInterval(fetchMetrics, 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (lastUpdated === null) return
    const id = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [lastUpdated])

  return (
    <div data-testid="ai-insights-dashboard" className="flex flex-col gap-3">
      <p className="text-[var(--text-secondary)] text-[10px] font-semibold uppercase tracking-wide">
        Server Insights
      </p>
      {error ? (
        <p data-testid="metrics-unavailable" className="text-[var(--text-muted)] text-xs">
          Metrics unavailable
        </p>
      ) : metrics ? (
        <>
          <div className="flex flex-col gap-2">
            <StatTile label="Connections/min" value={metrics.connections.connectionRate} unit="" />
            <StatTile label="Messages sent" value={metrics.messages.totalSent} unit="" />
            <StatTile label="Avg response" value={metrics.messages.avgResponseTime} unit="ms" />
          </div>
          {lastUpdated !== null && (
            <p className="text-[var(--text-muted)] text-[9px]">Updated {secondsAgo}s ago</p>
          )}
        </>
      ) : (
        <p className="text-[var(--text-muted)] text-xs">Loading…</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest tests/unit/v2/components/ai/AIInsightsDashboard.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/v2/components/ai/AIInsightsDashboard.tsx tests/unit/v2/components/ai/AIInsightsDashboard.test.tsx
git commit -m "feat: AIInsightsDashboard — live /metrics fetch with 30s polling"
```

---

## Task 8: Create `AISidePanel`

**Files:**
- Create: `src/v2/call/AISidePanel.tsx`
- Create: `tests/unit/v2/call/AISidePanel.test.tsx`

- [ ] **Step 1: Create the test file**

Create `tests/unit/v2/call/AISidePanel.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react'
import type { QualitySnapshot } from '../../../../src/v2/components/ai/ConnectionQualityPredictions'
import type { PeerManagerHandle } from '../../../../src/v2/call/PeerManager'
import { createRef } from 'react'

// Capture onQualityChange so tests can fire it directly
let capturedOnQualityChange: ((s: QualitySnapshot) => void) | null = null

jest.mock('../../../../src/v2/components/ai/ConnectionQualityPredictions', () => ({
  ConnectionQualityPredictions: ({ onQualityChange }: { onQualityChange: (s: QualitySnapshot) => void }) => {
    capturedOnQualityChange = onQualityChange
    return <div data-testid="mock-quality-predictions" />
  },
}))

jest.mock('../../../../src/v2/components/ai/TroubleshootingAssistant', () => ({
  TroubleshootingAssistant: () => <div data-testid="mock-troubleshooting" />,
}))

jest.mock('../../../../src/v2/components/ai/AIInsightsDashboard', () => ({
  AIInsightsDashboard: () => <div data-testid="mock-insights" />,
}))

function makeMockRef() {
  const ref = createRef<PeerManagerHandle>()
  ;(ref as { current: PeerManagerHandle }).current = {
    sendMessage: jest.fn(),
    sendReaction: jest.fn(),
    votePoll: jest.fn(),
    submitQuestion: jest.fn(),
    voteQuestion: jest.fn(),
    answerQuestion: jest.fn(),
    getPeerConnections: jest.fn(() => new Map()),
  }
  return ref
}

beforeEach(() => {
  capturedOnQualityChange = null
})

// Import after mocks
let AISidePanel: typeof import('../../../../src/v2/call/AISidePanel').AISidePanel

beforeAll(async () => {
  AISidePanel = (await import('../../../../src/v2/call/AISidePanel')).AISidePanel
})

test('renders all three sub-components', () => {
  render(<AISidePanel peerManagerRef={makeMockRef()} />)
  expect(screen.getByTestId('mock-quality-predictions')).toBeInTheDocument()
  expect(screen.getByTestId('mock-insights')).toBeInTheDocument()
})

test('TroubleshootingAssistant is hidden when quality is Good', () => {
  render(<AISidePanel peerManagerRef={makeMockRef()} />)
  act(() => {
    capturedOnQualityChange?.({ worst: 'Good', worstPacketLoss: 2, worstJitter: 20, connections: new Map() })
  })
  expect(screen.queryByTestId('mock-troubleshooting')).not.toBeInTheDocument()
})

test('TroubleshootingAssistant mounts when quality is Poor', () => {
  render(<AISidePanel peerManagerRef={makeMockRef()} />)
  act(() => {
    capturedOnQualityChange?.({ worst: 'Poor', worstPacketLoss: 10, worstJitter: 50, connections: new Map() })
  })
  expect(screen.getByTestId('mock-troubleshooting')).toBeInTheDocument()
})

test('TroubleshootingAssistant mounts when any peer ICE state is failed', () => {
  const failedConn = { iceConnectionState: 'failed' } as unknown as RTCPeerConnection
  render(<AISidePanel peerManagerRef={makeMockRef()} />)
  act(() => {
    capturedOnQualityChange?.({
      worst: 'Good',
      worstPacketLoss: 2,
      worstJitter: 20,
      connections: new Map([['p1', failedConn]]),
    })
  })
  expect(screen.getByTestId('mock-troubleshooting')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx jest tests/unit/v2/call/AISidePanel.test.tsx --no-coverage 2>&1 | tail -20
```

Expected: FAIL — cannot find module

- [ ] **Step 3: Create `src/v2/call/AISidePanel.tsx`**

```tsx
import { useRef, useState } from 'react'
import type { PeerManagerHandle } from './PeerManager'
import { ConnectionQualityPredictions, type QualitySnapshot } from '../components/ai/ConnectionQualityPredictions'
import { TroubleshootingAssistant } from '../components/ai/TroubleshootingAssistant'
import { AIInsightsDashboard } from '../components/ai/AIInsightsDashboard'

interface Props {
  peerManagerRef: React.RefObject<PeerManagerHandle>
}

function hasFailedPeer(connections: Map<string, RTCPeerConnection>): boolean {
  for (const rtc of connections.values()) {
    if (rtc.iceConnectionState === 'failed') return true
  }
  return false
}

export function AISidePanel({ peerManagerRef }: Props) {
  const [snapshot, setSnapshot] = useState<QualitySnapshot | null>(null)
  const getPeerConnsRef = useRef(() => peerManagerRef.current?.getPeerConnections())

  const showTroubleshooting =
    snapshot !== null &&
    (snapshot.worst === 'Poor' || hasFailedPeer(snapshot.connections))

  return (
    <div
      data-testid="ai-side-panel"
      className="w-[280px] shrink-0 border-l border-[var(--border-subtle)] flex flex-col gap-4 p-4 bg-[var(--surface-base)] overflow-y-auto"
    >
      <ConnectionQualityPredictions
        getPeerConnections={getPeerConnsRef.current}
        onQualityChange={setSnapshot}
      />
      {showTroubleshooting && snapshot && (
        <TroubleshootingAssistant
          peerConnections={snapshot.connections}
          packetLoss={snapshot.worstPacketLoss}
          jitter={snapshot.worstJitter}
        />
      )}
      <AIInsightsDashboard />
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest tests/unit/v2/call/AISidePanel.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/v2/call/AISidePanel.tsx tests/unit/v2/call/AISidePanel.test.tsx
git commit -m "feat: AISidePanel — quality snapshot state, conditional TroubleshootingAssistant"
```

---

## Task 9: Wire `AISidePanel` into `RoomV2` and verify full suite

**Files:**
- Modify: `src/v2/pages/RoomV2.tsx`
- Modify: `tests/unit/v2/pages/RoomV2.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit/v2/pages/RoomV2.test.tsx`:

```ts
test('AI side panel is hidden by default', async () => {
  await renderRoom()
  await screen.findByTestId('room-v2')
  expect(screen.queryByTestId('ai-side-panel')).not.toBeInTheDocument()
})

test('AI side panel appears when isAIOpen is true', async () => {
  await renderRoom()
  await screen.findByTestId('room-v2')
  act(() => { useUIStore.getState().toggleAI() })
  expect(await screen.findByTestId('ai-side-panel')).toBeInTheDocument()
})
```

Also update the `beforeEach` to reset `isAIOpen` and mock `fetch` (AIInsightsDashboard fetches /metrics when the panel is open):

```ts
beforeEach(() => {
  mockNavigate.mockClear()
  mockSocket.on.mockClear()
  mockSocket.once.mockClear()
  mockSocket.off.mockClear()
  mockSocket.emit.mockClear()
  mockSocket.disconnect.mockClear()
  jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(new Error('no cam'))
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 503 } as Response)
  useCallStore.setState({ userName: 'Ralph', isMuted: false, isCamOff: false, localStream: null, screenSharePeerId: null })
  useUIStore.setState({ isChatOpen: false, isParticipantsOpen: false, isAIOpen: false })
  useSessionStore.setState({ activePoll: null, pollResponses: {} })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx jest tests/unit/v2/pages/RoomV2.test.tsx --no-coverage -t "AI side panel" 2>&1 | tail -20
```

Expected: FAIL — `ai-side-panel` not found

- [ ] **Step 3: Update `RoomV2.tsx`**

Add import at the top:

```ts
import { AISidePanel } from '../call/AISidePanel'
```

Add to the store reads (after `isQAOpen`):

```ts
  const isAIOpen = useUIStore((s) => s.isAIOpen)
```

Add inside the panel flex container (after the `{isQAOpen && ...}` block):

```tsx
        {isAIOpen && (
          <AISidePanel peerManagerRef={peerManagerRef} />
        )}
```

The full updated `RoomV2.tsx`:

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
import { QAPanel } from '../call/QAPanel'
import { AISidePanel } from '../call/AISidePanel'

export default function RoomV2() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const peerManagerRef = useRef<PeerManagerHandle>(null)
  const userName = useCallStore((s) => s.userName)
  const resetCall = useCallStore((s) => s.reset)
  const isChatOpen = useUIStore((s) => s.isChatOpen)
  const isParticipantsOpen = useUIStore((s) => s.isParticipantsOpen)
  const isQAOpen = useUIStore((s) => s.isQAOpen)
  const isAIOpen = useUIStore((s) => s.isAIOpen)

  useEffect(() => {
    if (!userName) navigate(`/?redirect=/room/${roomId}`)
  }, [userName, roomId, navigate])

  return (
    <div className="v2 flex flex-col h-screen bg-[var(--surface-base)]" data-testid="room-v2">
      <MediaController />
      <PeerManager ref={peerManagerRef} roomId={roomId ?? ''} />

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
          <PollBanner onVotePoll={(id, idx) => peerManagerRef.current?.votePoll(id, idx)} />
          <ControlBar
            onEndCall={() => { resetCall(); navigate('/') }}
            onSendReaction={(emoji) => peerManagerRef.current?.sendReaction(emoji)}
          />
        </div>

        {isChatOpen && (
          <ChatPanel onSendMessage={(text) => peerManagerRef.current?.sendMessage(text)} />
        )}

        {isParticipantsOpen && (
          <ParticipantsPanel />
        )}

        {isQAOpen && (
          <QAPanel
            onSubmitQuestion={(text) => peerManagerRef.current?.submitQuestion(text)}
            onVoteQuestion={(id) => peerManagerRef.current?.voteQuestion(id)}
            onAnswerQuestion={(id, ans) => peerManagerRef.current?.answerQuestion(id, ans)}
          />
        )}

        {isAIOpen && (
          <AISidePanel peerManagerRef={peerManagerRef} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run RoomV2 tests**

```bash
npx jest tests/unit/v2/pages/RoomV2.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: PASS (all tests)

- [ ] **Step 5: Run the full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -20
```

Expected: All tests pass. Note the known 6 pre-existing integration failures — only new failures are a problem.

- [ ] **Step 6: Commit**

```bash
git add src/v2/pages/RoomV2.tsx tests/unit/v2/pages/RoomV2.test.tsx
git commit -m "feat: wire AISidePanel into RoomV2 behind isAIOpen toggle"
```

---

## Done When

- `npm test` passes (minus the 6 known pre-existing integration failures)
- All three AI components display live data when the AI panel is open during a call
- `TroubleshootingAssistant` is absent when healthy, present when a rule fires
- `AIInsightsDashboard` fetches `/metrics` and re-polls every 30s
- The 🤖 button in ControlBar opens/closes the AI panel with mutual exclusion
