# Route Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/room/:roomId` the single room route backed by RoomV2, remove `roomId` from `useCallStore`, and eliminate all legacy v1 routing artifacts.

**Architecture:** Seven sequential tasks, each committed independently. Tests are updated and run before each implementation so failures drive the code changes (TDD). The existing approved spec lives at `docs/superpowers/specs/2026-04-07-route-cutover-state-cleanup.md`.

**Tech Stack:** React 18, TypeScript, Zustand 4, react-router-dom 6, Jest 30, @testing-library/react 16

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `src/v2/store/useCallStore.ts` | Modify | Remove `roomId`/`setRoomId`, add `reset()` |
| `src/v2/call/PeerManager.tsx` | Modify | Accept `roomId` as required prop instead of reading from store |
| `src/v2/pages/RoomV2.tsx` | Modify | Remove `setRoomId` effect, add `userName` guard + redirect, pass `roomId` prop to PeerManager, call `reset()` on end call |
| `src/v2/pages/home/JoinForm.tsx` | Modify | Remove `setRoomId` call, navigate to `/room/` not `/v2/room/` |
| `src/v2/pages/home/PreflightPanel.tsx` | Modify | Navigate rejoin to `/room/` not `/v2/room/` |
| `src/App.jsx` | Modify | Single `/room/:roomId` route → RoomV2, remove old Room + Home routes + lazy imports |
| `src/components/Room.jsx` | Delete | Route removed — unreachable |
| `src/components/Home.jsx` | Delete | Only used by `/v2-legacy` route being removed |
| `src/components/Home-enhanced.jsx` | Delete | Unused variant of Home.jsx |
| `src/App.global-state.tsx` | Delete | Orphaned — never imported |
| `tests/unit/v2/stores/useCallStore.test.ts` | Modify | Remove `roomId`/`setRoomId` tests, add `reset()` tests |
| `tests/unit/v2/call/PeerManager.test.tsx` | Modify | Change store-based `roomId` setup to prop-based; update all renders; add 4 new tests |
| `tests/unit/v2/pages/RoomV2.test.tsx` | Modify | Fix route path, remove stale `setRoomId` test, add redirect/reset tests |
| `tests/unit/v2/pages/JoinForm.test.tsx` | Modify | Fix navigate assertions, remove `roomId` store assertions |
| `tests/unit/v2/pages/PreflightPanel.test.tsx` | Modify | Fix navigate assertion for rejoin |

---

## Task 1: Refactor `useCallStore` — remove `roomId`, add `reset()`

**Files:**
- Modify: `tests/unit/v2/stores/useCallStore.test.ts`
- Modify: `src/v2/store/useCallStore.ts`

- [ ] **Step 1.1: Update `useCallStore.test.ts` — remove `roomId` tests, add `reset()` tests**

Replace the entire file content:

```ts
import { useCallStore } from '../../../../src/v2/store/useCallStore'

beforeEach(() => {
  useCallStore.setState({
    localStream: null,
    isMuted: false,
    isCamOff: false,
    userName: '',
    screenSharePeerId: null,
  })
})

test('initial state has no roomId field', () => {
  expect('roomId' in useCallStore.getState()).toBe(false)
})

test('initial state is correct', () => {
  const state = useCallStore.getState()
  expect(state.localStream).toBeNull()
  expect(state.isMuted).toBe(false)
  expect(state.isCamOff).toBe(false)
  expect(state.userName).toBe('')
  expect(state.screenSharePeerId).toBeNull()
})

test('setUserName stores the user name', () => {
  useCallStore.getState().setUserName('Alice')
  expect(useCallStore.getState().userName).toBe('Alice')
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

test('setScreenSharePeerId sets and clears screen share', () => {
  useCallStore.getState().setScreenSharePeerId('peer-2')
  expect(useCallStore.getState().screenSharePeerId).toBe('peer-2')
  useCallStore.getState().setScreenSharePeerId(null)
  expect(useCallStore.getState().screenSharePeerId).toBeNull()
})

test('reset sets isMuted and isCamOff to false', () => {
  useCallStore.setState({ isMuted: true, isCamOff: true })
  useCallStore.getState().reset()
  expect(useCallStore.getState().isMuted).toBe(false)
  expect(useCallStore.getState().isCamOff).toBe(false)
})

test('reset does not clear userName', () => {
  useCallStore.setState({ userName: 'Ralph' })
  useCallStore.getState().reset()
  expect(useCallStore.getState().userName).toBe('Ralph')
})

test('reset does not clear localStream', () => {
  const stream = { getTracks: () => [] } as unknown as MediaStream
  useCallStore.setState({ localStream: stream })
  useCallStore.getState().reset()
  expect(useCallStore.getState().localStream).toBe(stream)
})
```

