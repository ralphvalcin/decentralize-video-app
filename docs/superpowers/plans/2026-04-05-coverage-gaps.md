# Coverage Gaps — Test Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Parallelism note:** Tasks 2, 3, and 4 are fully independent (different test files). Dispatch them simultaneously after Task 1 is reviewed and committed.

**Goal:** Close the branch/statement coverage gaps identified after the Task 10 test run, prioritising real failure-mode paths over cosmetic edge cases.

**Architecture:** Tests only — no production code changes. Each task adds tests to an existing test file. All mocks follow the patterns already established in those files (event-capturing simple-peer mock, socket callbacks dict, store setState in beforeEach). Read the existing test file before writing anything.

**Tech Stack:** Jest + @testing-library/react + Zustand stores + jest fake timers (ControlBar) + jsdom

---

## Context for every subagent

Working directory: `/Users/ralphucious/App Builds/decentralized-video-app/.worktrees/v2-modernization`

Run tests with:
```bash
npx jest <test-file-path> --no-coverage
```

Run full suite to confirm nothing regressed:
```bash
npx jest --coverage --coverageReporters=text-summary
```

All coverage thresholds (branches 70, functions/lines/statements 80) must stay green after your task.

Commit message must end with:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Write commit messages to `/tmp/<taskN>-commit.txt` and use `git commit -F /tmp/<taskN>-commit.txt` (avoids hook issues with `.env` in message body).

---

## Task 1 (CRITICAL): PeerManager — peer error + signal callbacks

**Why critical:** These are real WebRTC failure paths. `peer error` sets `connectionState: 'failed'` and destroys the connection. The `signal` callbacks emit the actual WebRTC offer/answer over the socket. Neither is exercised today.

**Files:**
- Modify: `tests/unit/v2/call/PeerManager.test.tsx`

**Key context:**
- The existing mock captures peer events: `on: jest.fn((event, cb) => { peerCallbacks[event] = cb })`
- Fire a peer event with: `peerCallbacks['error']?.(new Error('ice fail'))`
- `mockPeerInstance.destroyed` starts as `false`; set it to `true` to simulate an already-destroyed peer
- `destroyPeerConn` guard lives in PeerManager source line ~69: `if (conn && !conn.peer.destroyed) conn.peer.destroy()`
- For signal callbacks, the peer's `signal` event needs to fire AFTER the peer is created via `all-users` or `user-joined`
- `socket.emit` is already spied — check it was called with the right event name and payload

- [ ] **Step 1: Read the existing test file**

```bash
cat tests/unit/v2/call/PeerManager.test.tsx
```

Understand: how `peerCallbacks` is populated, how `fireSocketEvent` works, how `mockPeerInstance` is shared.

- [ ] **Step 2: Write the failing tests**

Add these four tests at the end of `tests/unit/v2/call/PeerManager.test.tsx`:

