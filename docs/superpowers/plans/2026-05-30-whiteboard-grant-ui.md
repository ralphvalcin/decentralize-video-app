# Whiteboard Permission Grant UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a host-only "Participants ▾" header dropdown in the whiteboard that lets the host grant or revoke per-participant drawing rights; dropdown closes after each action; disconnecting peers are auto-revoked.

**Architecture:** A new `WhiteboardParticipantDropdown` component reads peers from `usePeerStore` and granted IDs from `useWhiteboardStore`, renders inside `WhiteboardModal`'s header when `isHost` is true, and calls `onGrant`/`onRevoke` callbacks wired in `RoomV2`. PeerManager auto-revokes on `user-left`.

**Tech Stack:** React 18, TypeScript, Zustand (`usePeerStore`, `useWhiteboardStore`, `useCallStore`), Tailwind CSS.

---

## File Map

| File | Status | Role |
|---|---|---|
| `src/v2/call/WhiteboardParticipantDropdown.tsx` | Create | Dropdown UI — participant list, Grant/Revoke buttons, click-outside close |
| `src/v2/call/WhiteboardModal.tsx` | Modify | Re-add `onGrant`/`onRevoke` props; render dropdown in header when `isHost` |
| `src/v2/pages/RoomV2.tsx` | Modify | Pass `onGrant`/`onRevoke` callbacks to `WhiteboardModal` |
| `src/v2/call/PeerManager.tsx` | Modify | Add `revokeDrawing` call in `user-left` handler |

---

### Task 1: WhiteboardParticipantDropdown component + tests

**Files:**
- Create: `src/v2/call/WhiteboardParticipantDropdown.tsx`
- Create: `tests/unit/v2/call/WhiteboardParticipantDropdown.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/v2/call/WhiteboardParticipantDropdown.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { WhiteboardParticipantDropdown } from '../../../../src/v2/call/WhiteboardParticipantDropdown'
import { usePeerStore } from '../../../../src/v2/store/usePeerStore'
import { useWhiteboardStore } from '../../../../src/v2/store/useWhiteboardStore'
import { useCallStore } from '../../../../src/v2/store/useCallStore'
import type { PeerRecord } from '../../../../src/v2/types'

function makePeer(id: string, name: string): PeerRecord {
  return {
    id, name, role: 'guest',
    stream: null, isMuted: false, isCamOff: false, videoEnabled: false, isScreenSharing: false,
    connectionState: 'connected', networkQuality: 'good',
    isSpeaking: false, isPinned: false, hasRaisedHand: false, handRaisedAt: null,
    reaction: null, isAway: false, isTyping: false,
  }
}

const defaultProps = {
  onGrant: jest.fn(),
  onRevoke: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  usePeerStore.setState({ peers: new Map([
    ['peer-alice', makePeer('peer-alice', 'Alice')],
    ['peer-bob', makePeer('peer-bob', 'Bob')],
  ]) })
  useWhiteboardStore.setState({ strokes: [], grantedPeerIds: new Set(), currentTool: 'pen', currentColor: '#222222' })
  useCallStore.setState({ socketId: 'host-socket-id', isHost: true, userName: 'Host', localStream: null, isMuted: false, isCamOff: false, isNoiseSuppressed: true, screenSharePeerId: null, mediaError: null })
})

test('button is not visible initially (dropdown closed)', () => {
  render(<WhiteboardParticipantDropdown {...defaultProps} />)
  expect(screen.queryByTestId('participant-list')).not.toBeInTheDocument()
})

test('clicking the button opens the dropdown', () => {
  render(<WhiteboardParticipantDropdown {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-participants-toggle'))
  expect(screen.getByTestId('participant-list')).toBeInTheDocument()
})

test('lists connected peers by name', () => {
  render(<WhiteboardParticipantDropdown {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-participants-toggle'))
  expect(screen.getByText('Alice')).toBeInTheDocument()
  expect(screen.getByText('Bob')).toBeInTheDocument()
})

test('shows Grant button for peer without drawing rights', () => {
  render(<WhiteboardParticipantDropdown {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-participants-toggle'))
  expect(screen.getByTestId('btn-grant-peer-alice')).toBeInTheDocument()
})

test('shows Revoke button for peer with drawing rights', () => {
  useWhiteboardStore.setState({ strokes: [], grantedPeerIds: new Set(['peer-alice']), currentTool: 'pen', currentColor: '#222222' })
  render(<WhiteboardParticipantDropdown {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-participants-toggle'))
  expect(screen.getByTestId('btn-revoke-peer-alice')).toBeInTheDocument()
  expect(screen.queryByTestId('btn-grant-peer-alice')).not.toBeInTheDocument()
})

test('clicking Grant calls onGrant with peerId and closes dropdown', () => {
  render(<WhiteboardParticipantDropdown {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-participants-toggle'))
  fireEvent.click(screen.getByTestId('btn-grant-peer-alice'))
  expect(defaultProps.onGrant).toHaveBeenCalledWith('peer-alice')
  expect(screen.queryByTestId('participant-list')).not.toBeInTheDocument()
})

test('clicking Revoke calls onRevoke with peerId and closes dropdown', () => {
  useWhiteboardStore.setState({ strokes: [], grantedPeerIds: new Set(['peer-bob']), currentTool: 'pen', currentColor: '#222222' })
  render(<WhiteboardParticipantDropdown {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-participants-toggle'))
  fireEvent.click(screen.getByTestId('btn-revoke-peer-bob'))
  expect(defaultProps.onRevoke).toHaveBeenCalledWith('peer-bob')
  expect(screen.queryByTestId('participant-list')).not.toBeInTheDocument()
})

test('host socket ID is excluded from the list', () => {
  usePeerStore.setState({ peers: new Map([
    ['host-socket-id', makePeer('host-socket-id', 'Me')],
    ['peer-alice', makePeer('peer-alice', 'Alice')],
  ]) })
  render(<WhiteboardParticipantDropdown {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-participants-toggle'))
  expect(screen.queryByText('Me')).not.toBeInTheDocument()
  expect(screen.getByText('Alice')).toBeInTheDocument()
})

test('shows empty state message when no other participants', () => {
  usePeerStore.setState({ peers: new Map() })
  render(<WhiteboardParticipantDropdown {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-participants-toggle'))
  expect(screen.getByText('No other participants')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd "/Users/ralphucious/App Builds/decentralized-video-app"
npx jest tests/unit/v2/call/WhiteboardParticipantDropdown.test.tsx --no-coverage 2>&1 | tail -10
```
Expected: FAIL with `Cannot find module '../../../../src/v2/call/WhiteboardParticipantDropdown'`

