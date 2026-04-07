# Route Cutover & State Cleanup Design Spec

**Date:** 2026-04-07  
**Status:** Approved

---

## Goal

Eliminate the chain reaction caused by two routes sharing one Zustand store, and make the URL the single source of truth for `roomId`.

---

## Problem

Two room routes exist in `App.jsx`:
- `/room/:roomId` → old `Room.jsx`
- `/v2/room/:roomId` → `RoomV2`

Both share `useCallStore`. `roomId` is written from two places — `JoinForm` before navigation and `RoomV2`'s `useEffect` after mount — creating an implicit timing dependency:

```
URL params → RoomV2 useEffect → setRoomId (store write) → PeerManager useEffect fires
JoinForm also writes store before nav → two writers, race-prone ordering
```

`useCallStore` never resets between sessions, so stale `roomId`/`userName`/`isMuted`/`isCamOff` carry into the next call.

---

## Design

### Routing

Single route for rooms: `/room/:roomId` → `RoomV2`.

- Remove `<Route path="/room/:roomId" element={<Room />} />` (old Room)
- Rename `<Route path="/v2/room/:roomId" ...>` → `<Route path="/room/:roomId" ...>`
- Remove `<Route path="/v2-legacy" element={<Home />} />`
- Remove lazy imports for `Room` and `Home` from `App.jsx`
- Delete `src/App.global-state.tsx` (orphaned, never imported)

### State — roomId removed from store

`roomId` is derivable from the URL. It does not belong in the store.

```ts
// useCallStore after
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
  reset(): void  // clears isMuted→false, isCamOff→false
}
```

`localStream` is not reset in `reset()` — `MediaController`'s effect cleanup handles it on unmount. `userName` is intentionally kept so returning users don't re-enter their name.

### Data flow after fix

```
URL params (/room/:roomId)
  → RoomV2 reads via useParams
  → passes roomId as prop to <PeerManager roomId={roomId} />
  → PeerManager fires once on mount with the prop value
  No store write. No chain.
```

### PeerManager

Accepts `roomId` as a required prop instead of reading from `useCallStore`:

```tsx
interface PeerManagerProps {
  roomId: string
}

export const PeerManager = forwardRef<PeerManagerHandle, PeerManagerProps>(
  ({ roomId }, ref) => {
    // roomId comes from prop, not store
    const userName = useCallStore((s) => s.userName)
    // ...
  }
)
```

The existing guard `if (!roomId || !userName) return` remains unchanged.

### JoinForm

Removes `setRoomId` entirely. Only sets `userName` and navigates:

```tsx
function handleCreate() {
  const id = roomId.trim() || generateRoomId()
  setUserName(name.trim())
  navigate(`/room/${id}`)
}

function handleJoin() {
  setUserName(name.trim())
  navigate(`/room/${roomId.trim()}`)
}
```

### RoomV2

Removes `setRoomId` useEffect. Passes `roomId` from `useParams` directly to `PeerManager`:

```tsx
export default function RoomV2() {
  const { roomId } = useParams<{ roomId: string }>()
  // No useEffect calling setRoomId
  // ...
  return (
    // ...
    <PeerManager ref={peerManagerRef} roomId={roomId ?? ''} />
    // ...
  )
}
```

### Direct URL navigation (no userName)

If a user lands on `/room/abc123` without going through JoinForm, `userName` is empty. RoomV2 checks on mount:

```tsx
useEffect(() => {
  if (!userName) navigate(`/?redirect=/room/${roomId}`)
}, [userName, roomId, navigate])
```

JoinForm reads the `redirect` query param and navigates there after the user submits their name.

### End-call reset

`ControlBar.onEndCall` calls `reset()` before navigating home:

```tsx
onEndCall={() => {
  useCallStore.getState().reset()
  navigate('/')
}}
```

### PreflightPanel

Updates rejoin navigation from `/v2/room/${room.id}` → `/room/${room.id}`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/App.jsx` | Remove old Room route + lazy import, rename `/v2/room/` → `/room/`, remove `/v2-legacy` route + Home import |
| `src/v2/store/useCallStore.ts` | Remove `roomId` + `setRoomId`, add `reset()` |
| `src/v2/pages/RoomV2.tsx` | Remove `setRoomId` useEffect, add `userName` guard + redirect, pass `roomId` prop to PeerManager |
| `src/v2/call/PeerManager.tsx` | Accept `roomId` as prop, remove store selector |
| `src/v2/pages/home/JoinForm.tsx` | Remove `setRoomId` call, update navigate to `/room/` |
| `src/v2/pages/home/PreflightPanel.tsx` | Update navigate to `/room/` |
| `src/v2/call/ControlBar.tsx` | Call `reset()` in `onEndCall` |

## Files Deleted

| File | Reason |
|------|--------|
| `src/components/Room.jsx` | Route removed — unreachable |
| `src/components/Home.jsx` | Only used by `/v2-legacy` route being removed |
| `src/components/Home-enhanced.jsx` | Unused variant of Home.jsx |
| `src/App.global-state.tsx` | Orphaned — never imported |

## Tests

### `tests/unit/v2/store/useCallStore.test.ts` (new file)

```ts
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