- [ ] **Step 1.2: Run tests — confirm failures**

```bash
npx jest tests/unit/v2/stores/useCallStore.test.ts --no-coverage
```

Expected: `initial state has no roomId field` FAILS (roomId still exists), `reset sets isMuted and isCamOff to false` FAILS (reset not defined).

- [ ] **Step 1.3: Rewrite `useCallStore.ts`**

Replace the entire file content:

```ts
import { create } from 'zustand'

interface CallStore {
  localStream: MediaStream | null
  isMuted: boolean
  isCamOff: boolean
  userName: string
  screenSharePeerId: string | null
  setLocalStream: (stream: MediaStream | null) => void
  setMuted: (value: boolean) => void
  setCamOff: (value: boolean) => void
  setUserName: (name: string) => void
  setScreenSharePeerId: (id: string | null) => void
  reset(): void
}

export const useCallStore = create<CallStore>((set) => ({
  localStream: null,
  isMuted: false,
  isCamOff: false,
  userName: '',
  screenSharePeerId: null,
  setLocalStream: (stream) => set({ localStream: stream }),
  setMuted: (value) => set({ isMuted: value }),
  setCamOff: (value) => set({ isCamOff: value }),
  setUserName: (name) => set({ userName: name }),
  setScreenSharePeerId: (id) => set({ screenSharePeerId: id }),
  reset: () => set({ isMuted: false, isCamOff: false }),
}))
```

- [ ] **Step 1.4: Run tests — confirm all pass**

```bash
npx jest tests/unit/v2/stores/useCallStore.test.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 1.5: Commit**

```bash
git add src/v2/store/useCallStore.ts tests/unit/v2/stores/useCallStore.test.ts
git commit -m "refactor(store): remove roomId from useCallStore, add reset()"
```

---

## Task 2: Refactor `PeerManager` — accept `roomId` as required prop

**Files:**
- Modify: `tests/unit/v2/call/PeerManager.test.tsx`
- Modify: `src/v2/call/PeerManager.tsx`

- [ ] **Step 2.1: Update `PeerManager.test.tsx` — switch from store-based roomId to prop-based**

Make these changes to the existing test file:

**a) `beforeEach` (line 72):** Change store init to remove `roomId`:
```ts
// Before:
useCallStore.setState({ roomId: 'room-1', userName: 'Ralph' })
// After:
useCallStore.setState({ userName: 'Ralph' })
```

**b) Every `render(<PeerManager />)` and `render(<PeerManager ref={ref} />)`:** Add `roomId="room-1"` prop. There are 22 occurrences. Do a find-and-replace:
- `render(<PeerManager />)` → `render(<PeerManager roomId="room-1" />)`
- `render(<PeerManager ref={ref} />)` → `render(<PeerManager ref={ref} roomId="room-1" />)`
- `unmount = render(<PeerManager />).unmount` → `unmount = render(<PeerManager roomId="room-1" />).unmount`

**c) Test "roomId change: emits user-leaving and disconnects…" (line 185):** Replace body:
```ts
test('roomId change: emits user-leaving and disconnects old socket before reconnecting', async () => {
  const { io } = require('socket.io-client')
  io.mockClear()
  mockSocket.disconnect.mockClear()
  mockSocket.emit.mockClear()

  let rerender!: ReturnType<typeof render>['rerender']
  await act(async () => {
    const result = render(<PeerManager roomId="room-1" />)
    rerender = result.rerender
  })
  expect(io).toHaveBeenCalledTimes(1)

  act(() => { rerender(<PeerManager roomId="room-2" />) })

  expect(mockSocket.emit).toHaveBeenCalledWith('user-leaving')
  expect(mockSocket.disconnect).toHaveBeenCalled()
  expect(io).toHaveBeenCalledTimes(2)
})
```

**d) Test "roomId cleared after connect…" (line 201):** Replace body:
```ts
test('roomId cleared after connect: disconnects and does not reconnect', async () => {
  const { io } = require('socket.io-client')
  io.mockClear()
  mockSocket.disconnect.mockClear()

  let rerender!: ReturnType<typeof render>['rerender']
  await act(async () => {
    const result = render(<PeerManager roomId="room-1" />)
    rerender = result.rerender
  })
  expect(io).toHaveBeenCalledTimes(1)

  act(() => { rerender(<PeerManager roomId="" />) })

  expect(mockSocket.disconnect).toHaveBeenCalled()
  expect(io).toHaveBeenCalledTimes(1)
})
```

**e) Test "does not connect when roomId is empty" (line 215):** Replace body:
```ts
test('does not connect when roomId prop is empty', async () => {
  const { io } = require('socket.io-client')
  io.mockClear()
  useCallStore.setState({ userName: 'Ralph' })
  await act(async () => { render(<PeerManager roomId="" />) })
  expect(io).not.toHaveBeenCalled()
})
```

**f) Add 3 new tests after the last existing test:**
```ts
test('does not connect when userName is empty', async () => {
  const { io } = require('socket.io-client')
  io.mockClear()
  useCallStore.setState({ userName: '' })
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  expect(io).not.toHaveBeenCalled()
})