- [ ] **Step 3: Create `src/v2/call/WhiteboardParticipantDropdown.tsx`**

```tsx
import { useRef, useState, useEffect } from 'react'
import { usePeerStore } from '../store/usePeerStore'
import { useWhiteboardStore } from '../store/useWhiteboardStore'
import { useCallStore } from '../store/useCallStore'

interface WhiteboardParticipantDropdownProps {
  onGrant: (peerId: string) => void
  onRevoke: (peerId: string) => void
}

export function WhiteboardParticipantDropdown({ onGrant, onRevoke }: WhiteboardParticipantDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const peers = usePeerStore((s) => s.peers)
  const grantedPeerIds = useWhiteboardStore((s) => s.grantedPeerIds)
  const socketId = useCallStore((s) => s.socketId)

  const otherPeers = Array.from(peers.values()).filter((p) => p.id !== socketId)

  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  function handleGrant(peerId: string) {
    onGrant(peerId)
    setIsOpen(false)
  }

  function handleRevoke(peerId: string) {
    onRevoke(peerId)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        data-testid="btn-participants-toggle"
        aria-label="Manage drawing permissions"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
      >
        👥 Participants {isOpen ? '▴' : '▾'}
      </button>

      {isOpen && (
        <div
          data-testid="participant-list"
          className="absolute right-0 top-full mt-1 w-52 bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-lg shadow-lg overflow-hidden z-10"
        >
          <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              Drawing permissions
            </span>
          </div>

          {otherPeers.length === 0 ? (
            <div className="px-3 py-3 text-sm text-[var(--text-secondary)]">
              No other participants
            </div>
          ) : (
            otherPeers.map((peer) => {
              const hasDrawing = grantedPeerIds.has(peer.id)
              return (
                <div
                  key={peer.id}
                  className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)] last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-xs font-medium shrink-0">
                      {peer.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-[var(--text-primary)] truncate">{peer.name}</span>
                    {hasDrawing && <span className="text-xs shrink-0">✏️</span>}
                  </div>
                  {hasDrawing ? (
                    <button
                      data-testid={`btn-revoke-${peer.id}`}
                      onClick={() => handleRevoke(peer.id)}
                      className="ml-2 px-2 py-1 rounded text-xs font-medium text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
                    >
                      Revoke
                    </button>
                  ) : (
                    <button
                      data-testid={`btn-grant-${peer.id}`}
                      onClick={() => handleGrant(peer.id)}
                      className="ml-2 px-2 py-1 rounded text-xs font-medium text-green-400 hover:bg-green-400/10 transition-colors shrink-0"
                    >
                      Grant
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest tests/unit/v2/call/WhiteboardParticipantDropdown.test.tsx --no-coverage 2>&1 | tail -10
```
Expected: 9 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/v2/call/WhiteboardParticipantDropdown.tsx tests/unit/v2/call/WhiteboardParticipantDropdown.test.tsx
git commit -m "feat(whiteboard): WhiteboardParticipantDropdown — host grant/revoke dropdown"
```

---

### Task 2: Update WhiteboardModal — re-add onGrant/onRevoke + render dropdown

**Files:**
- Modify: `src/v2/call/WhiteboardModal.tsx`
- Modify: `tests/unit/v2/call/WhiteboardModal.test.tsx`

- [ ] **Step 1: Write failing tests**

Open `tests/unit/v2/call/WhiteboardModal.test.tsx`. Add this mock near the top (after the ThumbnailStrip mock):

```ts
jest.mock('../../../../src/v2/call/WhiteboardParticipantDropdown', () => ({
  WhiteboardParticipantDropdown: ({ onGrant, onRevoke }: { onGrant: (id: string) => void; onRevoke: (id: string) => void }) => (
    <div data-testid="participant-dropdown">
      <button data-testid="mock-grant" onClick={() => onGrant('peer-x')}>Grant</button>
      <button data-testid="mock-revoke" onClick={() => onRevoke('peer-x')}>Revoke</button>
    </div>
  ),
}))
```

Update `defaultProps` to include the new required props:
```ts
const defaultProps = {
  onStroke: jest.fn(),
  onClear: jest.fn(),
  onClose: jest.fn(),
  onGrant: jest.fn(),
  onRevoke: jest.fn(),
  canDraw: true,
}
```

Also update `beforeEach` to set `isHost: false` by default (so host-only UI is hidden by default):
```ts
// Add to beforeEach:
useCallStore.setState({ socketId: 'local-socket', isHost: false, userName: 'User', localStream: null, isMuted: false, isCamOff: false, isNoiseSuppressed: true, screenSharePeerId: null, mediaError: null })
```

Append these two tests at the end of the file:

```ts
test('shows participant dropdown when isHost is true', () => {
  useCallStore.setState({ socketId: 'host-id', isHost: true, userName: 'Host', localStream: null, isMuted: false, isCamOff: false, isNoiseSuppressed: true, screenSharePeerId: null, mediaError: null })
  render(<WhiteboardModal {...defaultProps} />)
  expect(screen.getByTestId('participant-dropdown')).toBeInTheDocument()
})