```tsx
test('peer error sets connectionState failed and destroys conn', async () => {
  await act(async () => { render(<PeerManager />) })
  act(() => {
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })
  act(() => { peerCallbacks['error']?.(new Error('ice fail')) })
  expect(usePeerStore.getState().peers.get('peer-a')?.connectionState).toBe('failed')
  expect(mockPeerInstance.destroy).toHaveBeenCalled()
})

test('peer error logs message without throwing', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  await act(async () => { render(<PeerManager />) })
  act(() => {
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })
  act(() => { peerCallbacks['error']?.(new Error('ice fail')) })
  expect(spy).toHaveBeenCalledWith('[PeerManager] peer error:', 'peer-a', 'ice fail')
  spy.mockRestore()
})

test('initiator peer signal callback emits sending-signal', async () => {
  mockSocket.emit.mockClear()
  await act(async () => { render(<PeerManager />) })
  act(() => {
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })
  act(() => { peerCallbacks['signal']?.({ type: 'offer', sdp: 'sdp-offer' }) })
  expect(mockSocket.emit).toHaveBeenCalledWith('sending-signal', expect.objectContaining({
    userToSignal: 'peer-a',
    signal: { type: 'offer', sdp: 'sdp-offer' },
  }))
})

test('receiver peer signal callback emits returning-signal', async () => {
  mockSocket.emit.mockClear()
  await act(async () => { render(<PeerManager />) })
  act(() => {
    fireSocketEvent('user-joined', { signal: { type: 'offer', sdp: 'sdp' }, callerID: 'peer-b', name: 'Bob', role: 'guest' })
  })
  act(() => { peerCallbacks['signal']?.({ type: 'answer', sdp: 'sdp-answer' }) })
  expect(mockSocket.emit).toHaveBeenCalledWith('returning-signal', expect.objectContaining({
    callerID: 'peer-b',
    signal: { type: 'answer', sdp: 'sdp-answer' },
  }))
})

test('destroyPeerConn skips destroy when peer already destroyed', async () => {
  await act(async () => { render(<PeerManager />) })
  act(() => {
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })
  mockPeerInstance.destroyed = true
  mockPeerInstance.destroy.mockClear()
  act(() => { fireSocketEvent('user-left', 'peer-a') })
  expect(mockPeerInstance.destroy).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Run to verify they fail (or pass — either is fine, confirm they run)**

```bash
npx jest tests/unit/v2/call/PeerManager.test.tsx --no-coverage -t "peer error|signal callback|skips destroy"
```

- [ ] **Step 4: Run full PeerManager suite**

```bash
npx jest tests/unit/v2/call/PeerManager.test.tsx --no-coverage
```

Expected: all tests pass (new tests should pass immediately — production code is already correct, tests were just missing).

- [ ] **Step 5: Commit**

```bash
cat > /tmp/task1-commit.txt << 'EOF'
test(v2/PeerManager): cover peer error, signal callbacks, destroyed guard

- peer error: sets connectionState:'failed', destroys conn, logs message
- initiator signal: fires sending-signal socket emit with offer
- receiver signal: fires returning-signal socket emit with answer
- destroyPeerConn guard: skips destroy when peer.destroyed is already true

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
git add tests/unit/v2/call/PeerManager.test.tsx
git commit -F /tmp/task1-commit.txt
```

---

## Task 2 (HIGH — parallel after Task 1): RoomV2 callback lambdas

**Why:** `onEndCall`, `onSendReaction`, and `onSendMessage` are inline lambdas passed as props in RoomV2. They route through `peerManagerRef.current` to PeerManager. Coverage counts these as uncovered functions. More importantly: if the ref wiring breaks, reactions and chat silently stop working — no error thrown.

**Files:**
- Modify: `tests/unit/v2/pages/RoomV2.test.tsx`

**Key context:**
- Existing tests already import and render `RoomV2` via `renderRoom()`
- `mockSocket` is already defined at top of that file (no `io` export mock)
- The existing mock does NOT capture socket callbacks (`on: jest.fn()` but no callback dict) — that's fine, these tests don't need socket events
- `jest.useFakeTimers()` needed to prevent ControlBar's real `setTimeout` from causing act() warnings. Add to `beforeEach` / `afterEach`
- To test `onEndCall`: click `data-testid="btn-end-call"` → `mockNavigate` is already mocked at the top of the file
- To test `onSendReaction`: click `data-testid="btn-reactions"`, then click the `👍` button
- To test `onSendMessage`: first set `isChatOpen: true`, then interact with `data-testid="chat-input"` and `data-testid="chat-send"`
- `peerManagerRef.current` will be null in tests (PeerManager renders null and the ref is set via `forwardRef`/`useImperativeHandle` which needs socket — but the optional chain `?.` means no crash). The test verifies the lambda fires without throwing, not that PeerManager received it.

- [ ] **Step 1: Read the existing test file**

```bash
cat tests/unit/v2/pages/RoomV2.test.tsx
```

- [ ] **Step 2: Write the failing tests**

Add at the end of `tests/unit/v2/pages/RoomV2.test.tsx`:

```tsx
test('end call navigates to /', async () => {
  const { findByTestId } = await renderRoom()
  await findByTestId('room-v2')
  fireEvent.click(screen.getByTestId('btn-end-call'))
  expect(mockNavigate).toHaveBeenCalledWith('/')
})

