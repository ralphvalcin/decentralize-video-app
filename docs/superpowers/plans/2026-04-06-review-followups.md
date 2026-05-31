# Review Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Parallelism note:** All three tasks are fully independent. Dispatch simultaneously.

**Goal:** Close three items flagged in the post-feature-gaps code review — a PollBanner integration test gap in RoomV2, poll option buttons that look interactive but do nothing, and a missing poll-ended socket handler.

**Architecture:** Two test-only tasks (Items 1 and 2's test) + one small feature (Item 3) + one production code fix (Item 2's disabled attribute). No new files needed.

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
| `tests/unit/v2/pages/RoomV2.test.tsx` | Modify | Add two PollBanner visibility integration tests |
| `src/v2/call/PollBanner.tsx` | Modify | Add `disabled` attribute to each option `<button>` |
| `tests/unit/v2/call/PollBanner.test.tsx` | Modify | Assert each option button is disabled |
| `src/v2/call/PeerManager.tsx` | Modify | Add `poll-ended` socket handler that calls `setActivePoll(null)` |
| `tests/unit/v2/call/PeerManager.test.tsx` | Modify | Cover `poll-ended` handler with `fireSocketEvent` |

---

## Task 1: RoomV2 PollBanner integration tests

**Files:**
- Modify: `tests/unit/v2/pages/RoomV2.test.tsx`

- [ ] **Step 1: Read the existing test file**

```bash
cat tests/unit/v2/pages/RoomV2.test.tsx
```

- [ ] **Step 2: Write the two failing tests**

Add import at the top alongside other store imports:
```tsx
import { useSessionStore } from '../../../../src/v2/store/useSessionStore'
```

Add to `beforeEach` after the `useUIStore.setState` line:
```tsx
useSessionStore.setState({ activePoll: null, pollResponses: {} })
```

Append at end of file:
```tsx
test('poll-banner is absent when activePoll is null', async () => {
  await renderRoom()
  await screen.findByTestId('room-v2')
  expect(screen.queryByTestId('poll-banner')).not.toBeInTheDocument()
})

test('poll-banner appears when activePoll is set', async () => {
  await renderRoom()
  await screen.findByTestId('room-v2')
  act(() => {
    useSessionStore.setState({
      activePoll: { id: 'p1', question: 'Ready?', options: ['Yes', 'No'], createdAt: 1 },
    })
  })
  expect(await screen.findByTestId('poll-banner')).toBeInTheDocument()
})
```

- [ ] **Step 3: Run to verify**

```bash
npx jest tests/unit/v2/pages/RoomV2.test.tsx --no-coverage
```

Expected: all tests pass (12 total).

- [ ] **Step 4: Commit**

```bash
cat > /tmp/task1-commit.txt << 'EOF'
test(RoomV2): add PollBanner visibility integration tests

Covers the two missing cases flagged in code review: poll-banner absent
when activePoll is null (default), and poll-banner visible after
useSessionStore.setState sets an activePoll. Adds useSessionStore reset
to beforeEach so poll state never leaks between tests.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
git add tests/unit/v2/pages/RoomV2.test.tsx
git commit -F /tmp/task1-commit.txt
```

---

## Task 2: Disable poll option buttons (UX fix + test)

**Files:**
- Modify: `src/v2/call/PollBanner.tsx`
- Modify: `tests/unit/v2/call/PollBanner.test.tsx`

- [ ] **Step 1: Read the existing files**

```bash
cat src/v2/call/PollBanner.tsx
cat tests/unit/v2/call/PollBanner.test.tsx
```

- [ ] **Step 2: Write the failing test**

Append at end of `tests/unit/v2/call/PollBanner.test.tsx`:
```tsx
test('each option button is disabled', () => {
  useSessionStore.setState({ activePoll: poll })
  render(<PollBanner />)
  expect(screen.getByTestId('poll-option-9am')).toBeDisabled()
  expect(screen.getByTestId('poll-option-2pm')).toBeDisabled()
  expect(screen.getByTestId('poll-option-5pm')).toBeDisabled()
})
```

- [ ] **Step 3: Run to verify it fails**

```bash
npx jest tests/unit/v2/call/PollBanner.test.tsx --no-coverage
```

Expected: new test fails — buttons not disabled yet.

- [ ] **Step 4: Add `disabled` to option buttons in PollBanner.tsx**

Find the `<button>` inside `options.map` and add `disabled`:
```tsx
<button
  key={option}
  data-testid={`poll-option-${option}`}
  disabled
  className="text-left text-xs text-[var(--text-secondary)] bg-[var(--surface-raised)] hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2 transition-colors"
>
  {option}
</button>
```

- [ ] **Step 5: Run tests**

```bash
npx jest tests/unit/v2/call/PollBanner.test.tsx --no-coverage
```

Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
cat > /tmp/task2-commit.txt << 'EOF'
fix(PollBanner): disable option buttons until vote submission is defined

Option buttons had hover styles and button semantics but no onClick
handler — they appeared interactive but did nothing. Adding disabled
removes the hover affordance and communicates non-interactivity to
both sighted users and assistive technology.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
git add src/v2/call/PollBanner.tsx tests/unit/v2/call/PollBanner.test.tsx
git commit -F /tmp/task2-commit.txt
```

---

## Task 3: poll-ended socket handler in PeerManager

**Files:**
- Modify: `src/v2/call/PeerManager.tsx`
- Modify: `tests/unit/v2/call/PeerManager.test.tsx`

- [ ] **Step 1: Read the relevant parts**

```bash
cat src/v2/call/PeerManager.tsx
tail -60 tests/unit/v2/call/PeerManager.test.tsx
```

Note: `setActivePoll` is already imported (line 44) and in the `useEffect` dependency array. The `new-poll` handler is at lines 161–163.

- [ ] **Step 2: Write the failing test**

Append at end of `tests/unit/v2/call/PeerManager.test.tsx`:
```tsx
test('poll-ended clears activePoll in session store', async () => {
  await act(async () => { render(<PeerManager />) })
  useSessionStore.setState({
    activePoll: { id: 'p1', question: 'Ready?', options: ['Yes', 'No'], createdAt: 1 },
  })
  expect(useSessionStore.getState().activePoll).not.toBeNull()
  act(() => { fireSocketEvent('poll-ended') })
  expect(useSessionStore.getState().activePoll).toBeNull()
})
```

- [ ] **Step 3: Run to verify it fails**

```bash
npx jest tests/unit/v2/call/PeerManager.test.tsx --no-coverage -t "poll-ended"
```

Expected: fails — no handler registered.

- [ ] **Step 4: Add the handler in PeerManager.tsx**

After the `new-poll` handler:
```tsx
socket.on('new-poll', (poll: Poll) => {
  setActivePoll(poll)
})

socket.on('poll-ended', () => {
  setActivePoll(null)
})
```

- [ ] **Step 5: Run full PeerManager test file**

```bash
npx jest tests/unit/v2/call/PeerManager.test.tsx --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Run full suite**

```bash
npx jest --coverage --coverageReporters=text-summary
```

Expected: all suites pass, all thresholds green.

- [ ] **Step 7: Commit**

```bash
cat > /tmp/task3-commit.txt << 'EOF'
feat(PeerManager): handle poll-ended socket event to clear active poll

Without this handler a poll sent by the server persists in the UI
indefinitely. The new handler calls setActivePoll(null), which already
existed in the store and was already imported for the new-poll handler.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
git add src/v2/call/PeerManager.tsx tests/unit/v2/call/PeerManager.test.tsx
git commit -F /tmp/task3-commit.txt
```