test('does not reconnect when unrelated store field changes', async () => {
  const { io } = require('socket.io-client')
  io.mockClear()
  useCallStore.setState({ userName: 'Ralph' })
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  expect(io).toHaveBeenCalledTimes(1)

  act(() => { useCallStore.getState().setMuted(true) })
  expect(io).toHaveBeenCalledTimes(1)
})

test('reset() does not trigger reconnect', async () => {
  const { io } = require('socket.io-client')
  io.mockClear()
  useCallStore.setState({ userName: 'Ralph', isMuted: true })
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  expect(io).toHaveBeenCalledTimes(1)

  act(() => { useCallStore.getState().reset() })
  expect(io).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2.2: Run tests — confirm failures**

```bash
npx jest tests/unit/v2/call/PeerManager.test.tsx --no-coverage
```

Expected: TypeScript/prop errors or test failures because `<PeerManager roomId="room-1" />` is not accepted yet (prop not defined). The 3 new tests also fail.

- [ ] **Step 2.3: Update `PeerManager.tsx` — accept `roomId` as prop**

Make two changes:

**a) Add `PeerManagerProps` interface** after the existing `PeerManagerHandle` interface (after line 20):
```ts
interface PeerManagerProps {
  roomId: string
}
```

**b) Change `forwardRef` signature and remove store selector for `roomId`:**

Replace (lines 33–39):
```ts
export const PeerManager = forwardRef<PeerManagerHandle>((_, ref) => {
  const socketRef = useRef<Socket | null>(null)
  const peerConnsRef = useRef<Map<string, { peer: InstanceType<typeof Peer>; name: string; role: 'host' | 'guest' }>>(new Map())
  const reactionTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const iceServersRef = useRef<RTCIceServer[]>(ICE_SERVERS)
  const roomId = useCallStore((s) => s.roomId)
  const userName = useCallStore((s) => s.userName)
```

With:
```ts
export const PeerManager = forwardRef<PeerManagerHandle, PeerManagerProps>(({ roomId }, ref) => {
  const socketRef = useRef<Socket | null>(null)
  const peerConnsRef = useRef<Map<string, { peer: InstanceType<typeof Peer>; name: string; role: 'host' | 'guest' }>>(new Map())
  const reactionTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const iceServersRef = useRef<RTCIceServer[]>(ICE_SERVERS)
  const userName = useCallStore((s) => s.userName)
```

No other changes needed — `roomId` is still named `roomId` so all usages inside the component remain unchanged.

- [ ] **Step 2.4: Run tests — confirm all pass**