test('reaction from ControlBar flows through ref without throwing', async () => {
  const { findByTestId } = await renderRoom()
  await findByTestId('room-v2')
  fireEvent.click(screen.getByTestId('btn-reactions'))
  expect(() => fireEvent.click(screen.getByText('👍'))).not.toThrow()
})

test('sendMessage from ChatPanel flows through ref without throwing', async () => {
  const { findByTestId } = await renderRoom()
  await findByTestId('room-v2')
  useUIStore.getState().toggleChat()
  const input = await screen.findByTestId('chat-input')
  fireEvent.change(input, { target: { value: 'Hello' } })
  expect(() => fireEvent.click(screen.getByTestId('chat-send'))).not.toThrow()
})
```

Also add `import { fireEvent } from '@testing-library/react'` to the import line if not already present (check the existing imports first).

- [ ] **Step 4: Run the suite**

```bash
npx jest tests/unit/v2/pages/RoomV2.test.tsx --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cat > /tmp/task2-commit.txt << 'EOF'
test(v2/RoomV2): exercise callback lambdas — end call, reaction, sendMessage

onEndCall navigates to '/'. onSendReaction and onSendMessage flow through
peerManagerRef optional chain without throwing even when ref is null.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
git add tests/unit/v2/pages/RoomV2.test.tsx
git commit -F /tmp/task2-commit.txt
```

---

## Task 3 (HIGH — parallel after Task 1): ChatPanel keyboard branch gaps

**Why:** Two branches in `handleSend` and `handleKeyDown` are never exercised: the empty-text early return, and the Shift+Enter guard. These protect against accidental sends — silent regressions if they break.

**Files:**
- Modify: `tests/unit/v2/call/ChatPanel.test.tsx`

**Key context:**
- `handleSend` line 25: `if (!text) return` — fires when `input.trim()` is empty. The send button is disabled when empty (so clicking it won't fire onClick), but Enter key is not blocked at the DOM level — only by the `if (!text) return` guard inside `handleSend`.
- `handleKeyDown` line 31: `if (e.key === 'Enter' && !e.shiftKey)` — the `e.shiftKey` path is never tested (Shift+Enter should NOT send).
- To fire Enter on empty input: `fireEvent.keyDown(input, { key: 'Enter' })` WITHOUT first setting a value.
- To fire Shift+Enter: `fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })`

- [ ] **Step 1: Read the existing test file**

```bash
cat tests/unit/v2/call/ChatPanel.test.tsx
```

- [ ] **Step 2: Write the failing tests**

Add at the end of `tests/unit/v2/call/ChatPanel.test.tsx`:

```tsx
test('Enter on empty input does not call onSendMessage', () => {
  const onSendMessage = jest.fn()
  render(<ChatPanel onSendMessage={onSendMessage} />)
  // No value set — input is empty
  fireEvent.keyDown(screen.getByTestId('chat-input'), { key: 'Enter' })
  expect(onSendMessage).not.toHaveBeenCalled()
})

test('Shift+Enter does not send message', () => {
  const onSendMessage = jest.fn()
  render(<ChatPanel onSendMessage={onSendMessage} />)
  fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'Draft' } })
  fireEvent.keyDown(screen.getByTestId('chat-input'), { key: 'Enter', shiftKey: true })
  expect(onSendMessage).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Run the suite**

```bash
npx jest tests/unit/v2/call/ChatPanel.test.tsx --no-coverage
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cat > /tmp/task3-commit.txt << 'EOF'
test(v2/ChatPanel): cover empty-text guard and Shift+Enter no-send branch

Enter on empty input fires handleSend but early-returns before calling
onSendMessage. Shift+Enter skips the send path entirely. Both branches
were dead to the test runner before.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
git add tests/unit/v2/call/ChatPanel.test.tsx
git commit -F /tmp/task3-commit.txt
```

---

## Task 4 (MEDIUM — parallel after Task 1): Minor gaps — ThumbnailStrip, ControlBar cleanup, VideoTile stream

