# Branch Coverage Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Parallelism note:** All three tasks touch different test files. They are fully independent and can be dispatched simultaneously — but since they share the same git working tree, run them sequentially to avoid commit collisions.

**Goal:** Close 13 of the 14 uncovered branches identified by lcov, bringing branch coverage from 91.86% (158/172) to ~99.4% (171/172).

**Architecture:** Tests only — zero production code changes. The 14th branch (`PreflightPanel.tsx:49` — `if (videoRef.current)` true arm) is a defensive guard against an unmount race: the `<video>` element is not in the DOM when `.then()` fires because React batches the `setCamReady(true)` state update, so `videoRef.current` is always null at that moment in jsdom. Testing it would require mocking React ref internals. Skipped intentionally.

**Tech Stack:** Jest, @testing-library/react, Zustand stores, jsdom

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

---

## File map

| File | Action | Branches closed |
|------|--------|----------------|
| `tests/unit/v2/call/PeerManager.test.tsx` | Modify | 3 — role fallback in all-users, role fallback in user-joined, conn guard in receiving-returned-signal |
| `tests/unit/v2/pages/home/PreflightPanel.test.tsx` | Modify | 6 — isActive room styling, participantCount display, name→id fallback |
| `tests/unit/v2/call/ControlBar.test.tsx` | Modify | 1 — cleanup before timer fires |
| `tests/unit/v2/call/SpotlightView.test.tsx` | Modify | 1 — userName empty string fallback |
| `tests/unit/v2/pages/RoomV2.test.tsx` | Modify | 1 — roomId empty on initial mount |
| `tests/unit/v2/call/ParticipantsPanel.test.tsx` | Modify | 1 — connectionState neither connected nor failed |

---

## Task 1: PeerManager — three missing branches

**Files:**
- Modify: `tests/unit/v2/call/PeerManager.test.tsx`

**Branches to close:**
1. `PeerManager.tsx:105` — `role ?? 'guest'` in `all-users`: role field absent from payload. All existing tests pass `role: 'host'` or `role: 'guest'` explicitly; the `?? 'guest'` fallback is never triggered.
2. `PeerManager.tsx:123` — `peerRole ?? 'guest'` in `user-joined`: same — role always provided in tests.
3. `PeerManager.tsx:143` — `if (conn && !conn.peer.destroyed)` in `receiving-returned-signal`: existing test covers the truthy path (conn exists, not destroyed). The false path (conn not found for the given id) is never exercised.

**Key patterns from the existing test file:**
- `fireSocketEvent('all-users', [...])` fires all registered `all-users` callbacks.
- `fireSocketEvent('receiving-returned-signal', { signal, id })` fires the handler.
- `mockPeerInstance.signal` is already spied — check it was or was not called.

---

- [ ] **Step 1: Read the existing test file**

```bash
cat tests/unit/v2/call/PeerManager.test.tsx
```

Confirm: `fireSocketEvent` helper is defined, `mockSocket` and `mockPeerInstance` are set up, `beforeEach` clears all mocks.

---

- [ ] **Step 2: Write the three failing tests**

Append at the end of `tests/unit/v2/call/PeerManager.test.tsx`:

```tsx
test('all-users defaults role to guest when role field is absent', async () => {
  await act(async () => { render(<PeerManager />) })
  act(() => {
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice' }]) // no role field
  })
  expect(usePeerStore.getState().peers.get('peer-a')?.role).toBe('guest')
})

test('user-joined defaults role to guest when role field is absent', async () => {
  await act(async () => { render(<PeerManager />) })
  act(() => {
    fireSocketEvent('user-joined', { callerID: 'peer-b', name: 'Bob', signal: null }) // no role
  })
  expect(usePeerStore.getState().peers.get('peer-b')?.role).toBe('guest')
})

test('receiving-returned-signal does nothing when conn not found', async () => {
  await act(async () => { render(<PeerManager />) })
  // Fire event for an ID that was never added via all-users — conn will be undefined
  act(() => {
    fireSocketEvent('receiving-returned-signal', { signal: { type: 'answer', sdp: 'x' }, id: 'unknown-peer' })
  })
  expect(mockPeerInstance.signal).not.toHaveBeenCalled()
})
```