```bash
npx jest tests/unit/v2/call/PeerManager.test.tsx --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 2.5: Commit**

```bash
git add src/v2/call/PeerManager.tsx tests/unit/v2/call/PeerManager.test.tsx
git commit -m "refactor(PeerManager): accept roomId as prop, remove store dependency"
```

---

## Task 3: Refactor `RoomV2` — URL owns roomId, redirect guard, `reset()` on end call

**Files:**
- Modify: `tests/unit/v2/pages/RoomV2.test.tsx`
- Modify: `src/v2/pages/RoomV2.tsx`

- [ ] **Step 3.1: Update `RoomV2.test.tsx`**

**a) Fix `renderRoom` helper** — change route from `/v2/room/` to `/room/`:
```tsx
async function renderRoom(roomId = 'test-room') {
  const RoomV2 = (await import('../../../../src/v2/pages/RoomV2')).default
  return render(
    <MemoryRouter initialEntries={[`/room/${roomId}`]}>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/room/:roomId" element={<RoomV2 />} />
        </Routes>
      </Suspense>
    </MemoryRouter>
  )
}
```

**b) Fix `beforeEach`** — remove `roomId: ''` from `useCallStore.setState`:
```ts
beforeEach(() => {
  mockNavigate.mockClear()
  mockSocket.on.mockClear()
  mockSocket.once.mockClear()
  mockSocket.off.mockClear()
  mockSocket.emit.mockClear()
  mockSocket.disconnect.mockClear()
  jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(new Error('no cam'))
  useCallStore.setState({ userName: 'Ralph', isMuted: false, isCamOff: false, localStream: null, screenSharePeerId: null })
  useUIStore.setState({ isChatOpen: false, isParticipantsOpen: false })
  useSessionStore.setState({ activePoll: null, pollResponses: {} })
})
```

**c) Remove the stale test** "syncs roomId route param to store" — delete the entire test block (lines 63–67). This test verified the old behavior of writing `roomId` to the store, which no longer happens.

**d) Add 4 new tests** after the last existing test in the file:
```tsx
test('redirects to /?redirect=/room/:id when userName is empty', async () => {
  useCallStore.setState({ userName: '' })
  await renderRoom('abc123')
  await screen.findByTestId('room-v2')
  expect(mockNavigate).toHaveBeenCalledWith('/?redirect=/room/abc123')
})

test('does not redirect when userName is set', async () => {
  useCallStore.setState({ userName: 'Ralph' })
  await renderRoom('abc123')
  await screen.findByTestId('room-v2')
  expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('redirect'))
})

test('passes roomId from URL params to PeerManager via socket emit', async () => {
  useCallStore.setState({ userName: 'Ralph' })
  await renderRoom('xyz789')
  await screen.findByTestId('room-v2')
  act(() => {
    const connectCb = mockSocket.on.mock.calls.find(([event]: [string]) => event === 'connect')?.[1]
    if (connectCb) connectCb()
  })
  expect(mockSocket.emit).toHaveBeenCalledWith('request-room-token',
    expect.objectContaining({ roomId: 'xyz789' })
  )
})

test('end call resets isMuted and isCamOff before navigating', async () => {
  useCallStore.setState({ userName: 'Ralph', isMuted: true, isCamOff: true })
  const { findByTestId } = await renderRoom()
  await findByTestId('room-v2')
  fireEvent.click(screen.getByTestId('btn-end-call'))
  expect(useCallStore.getState().isMuted).toBe(false)
  expect(useCallStore.getState().isCamOff).toBe(false)
  expect(mockNavigate).toHaveBeenCalledWith('/')
})
```

- [ ] **Step 3.2: Run tests — confirm failures**

```bash
npx jest tests/unit/v2/pages/RoomV2.test.tsx --no-coverage
```

Expected: the 4 new tests FAIL, and the route-path-based tests fail because the route string changed but the component hasn't been updated yet.

- [ ] **Step 3.3: Rewrite `RoomV2.tsx`**

Replace the entire file content:

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
  const userName = useCallStore((s) => s.userName)
  const isChatOpen = useUIStore((s) => s.isChatOpen)
  const isParticipantsOpen = useUIStore((s) => s.isParticipantsOpen)

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
          <PollBanner />
          <ControlBar
            onEndCall={() => { useCallStore.getState().reset(); navigate('/') }}
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

- [ ] **Step 3.4: Run tests — confirm all pass**

```bash
npx jest tests/unit/v2/pages/RoomV2.test.tsx --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 3.5: Commit**

```bash
git add src/v2/pages/RoomV2.tsx tests/unit/v2/pages/RoomV2.test.tsx
git commit -m "refactor(RoomV2): URL owns roomId, redirect guard, reset() on end call"
```

---

## Task 4: Refactor `JoinForm` — remove `setRoomId`, fix navigate paths

**Files:**
- Modify: `tests/unit/v2/pages/JoinForm.test.tsx`
- Modify: `src/v2/pages/home/JoinForm.tsx`

- [ ] **Step 4.1: Update `JoinForm.test.tsx`**