**Why:** Three small uncovered branches across three files. Best batched together as they're quick.

**Files:**
- Modify: `tests/unit/v2/call/ThumbnailStrip.test.tsx`
- Modify: `tests/unit/v2/call/ControlBar.test.tsx`
- Modify: `tests/unit/v2/ui/VideoTile.test.tsx`

**Key context:**

*ThumbnailStrip line 19 — `userName || 'You'`:*
- The `|| 'You'` fallback fires when `userName` is `''` or `null`
- `beforeEach` sets `userName: 'Ralph'` — override in test with `useCallStore.setState({ userName: '' })`

*ControlBar line 34 — `if (timerRef.current) clearTimeout(timerRef.current)` in cleanup:*
- This fires when unmounting while a timer is still pending (timer hasn't fired yet)
- `beforeEach` already calls `jest.useFakeTimers()` in this file
- Pattern: render → DO NOT advance timers → unmount → `clearTimeout` branch fires
- The timer starts in `useEffect` on mount via `resetTimer()` so `timerRef.current` is non-null immediately

*VideoTile line 32 — `if (videoRef.current && stream)`:*
- jsdom doesn't set `videoRef.current.srcObject` on a real video element — the ref IS attached (jsdom creates the element), but `srcObject` is a getter/setter that jsdom doesn't implement
- The `&& stream` branch: render with `stream={null}` (already tested implicitly) vs `stream={fakeStream}`
- Provide a fake stream object and check the effect fires without throwing (can't assert `srcObject` in jsdom, but at minimum confirm no crash)

- [ ] **Step 1: Read all three existing test files**

```bash
cat tests/unit/v2/call/ThumbnailStrip.test.tsx
cat tests/unit/v2/call/ControlBar.test.tsx
cat tests/unit/v2/ui/VideoTile.test.tsx
```

- [ ] **Step 2: Add ThumbnailStrip userName fallback test**

Add at the end of `tests/unit/v2/call/ThumbnailStrip.test.tsx`:

```tsx
test('shows "You" when userName is empty', () => {
  useCallStore.setState({ userName: '' })
  render(<ThumbnailStrip />)
  expect(screen.getByText('You')).toBeInTheDocument()
})
```

- [ ] **Step 3: Add ControlBar cleanup clearTimeout test**

Add at the end of `tests/unit/v2/call/ControlBar.test.tsx`. The file already uses `jest.useFakeTimers()` in `beforeEach`:

```tsx
test('cleanup clears pending timer on unmount', () => {
  const clearSpy = jest.spyOn(global, 'clearTimeout')
  const { unmount } = render(<ControlBar onEndCall={jest.fn()} />)
  // Timer is active immediately after mount (resetTimer called in useEffect)
  // Unmount before advancing time — cleanup should call clearTimeout
  unmount()
  expect(clearSpy).toHaveBeenCalled()
  clearSpy.mockRestore()
})
```

- [ ] **Step 4: Add VideoTile stream-assignment test**

Read `tests/unit/v2/ui/VideoTile.test.tsx` first. Then add:

```tsx
test('renders video element when stream provided and cam on', () => {
  const fakeStream = { id: 'stream-1' } as unknown as MediaStream
  render(
    <VideoTile
      peerId="peer-1"
      name="Alice"
      stream={fakeStream}
      isMuted={false}
      isCamOff={false}
      networkQuality="good"
      isAway={false}
      reaction={null}
      hasRaisedHand={false}
    />
  )
  // Video element rendered (not avatar fallback)
  expect(document.querySelector('video')).toBeInTheDocument()
})
```

- [ ] **Step 5: Run all three suites**

```bash
npx jest tests/unit/v2/call/ThumbnailStrip.test.tsx tests/unit/v2/call/ControlBar.test.tsx tests/unit/v2/ui/VideoTile.test.tsx --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cat > /tmp/task4-commit.txt << 'EOF'
test(v2): cover ThumbnailStrip fallback, ControlBar cleanup, VideoTile stream

- ThumbnailStrip: userName empty → shows 'You' fallback
- ControlBar: unmount before timer fires → clearTimeout called in cleanup
- VideoTile: stream + cam-on → video element rendered (not avatar)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
git add tests/unit/v2/call/ThumbnailStrip.test.tsx tests/unit/v2/call/ControlBar.test.tsx tests/unit/v2/ui/VideoTile.test.tsx
git commit -F /tmp/task4-commit.txt
```

---

## Task 5 (LOW — sequential after Tasks 2–4): PreflightPanel — stream paths + localStorage

**Why lowest priority:** PreflightPanel is a pre-join screen with no WebRTC or store involvement. Failures here are immediately visible to the user. The missing branches are real (toggleMic/toggleCam only work when getUserMedia resolves; recent rooms only render when localStorage is seeded) but less likely to silently break.

**Files:**
- Modify: `tests/unit/v2/pages/PreflightPanel.test.tsx`

**Key context:**
- Existing tests mock `getUserMedia` to reject — that means `stream` is always null and `toggleMic`/`toggleCam` optional-chain short-circuit
- To test the acquired-stream path: mock `getUserMedia` to resolve with a fake stream
- `getAudioTracks()` and `getVideoTracks()` must return arrays of track objects with `enabled` property
- `localStorage` is available in jsdom — seed it in the test, clear in `afterEach`
- `formatRelative` branches: mock `Date.now()` with `jest.spyOn(Date, 'now')` to return specific values — test each time range

*Time ranges for formatRelative:*
- `< 3600000` ms (< 1 hour): e.g. diff = 1800000 → `'30m ago'`
- `< 86400000` ms (< 1 day): e.g. diff = 7200000 → `'2h ago'`
- `< 604800000` ms (< 1 week): e.g. diff = 172800000 → `'yesterday'`
- `>= 604800000` ms: e.g. diff = 864000000 → `'10d ago'`

- [ ] **Step 1: Read the existing test file**

```bash
cat tests/unit/v2/pages/PreflightPanel.test.tsx
cat src/v2/pages/home/PreflightPanel.tsx
```

- [ ] **Step 2: Write tests for the acquired-stream path**

Add at the end of `tests/unit/v2/pages/PreflightPanel.test.tsx`:

```tsx
describe('with getUserMedia resolved', () => {
  const mockAudioTrack = { enabled: true, stop: jest.fn() }
  const mockVideoTrack = { enabled: true, stop: jest.fn() }
  const mockStream = {
    getTracks: () => [mockAudioTrack, mockVideoTrack],
    getAudioTracks: () => [mockAudioTrack],
    getVideoTracks: () => [mockVideoTrack],
  } as unknown as MediaStream

  beforeEach(() => {
    jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream)
    mockAudioTrack.enabled = true
    mockVideoTrack.enabled = true
  })

  test('mic status shows ready after getUserMedia resolves', async () => {
    wrap(<PreflightPanel />)
    await waitFor(() => expect(screen.getByText('Mic ready')).toBeInTheDocument())
  })

  test('cam status shows ready after getUserMedia resolves', async () => {
    wrap(<PreflightPanel />)
    await waitFor(() => expect(screen.getByText('Cam ready')).toBeInTheDocument())
  })

  test('toggleMic disables audio track', async () => {
    wrap(<PreflightPanel />)
    await waitFor(() => screen.getByText('Mic ready'))
    fireEvent.click(screen.getByText('🎙'))
    expect(mockAudioTrack.enabled).toBe(false)
  })

  test('toggleCam disables video track', async () => {
    wrap(<PreflightPanel />)
    await waitFor(() => screen.getByText('Cam ready'))
    fireEvent.click(screen.getByText('🎥'))
    expect(mockVideoTrack.enabled).toBe(false)
  })
})
```

- [ ] **Step 3: Write localStorage recent rooms tests**

```tsx
describe('recent rooms from localStorage', () => {
  afterEach(() => localStorage.clear())

  test('renders recent room items when localStorage is seeded', () => {
    const rooms = [{ id: 'room-abc', name: 'Daily Standup', lastVisited: Date.now() - 60000 }]
    localStorage.setItem('velo_recent_rooms', JSON.stringify(rooms))
    wrap(<PreflightPanel />)
    expect(screen.getByText('Daily Standup')).toBeInTheDocument()
  })

  test('getRecentRooms returns empty array on malformed JSON', () => {
    localStorage.setItem('velo_recent_rooms', 'not-json{{{')
    // Should render with no rooms — no crash
    wrap(<PreflightPanel />)
    expect(screen.getByText('No recent rooms.')).toBeInTheDocument()
  })

  test('clicking recent room navigates to its route', () => {
    const rooms = [{ id: 'room-xyz', name: 'Team Call', lastVisited: Date.now() - 60000 }]
    localStorage.setItem('velo_recent_rooms', JSON.stringify(rooms))
    wrap(<PreflightPanel />)
    fireEvent.click(screen.getByText('Team Call'))
    expect(mockNavigate).toHaveBeenCalledWith('/v2/room/room-xyz')
  })
})
```

- [ ] **Step 4: Write formatRelative branch tests**

```tsx
describe('formatRelative time display', () => {
  afterEach(() => jest.restoreAllMocks())

  test('shows Xm ago for times within the last hour', () => {
    const now = 1000000000000
    jest.spyOn(Date, 'now').mockReturnValue(now)
    const rooms = [{ id: 'r1', name: 'Recent', lastVisited: now - 1800000 }]
    localStorage.setItem('velo_recent_rooms', JSON.stringify(rooms))
    wrap(<PreflightPanel />)
    expect(screen.getByText(/30m ago/)).toBeInTheDocument()
    localStorage.clear()
  })

  test('shows Xh ago for times within the last day', () => {
    const now = 1000000000000
    jest.spyOn(Date, 'now').mockReturnValue(now)
    const rooms = [{ id: 'r1', name: 'Recent', lastVisited: now - 7200000 }]
    localStorage.setItem('velo_recent_rooms', JSON.stringify(rooms))
    wrap(<PreflightPanel />)
    expect(screen.getByText(/2h ago/)).toBeInTheDocument()
    localStorage.clear()
  })

  test('shows yesterday for times within the last week', () => {
    const now = 1000000000000
    jest.spyOn(Date, 'now').mockReturnValue(now)
    const rooms = [{ id: 'r1', name: 'Recent', lastVisited: now - 172800000 }]
    localStorage.setItem('velo_recent_rooms', JSON.stringify(rooms))
    wrap(<PreflightPanel />)
    expect(screen.getByText('yesterday')).toBeInTheDocument()
    localStorage.clear()
  })

  test('shows Xd ago for times over a week old', () => {
    const now = 1000000000000
    jest.spyOn(Date, 'now').mockReturnValue(now)
    const rooms = [{ id: 'r1', name: 'Recent', lastVisited: now - 864000000 }]
    localStorage.setItem('velo_recent_rooms', JSON.stringify(rooms))
    wrap(<PreflightPanel />)
    expect(screen.getByText(/10d ago/)).toBeInTheDocument()
    localStorage.clear()
  })
})
```

Also add `import { fireEvent } from '@testing-library/react'` if not already in the imports.

- [ ] **Step 5: Run the suite**

```bash
npx jest tests/unit/v2/pages/PreflightPanel.test.tsx --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cat > /tmp/task5-commit.txt << 'EOF'
test(v2/PreflightPanel): cover stream-acquired path, localStorage rooms, formatRelative

- getUserMedia resolved: mic/cam status ready, toggleMic/toggleCam mutate track.enabled
- localStorage: recent rooms rendered, malformed JSON returns empty (no crash)
- clicking room navigates to correct route
- formatRelative: all 4 time branches (minutes, hours, yesterday, days)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
git add tests/unit/v2/pages/PreflightPanel.test.tsx
git commit -F /tmp/task5-commit.txt
```

---

## Final verification

After all tasks are committed:

```bash
npx jest --coverage --coverageReporters=text
```

Expected targets:
- Branches: > 85% (up from 75%)
- All thresholds (70/80/80/80) still green
- All test suites pass