---

- [ ] **Step 3: Run to verify they fail**

```bash
npx jest tests/unit/v2/call/PeerManager.test.tsx --no-coverage -t "defaults role|does nothing when conn"
```

Expected: all three new tests fail — `role` is always provided in existing fixtures so `?? 'guest'` is never reached, and `receiving-returned-signal` without setup currently throws or has no assertion to fail on. Actually these tests may pass immediately if the code already handles the cases. Run them and check — if they pass without any code change, the branches are already covered and the lcov report was stale. Proceed to Step 4 either way.

---

- [ ] **Step 4: Run the full PeerManager test file**

```bash
npx jest tests/unit/v2/call/PeerManager.test.tsx --no-coverage
```

Expected: all tests pass (was 38 tests, now 41).

---

- [ ] **Step 5: Commit**

```bash
git add tests/unit/v2/call/PeerManager.test.tsx
git commit -m "$(cat <<'EOF'
test(PeerManager): cover role fallback and missing-conn branches

Three uncovered branches: role ?? 'guest' in all-users, role ?? 'guest'
in user-joined (both only hit when server omits the role field), and
conn && guard in receiving-returned-signal (hit when signal arrives for
an unknown peer ID).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: PreflightPanel — active room branches

**Files:**
- Modify: `tests/unit/v2/pages/home/PreflightPanel.test.tsx`

**Branches to close (all in the `recentRooms.map(...)` block):**
- `PreflightPanel.tsx:120` — `room.isActive ? 'bg-accent-live...' : 'bg-surface-hover...'` true arm
- `PreflightPanel.tsx:122` — `room.isActive ? 'text-primary' : 'text-secondary'` true arm
- `PreflightPanel.tsx:123` — `room.name || room.id` — the `|| room.id` fallback when name is empty
- `PreflightPanel.tsx:125` — `{room.isActive && room.participantCount && ...}` — true branch (both truthy) AND false branch when isActive=true but participantCount is falsy
- `PreflightPanel.tsx:133` — `room.isActive ? 'text-accent-live' : 'text-muted'` true arm

All existing tests seed rooms with `isActive` absent (falsy). Active rooms are never tested.

**Note on `PreflightPanel.tsx:49`:** This is the `if (videoRef.current) videoRef.current.srcObject = s` true arm inside the getUserMedia `.then()`. In jsdom, `videoRef.current` is null when `.then()` fires because the `<video>` element only renders after `setCamReady(true)` is processed by React — which happens after `.then()` returns. This branch is intentionally left uncovered.

---

- [ ] **Step 1: Read the existing test file**

```bash
cat tests/unit/v2/pages/home/PreflightPanel.test.tsx
```

Key things to note:
- The `recent rooms from localStorage` describe block seeds `localStorage` before rendering and clears it in `afterEach`.
- The `formatRelative time display` describe block mocks `Date.now`.
- All existing room fixtures have no `isActive` field (falsy by default).

---

- [ ] **Step 2: Write the failing tests**

Add a new describe block at the end of `tests/unit/v2/pages/home/PreflightPanel.test.tsx`:

```tsx
// ---------------------------------------------------------------------------
// Group D — active room branches
// ---------------------------------------------------------------------------
describe('active room display', () => {
  afterEach(() => localStorage.clear())

  test('shows live dot and accent text for active room', () => {
    const rooms = [{ id: 'room-1', name: 'Standup', lastVisited: Date.now(), isActive: true }]
    localStorage.setItem('velo_recent_rooms', JSON.stringify(rooms))
    wrap(<PreflightPanel />)
    // The status dot should use the live accent class (bg-[var(--accent-live)])
    const dot = document.querySelector('[class*="accent-live"]')
    expect(dot).toBeInTheDocument()
  })

  test('shows participant count when room is active and participantCount is set', () => {
    const rooms = [{ id: 'room-1', name: 'Standup', lastVisited: Date.now(), isActive: true, participantCount: 5 }]
    localStorage.setItem('velo_recent_rooms', JSON.stringify(rooms))
    wrap(<PreflightPanel />)
    expect(screen.getByText('5 active')).toBeInTheDocument()
  })

  test('does not show participant count when isActive but participantCount is absent', () => {
    const rooms = [{ id: 'room-1', name: 'Standup', lastVisited: Date.now(), isActive: true }]
    localStorage.setItem('velo_recent_rooms', JSON.stringify(rooms))
    wrap(<PreflightPanel />)
    expect(screen.queryByText(/active/)).not.toBeInTheDocument()
  })

  test('falls back to room.id when name is empty string', () => {
    const rooms = [{ id: 'room-xyz', name: '', lastVisited: Date.now() }]
    localStorage.setItem('velo_recent_rooms', JSON.stringify(rooms))
    wrap(<PreflightPanel />)
    expect(screen.getByText('room-xyz')).toBeInTheDocument()
  })
})
```

---

- [ ] **Step 3: Run to verify the tests behave as expected**

```bash
npx jest tests/unit/v2/pages/home/PreflightPanel.test.tsx --no-coverage
```

Expected: all tests pass (the production code already handles these cases — we are exercising untested paths, not fixing bugs).

---

- [ ] **Step 4: Confirm branch coverage improved for PreflightPanel**

```bash
npx jest tests/unit/v2/pages/home/PreflightPanel.test.tsx --coverage --collectCoverageFrom="src/v2/pages/home/PreflightPanel.tsx" --coverageReporters=text
```

Expected: branches column shows improvement from 83.3% toward ~97%+.

---

- [ ] **Step 5: Commit**

```bash
git add tests/unit/v2/pages/home/PreflightPanel.test.tsx
git commit -m "$(cat <<'EOF'
test(PreflightPanel): cover active room branches — isActive, participantCount, name fallback