**a) Fix `beforeEach`** — remove `roomId: ''`:
```ts
beforeEach(() => {
  mockNavigate.mockClear()
  useCallStore.setState({ userName: '' })
})
```

**b) Fix "Create Room navigates to a new room id" test** — update regex:
```ts
test('Create Room navigates to a new room id when room field is empty', () => {
  wrap(<JoinForm />)
  fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Ralph' } })
  fireEvent.click(screen.getByText(/create room/i))
  expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/room\/.+/))
})
```

**c) Fix "Join navigates to the entered room id" test** — update path:
```ts
test('Join navigates to the entered room id', () => {
  wrap(<JoinForm />)
  fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Ralph' } })
  fireEvent.change(screen.getByPlaceholderText(/room id/i), { target: { value: 'design-sync' } })
  fireEvent.click(screen.getByText(/join/i))
  expect(mockNavigate).toHaveBeenCalledWith('/room/design-sync')
})
```

**d) Replace "Create Room persists name and roomId to store" test** — remove `roomId` assertion:
```ts
test('Create Room persists name to store', () => {
  wrap(<JoinForm />)
  fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Ralph' } })
  fireEvent.click(screen.getByText(/create room/i))
  expect(useCallStore.getState().userName).toBe('Ralph')
})
```

**e) Replace "Join persists name and roomId to store" test** — remove `roomId` assertion:
```ts
test('Join persists name to store', () => {
  wrap(<JoinForm />)
  fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Alice' } })
  fireEvent.change(screen.getByPlaceholderText(/room id/i), { target: { value: 'design-sync' } })
  fireEvent.click(screen.getByText(/join/i))
  expect(useCallStore.getState().userName).toBe('Alice')
})
```

**f) Add new test** after the last existing test:
```ts
test('does not write roomId to store on submit', () => {
  wrap(<JoinForm />)
  fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Alice' } })
  fireEvent.change(screen.getByPlaceholderText(/room id/i), { target: { value: 'design-sync' } })
  fireEvent.click(screen.getByText(/join/i))
  expect('roomId' in useCallStore.getState()).toBe(false)
})
```

- [ ] **Step 4.2: Run tests — confirm failures**

```bash
npx jest tests/unit/v2/pages/JoinForm.test.tsx --no-coverage
```

Expected: "Create Room navigates" and "Join navigates" FAIL because JoinForm still navigates to `/v2/room/...`. The "does not write roomId" test passes immediately since the store no longer has `roomId`.

- [ ] **Step 4.3: Update `JoinForm.tsx`**

**a) Remove `setRoomIdStore` selector** (line 15 — delete this line):
```ts
// DELETE this line:
const setRoomIdStore = useCallStore((s) => s.setRoomId)
```

**b) Replace `handleCreate`:**
```ts
function handleCreate() {
  const id = roomId.trim() || generateRoomId()
  setUserName(name.trim())
  navigate(`/room/${id}`)
}
```

**c) Replace `handleJoin`:**
```ts
function handleJoin() {
  const id = roomId.trim()
  setUserName(name.trim())
  navigate(`/room/${id}`)
}
```

- [ ] **Step 4.4: Run tests — confirm all pass**

```bash
npx jest tests/unit/v2/pages/JoinForm.test.tsx --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 4.5: Commit**

```bash
git add src/v2/pages/home/JoinForm.tsx tests/unit/v2/pages/JoinForm.test.tsx
git commit -m "refactor(JoinForm): remove setRoomId, navigate to /room/ not /v2/room/"
```

---

## Task 5: Update `PreflightPanel` — fix rejoin navigate path

**Files:**
- Modify: `tests/unit/v2/pages/PreflightPanel.test.tsx`
- Modify: `src/v2/pages/home/PreflightPanel.tsx`

- [ ] **Step 5.1: Update `PreflightPanel.test.tsx`**

Find the test "clicking recent room navigates to its route" (inside the `describe('recent rooms from localStorage')` block) and replace it:
```ts
test('clicking recent room navigates to its route', () => {
  const rooms = [{ id: 'room-xyz', name: 'Team Call', lastVisited: Date.now() - 60000 }]
  localStorage.setItem('velo_recent_rooms', JSON.stringify(rooms))
  wrap(<PreflightPanel />)
  fireEvent.click(screen.getByText('Team Call'))
  expect(mockNavigate).toHaveBeenCalledWith('/room/room-xyz')
})
```

- [ ] **Step 5.2: Run tests — confirm the one navigate test fails**

```bash
npx jest tests/unit/v2/pages/PreflightPanel.test.tsx --no-coverage
```

Expected: "clicking recent room navigates to its route" FAILS.

- [ ] **Step 5.3: Update `PreflightPanel.tsx`** — fix navigate path (line 116)

Replace:
```tsx
onClick={() => navigate(`/v2/room/${room.id}`)}
```
With:
```tsx
onClick={() => navigate(`/room/${room.id}`)}
```

- [ ] **Step 5.4: Run tests — confirm all pass**

```bash
npx jest tests/unit/v2/pages/PreflightPanel.test.tsx --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 5.5: Commit**