### `tests/unit/v2/call/PeerManager.test.tsx` (updated)

All existing tests replace `useCallStore.setState({ roomId: 'room-1', userName: 'Ralph' })` with:
```tsx
useCallStore.setState({ userName: 'Ralph' })
render(<PeerManager roomId="room-1" />)
```

New tests:

```tsx
test('does not connect when roomId prop is empty', async () => {
  const { io } = require('socket.io-client')
  io.mockClear()
  useCallStore.setState({ userName: 'Ralph' })
  await act(async () => { render(<PeerManager roomId="" />) })
  expect(io).not.toHaveBeenCalled()
})

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

  // Changing isMuted must not trigger a new socket connection
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

### `tests/integration/v2/PeerManager.integration.test.tsx` (updated)

Replace `useCallStore.setState({ roomId: 'room-1', userName: 'Ralph' })` with:
```tsx
useCallStore.setState({ userName: 'Ralph' })
// render passes roomId as prop
render(<PeerManager roomId="room-1" />)
```

### `tests/unit/v2/pages/JoinForm.test.tsx` (updated)

```tsx
test('navigates to /room/${id} on create', async () => {
  // fill name + click Create — assert navigate called with /room/... not /v2/room/...
  expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/room\//))
})

test('does not write roomId to store on submit', async () => {
  const before = useCallStore.getState()
  // fill name + roomId + click Join
  // store should have userName but no roomId key
  expect(useCallStore.getState().userName).toBe('Alice')
  expect('roomId' in useCallStore.getState()).toBe(false)
})
```

### `tests/unit/v2/pages/RoomV2.test.tsx` (updated)

```tsx
test('redirects to /?redirect=/room/:id when userName is empty', async () => {
  useCallStore.setState({ userName: '' })
  render(<RoomV2 />) // route: /room/abc123
  expect(mockNavigate).toHaveBeenCalledWith('/?redirect=/room/abc123')
})

test('does not redirect when userName is set', async () => {
  useCallStore.setState({ userName: 'Ralph' })
  render(<RoomV2 />)
  expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('redirect'))
})

test('passes roomId from URL params to PeerManager', async () => {
  useCallStore.setState({ userName: 'Ralph' })
  render(<RoomV2 />) // route: /room/xyz789
  // PeerManager rendered with roomId="xyz789"
  expect(screen.getByTestId('peer-manager')).toHaveAttribute('data-room-id', 'xyz789')
  // OR assert via mock: PeerManager mock captures the roomId prop
})
```

### `tests/unit/v2/call/ControlBar.test.tsx` (updated)

```tsx
test('onEndCall calls reset() before navigating', () => {
  useCallStore.setState({ isMuted: true, isCamOff: true })
  const onEndCall = jest.fn()
  render(<ControlBar onEndCall={onEndCall} />)
  // fire end call button
  fireEvent.click(screen.getByTestId('btn-end-call'))
  expect(onEndCall).toHaveBeenCalled()
  // reset is called by the parent — verify it in RoomV2 test instead
})

// In RoomV2.test.tsx:
test('end call resets mute and cam state', async () => {
  useCallStore.setState({ userName: 'Ralph', isMuted: true, isCamOff: true })
  render(<RoomV2 />) // route: /room/abc123
  fireEvent.click(screen.getByTestId('btn-end-call'))
  expect(useCallStore.getState().isMuted).toBe(false)
  expect(useCallStore.getState().isCamOff).toBe(false)
  expect(mockNavigate).toHaveBeenCalledWith('/')
})
```

---

## Failure Modes

| Scenario | Behaviour |
|----------|-----------|
| Direct URL nav, no userName | Redirect to `/?redirect=/room/:id` — user fills name, lands in room |
| End call, rejoin same room | `reset()` clears mute/cam state; fresh join |
| End call, rejoin different room | Same — fresh state each time |
| Stale `userName` on return visit | Kept intentionally — user can overwrite in JoinForm |