Active rooms were never tested: the isActive styling branches, the
participantCount display conditional, and the room.name || room.id
fallback when name is empty string. All were exercising only the
inactive-room path.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Four small single-branch gaps

**Files:**
- Modify: `tests/unit/v2/call/ControlBar.test.tsx`
- Modify: `tests/unit/v2/call/SpotlightView.test.tsx`
- Modify: `tests/unit/v2/pages/RoomV2.test.tsx`
- Modify: `tests/unit/v2/call/ParticipantsPanel.test.tsx`

**Branches to close:**

| File | Line | Branch | What to test |
|------|------|--------|-------------|
| ControlBar.tsx | 39 | `if (timerRef.current) clearTimeout(...)` false arm | Unmount immediately after mount, before the 3-second auto-hide timer fires |
| SpotlightView.tsx | 47 | `userName \|\| 'You'` false arm | Set `userName` to empty string in `useCallStore` |
| RoomV2.tsx | 23 | `if (roomId) setRoomId(roomId)` false arm | Render RoomV2 with empty `roomId` route param |
| ParticipantsPanel.tsx | 31 | Third arm of connectionState ternary (neither `'connected'` nor `'failed'`) | Create a peer with `connectionState: 'connecting'` |

**Key patterns:**
- ControlBar tests use `jest.useFakeTimers()` in `beforeEach` — the cleanup-before-timer test must use `jest.useRealTimers()` or unmount within a fake-timer context before advancing time.
- SpotlightView test: `useCallStore.setState({ userName: '' })` before rendering.
- RoomV2 test: render with route `/v2/room/` (empty segment) or use `initialEntries={['/v2/room/']}` with param `roomId = ''`.
- ParticipantsPanel test uses `usePeerStore.setState({ peers: new Map([...]) })`.

---

- [ ] **Step 1: Read the four existing test files**

```bash
cat tests/unit/v2/call/ControlBar.test.tsx
cat tests/unit/v2/call/SpotlightView.test.tsx
cat tests/unit/v2/pages/RoomV2.test.tsx
cat tests/unit/v2/call/ParticipantsPanel.test.tsx
```

For ControlBar: confirm `beforeEach` calls `jest.useFakeTimers()` and `afterEach` calls `jest.useRealTimers()`. The unmount-before-timer test must opt into real timers so it can actually unmount and call cleanup synchronously.

For SpotlightView: read how `useCallStore` is seeded (likely `useCallStore.setState({ ... })` in `beforeEach`).