```bash
git add src/v2/pages/home/PreflightPanel.tsx tests/unit/v2/pages/PreflightPanel.test.tsx
git commit -m "fix(PreflightPanel): rejoin navigates to /room/ not /v2/room/"
```

---

## Task 6: Update `App.jsx` — single route, remove legacy imports

**Files:**
- Modify: `src/App.jsx`

No new tests needed — routing changes are covered by the RoomV2 and JoinForm tests already updated above.

- [ ] **Step 6.1: Rewrite `App.jsx`**

Replace the entire file content:

```jsx
import { useEffect, useState, Suspense, lazy } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

const HomeV2 = lazy(() => import('./v2/pages/HomeV2'));
const RoomV2 = lazy(() => import('./v2/pages/RoomV2'));

function App() {
  const [dark, _setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">Loading...</span>
          </div>
        }>
          <Routes>
            <Route path="/room/:roomId" element={<RoomV2 />} />
            <Route path="/" element={<HomeV2 />} />
          </Routes>
        </Suspense>
      </Router>
      <PWAInstallPrompt />
    </ErrorBoundary>
  );
}

export default App;
```

- [ ] **Step 6.2: Verify build compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds with no import errors. If build fails with a TypeScript error about `useCallStore` missing `roomId` or `setRoomId`, grep for remaining usages:

```bash
grep -r "setRoomId\|\.roomId" src/ --include="*.ts" --include="*.tsx" --include="*.js"
```

Fix any remaining callsites before continuing.

- [ ] **Step 6.3: Commit**

```bash
git add src/App.jsx
git commit -m "refactor(App): single /room/:roomId route → RoomV2, remove legacy routes"
```

---

## Task 7: Delete orphaned files and verify clean build

**Files:**
- Delete: `src/components/Room.jsx`
- Delete: `src/components/Home.jsx`
- Delete: `src/components/Home-enhanced.jsx`
- Delete: `src/App.global-state.tsx`

- [ ] **Step 7.1: Verify nothing still imports these files**

```bash
grep -r "from.*components/Room\|from.*components/Home\|App\.global-state" src/ --include="*.ts" --include="*.tsx" --include="*.jsx" --include="*.js"
```

Expected: no output. If any matches appear, fix those imports before deleting.

- [ ] **Step 7.2: Delete the four orphaned files**

```bash
rm src/components/Room.jsx
rm src/components/Home.jsx
rm "src/components/Home-enhanced.jsx"
rm src/App.global-state.tsx
```

- [ ] **Step 7.3: Verify build still passes**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds. If it fails with a missing module error, the grep in step 7.1 missed something — check the error path and fix the import.

- [ ] **Step 7.4: Run the full v2 test suite**

```bash
npx jest --testPathPattern="tests/unit/v2" --no-coverage
```

Expected: all tests PASS. Note the final counts — report pass/fail numbers.

- [ ] **Step 7.5: Commit deletion**

```bash
git add -A
git commit -m "chore: delete orphaned v1 files (Room.jsx, Home.jsx, App.global-state.tsx)"
```

---

## Done When

- [ ] `npm run build` succeeds with no errors
- [ ] All tests in `tests/unit/v2/` pass
- [ ] `/room/:roomId` navigates to RoomV2 (verified in the browser or via test)
- [ ] `/v2/room/:roomId` no longer exists as a route
- [ ] `useCallStore` has no `roomId` field and has a `reset()` method
- [ ] `PeerManager` accepts `roomId` as a required prop
- [ ] `src/components/Room.jsx`, `src/components/Home.jsx`, `src/components/Home-enhanced.jsx`, `src/App.global-state.tsx` are deleted