test('hides participant dropdown when isHost is false', () => {
  render(<WhiteboardModal {...defaultProps} />)
  expect(screen.queryByTestId('participant-dropdown')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests — verify new tests fail**

```bash
npx jest tests/unit/v2/call/WhiteboardModal.test.tsx --no-coverage 2>&1 | tail -10
```
Expected: 2 new failures — `onGrant`/`onRevoke` missing from props, participant-dropdown not found

- [ ] **Step 3: Update `src/v2/call/WhiteboardModal.tsx`**

**3a — Add import** (after existing imports):
```ts
import { WhiteboardParticipantDropdown } from './WhiteboardParticipantDropdown'
```

**3b — Extend `WhiteboardModalProps`** — replace the existing interface:
```ts
interface WhiteboardModalProps {
  onStroke: (stroke: Stroke) => void
  onClear: () => void
  onClose: () => void
  canDraw: boolean
  onGrant: (peerId: string) => void
  onRevoke: (peerId: string) => void
}
```

**3c — Add `onGrant`/`onRevoke` to the function destructuring** — replace:
```ts
export function WhiteboardModal({ onStroke, onClear, onClose, canDraw }: WhiteboardModalProps) {
```
With:
```ts
export function WhiteboardModal({ onStroke, onClear, onClose, canDraw, onGrant, onRevoke }: WhiteboardModalProps) {
```

**3d — Add `isHost` selector** (after the existing `socketId` selector):
```ts
const isHost = useCallStore((s) => s.isHost)
```

**3e — Add dropdown to header** — in the header div, replace the current close-button-only right side with:
```tsx
<div className="flex items-center gap-2">
  {isHost && <WhiteboardParticipantDropdown onGrant={onGrant} onRevoke={onRevoke} />}
  <button
    data-testid="btn-whiteboard-close"
    aria-label="Close whiteboard"
    onClick={onClose}
    className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3 py-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
  >
    ↩ Exit
  </button>
</div>
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest tests/unit/v2/call/WhiteboardModal.test.tsx --no-coverage 2>&1 | tail -10
```
Expected: all tests passing (9 existing + 2 new = 11)

- [ ] **Step 5: Commit**

```bash
git add src/v2/call/WhiteboardModal.tsx tests/unit/v2/call/WhiteboardModal.test.tsx
git commit -m "feat(whiteboard): render ParticipantDropdown in WhiteboardModal header for host"
```

---

### Task 3: PeerManager user-left cleanup + RoomV2 wiring

**Files:**
- Modify: `src/v2/call/PeerManager.tsx`
- Modify: `src/v2/pages/RoomV2.tsx`
- Modify: `tests/unit/v2/call/PeerManager.test.tsx`

- [ ] **Step 1: Write failing PeerManager test**

Open `tests/unit/v2/call/PeerManager.test.tsx`. Add this test at the end (before the final closing line):

```ts
test('user-left revokes whiteboard drawing for departing peer', async () => {
  const { revokeDrawing } = (require('../../../../src/v2/store/useWhiteboardStore') as any).useWhiteboardStore.getState()
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  await act(async () => { fireSocketEvent('user-left', 'peer-departing') })
  expect(revokeDrawing).toHaveBeenCalledWith('peer-departing')
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx jest tests/unit/v2/call/PeerManager.test.tsx --no-coverage 2>&1 | grep "user-left revokes" | head -5
```
Expected: FAIL — `revokeDrawing` not called

- [ ] **Step 3: Update `src/v2/call/PeerManager.tsx` user-left handler**

Find the `user-left` handler (around line 251). It currently reads:
```ts
socket.on('user-left', (socketId: string) => {
  removePeer(socketId)
  destroyPeerConn(socketId)
})
```

Replace with:
```ts
socket.on('user-left', (socketId: string) => {
  removePeer(socketId)
  destroyPeerConn(socketId)
  useWhiteboardStore.getState().revokeDrawing(socketId)
})
```

- [ ] **Step 4: Update `src/v2/pages/RoomV2.tsx`**

Find the `<WhiteboardModal>` render block. Replace it with:
```tsx
{isWhiteboardOpen && (
  <WhiteboardModal
    canDraw={canDraw}
    onClose={toggleWhiteboard}
    onStroke={(stroke) => {
      useWhiteboardStore.getState().addStroke(stroke)
      peerManagerRef.current?.broadcastWhiteboardStroke(stroke)
    }}
    onClear={() => {
      useWhiteboardStore.getState().clearStrokes()
      peerManagerRef.current?.broadcastWhiteboardClear()
    }}
    onGrant={(peerId) => {
      useWhiteboardStore.getState().grantDrawing(peerId)
      peerManagerRef.current?.broadcastWhiteboardGrant(peerId)
    }}
    onRevoke={(peerId) => {
      useWhiteboardStore.getState().revokeDrawing(peerId)
      peerManagerRef.current?.broadcastWhiteboardRevoke(peerId)
    }}
  />
)}
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors in `WhiteboardModal.tsx`, `RoomV2.tsx`, or `PeerManager.tsx`

- [ ] **Step 6: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -10
```
Expected: all tests pass. Pre-existing 6 failures in `PeerManager.integration.test.tsx` are not regressions.

- [ ] **Step 7: Commit**

```bash
git add src/v2/call/PeerManager.tsx src/v2/pages/RoomV2.tsx tests/unit/v2/call/PeerManager.test.tsx
git commit -m "feat(whiteboard): auto-revoke on user-left + RoomV2 grant/revoke wiring"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| "Participants ▾" button in header | Task 1 — `btn-participants-toggle` |
| Dropdown closes after Grant | Task 1 — `handleGrant` sets `isOpen = false` |
| Dropdown closes after Revoke | Task 1 — `handleRevoke` sets `isOpen = false` |
| Click-outside closes dropdown | Task 1 — `useEffect` mousedown listener |
| Host's own ID excluded | Task 1 — `filter((p) => p.id !== socketId)` |
| Empty state when no peers | Task 1 — "No other participants" |
| Granted peer shows Revoke not Grant | Task 1 — `grantedPeerIds.has(peer.id)` toggle |
| `onGrant`/`onRevoke` re-added to WhiteboardModal | Task 2 |
| Dropdown hidden from non-hosts | Task 2 — `{isHost && <WhiteboardParticipantDropdown>}` |
| `user-left` auto-revokes drawing rights | Task 3 — `revokeDrawing(socketId)` in handler |
| RoomV2 passes onGrant/onRevoke to modal | Task 3 |

### Placeholder scan
None found. All steps contain complete code.

### Type consistency
- `onGrant: (peerId: string) => void` — defined in Task 2 `WhiteboardModalProps`, called in Task 1, wired in Task 3. Consistent throughout.
- `revokeDrawing` — from `useWhiteboardStore`, called in Task 1 (handleRevoke), Task 3 (user-left and RoomV2). Same method name throughout.