---

- [ ] **Step 2: Write the four failing tests**

**ControlBar** — append at end of `tests/unit/v2/call/ControlBar.test.tsx`:

```tsx
test('cleanup does not throw when timer was never set (immediate unmount)', () => {
  // Use real timers so we can unmount before the 3-second hide timer fires
  jest.useRealTimers()
  const { unmount } = render(<ControlBar onEndCall={jest.fn()} />)
  // Unmount immediately — timerRef.current is null because the timer
  // fires after 3000ms and we never advanced time
  expect(() => unmount()).not.toThrow()
})
```

**SpotlightView** — append at end of `tests/unit/v2/call/SpotlightView.test.tsx`:

```tsx
test('falls back to "You" when userName is empty string', async () => {
  useCallStore.setState({ userName: '' })
  const { findByText } = render(<SpotlightView />)
  expect(await findByText('You')).toBeInTheDocument()
})
```

**RoomV2** — append at end of `tests/unit/v2/pages/RoomV2.test.tsx`:

```tsx
test('does not call setRoomId when roomId param is empty', async () => {
  await renderRoom('')
  await screen.findByTestId('room-v2')
  // roomId stays as whatever it was in the store — not overwritten with empty string
  expect(useCallStore.getState().roomId).not.toBe('')
})
```

**ParticipantsPanel** — append at end of `tests/unit/v2/call/ParticipantsPanel.test.tsx`:

```tsx
test('shows gray dot for peer with connecting state', () => {
  usePeerStore.setState({
    peers: new Map([['peer-1', makePeer({ connectionState: 'connecting' })]])
  })
  render(<ParticipantsPanel />)
  const dot = screen.getByTestId('peer-status-peer-1')
  expect(dot).not.toHaveClass('bg-[var(--accent-live)]')
  expect(dot).not.toHaveClass('bg-[var(--accent-danger)]')
})
```

---

- [ ] **Step 3: Run each file to verify the tests pass**

```bash
npx jest tests/unit/v2/call/ControlBar.test.tsx --no-coverage
npx jest tests/unit/v2/call/SpotlightView.test.tsx --no-coverage
npx jest tests/unit/v2/pages/RoomV2.test.tsx --no-coverage
npx jest tests/unit/v2/call/ParticipantsPanel.test.tsx --no-coverage
```

Expected: all tests pass in all four files.

---

- [ ] **Step 4: Run the full suite**

```bash
npx jest --coverage --coverageReporters=text-summary
```

Expected: all 21 suites pass, branch coverage ≥ 99% (171/172).

---

- [ ] **Step 5: Commit**

```bash
git add \
  tests/unit/v2/call/ControlBar.test.tsx \
  tests/unit/v2/call/SpotlightView.test.tsx \
  tests/unit/v2/pages/RoomV2.test.tsx \
  tests/unit/v2/call/ParticipantsPanel.test.tsx
git commit -m "$(cat <<'EOF'
test(v2): cover four single-branch gaps across ControlBar, SpotlightView, RoomV2, ParticipantsPanel

- ControlBar: cleanup path when timerRef is null (unmount before timer fires)
- SpotlightView: userName empty string falls back to 'You'
- RoomV2: if (roomId) guard false arm when route param is empty
- ParticipantsPanel: connectionState 'connecting' renders the gray dot (third ternary arm)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review

**Spec coverage:**
- ControlBar:39 → Task 3 ✅
- ParticipantsPanel:31 → Task 3 ✅
- PeerManager:105 → Task 1 ✅
- PeerManager:123 → Task 1 ✅
- PeerManager:143 → Task 1 ✅
- SpotlightView:47 → Task 3 ✅
- RoomV2:23 → Task 3 ✅
- PreflightPanel:49 → intentionally skipped (documented in Architecture) ✅
- PreflightPanel:120/122/123/125/133 → Task 2 ✅

**Placeholder scan:** None found.

**Type consistency:** `makePeer` helper in ParticipantsPanel.test.tsx accepts `Partial<PeerRecord>` overrides — `connectionState: 'connecting'` is a valid `PeerRecord['connectionState']` value.
