# Whiteboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen collaborative whiteboard to video calls — host draws by default, can grant/revoke drawing rights per participant; strokes sync via Socket.io; canvas is ephemeral (cleared on close).

**Architecture:** Strokes are emitted on `mouseup` as complete objects and broadcast via the existing Socket.io signaling server (`socket.broadcast.to(roomId)`). PeerManager handles all socket I/O and calls store methods directly for incoming events. A headless `WhiteboardController` clears the store on unmount. `WhiteboardModal` owns the `<canvas>` and renders full-screen when `isWhiteboardOpen` is true.

**Tech Stack:** React 18, TypeScript, Zustand, HTML5 Canvas API, Socket.io (existing signaling server), `crypto.randomUUID()` for stroke IDs.

---

## File Map

| File | Status | Role |
|---|---|---|
| `src/v2/types/index.ts` | Modify | Add `StrokePoint`, `Stroke` types |
| `src/v2/store/useWhiteboardStore.ts` | Create | Ephemeral Zustand store — strokes, grants, tool/color |
| `src/v2/store/useCallStore.ts` | Modify | Add `socketId: string \| null` + `setSocketId` |
| `src/v2/store/useUIStore.ts` | Modify | Add `isWhiteboardOpen` + `toggleWhiteboard` |
| `signaling-server.js` | Modify | Add 4 whiteboard socket event handlers |
| `src/v2/call/PeerManager.tsx` | Modify | Add 4 handle methods + 4 socket listeners + set socketId |
| `src/v2/call/WhiteboardToolbar.tsx` | Create | Pen / eraser / 4 color swatches / clear button |
| `src/v2/call/WhiteboardModal.tsx` | Create | Full-screen modal — canvas + toolbar + thumbnail strip |
| `src/v2/call/WhiteboardController.tsx` | Create | Headless — clears store on unmount |
| `src/v2/call/ControlBar.tsx` | Modify | Add whiteboard toggle button |
| `src/v2/pages/RoomV2.tsx` | Modify | Mount controller + conditionally render modal |

---

### Task 1: Stroke types + useWhiteboardStore

**Files:**
- Modify: `src/v2/types/index.ts`
- Create: `src/v2/store/useWhiteboardStore.ts`
- Create: `tests/unit/v2/stores/useWhiteboardStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/v2/stores/useWhiteboardStore.test.ts`:

```ts
import { useWhiteboardStore } from '../../../../src/v2/store/useWhiteboardStore'
import type { Stroke } from '../../../../src/v2/types'

const makeStroke = (id: string, drawerId = 'peer-1'): Stroke => ({
  id,
  tool: 'pen',
  color: '#222222',
  width: 3,
  points: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }],
  drawerId,
})

beforeEach(() => {
  useWhiteboardStore.setState({
    strokes: [],
    grantedPeerIds: new Set(),
    currentTool: 'pen',
    currentColor: '#222222',
  })
})

test('addStroke appends stroke to array', () => {
  useWhiteboardStore.getState().addStroke(makeStroke('s1'))
  expect(useWhiteboardStore.getState().strokes).toHaveLength(1)
  expect(useWhiteboardStore.getState().strokes[0].id).toBe('s1')
})

test('addStroke accumulates multiple strokes', () => {
  useWhiteboardStore.getState().addStroke(makeStroke('s1'))
  useWhiteboardStore.getState().addStroke(makeStroke('s2'))
  expect(useWhiteboardStore.getState().strokes).toHaveLength(2)
})

test('clearStrokes empties the array', () => {
  useWhiteboardStore.getState().addStroke(makeStroke('s1'))
  useWhiteboardStore.getState().clearStrokes()
  expect(useWhiteboardStore.getState().strokes).toHaveLength(0)
})

test('grantDrawing adds peerId to grantedPeerIds', () => {
  useWhiteboardStore.getState().grantDrawing('peer-x')
  expect(useWhiteboardStore.getState().grantedPeerIds.has('peer-x')).toBe(true)
})

test('grantDrawing preserves existing grants', () => {
  useWhiteboardStore.getState().grantDrawing('peer-x')
  useWhiteboardStore.getState().grantDrawing('peer-y')
  expect(useWhiteboardStore.getState().grantedPeerIds.has('peer-x')).toBe(true)
  expect(useWhiteboardStore.getState().grantedPeerIds.has('peer-y')).toBe(true)
})

test('revokeDrawing removes peerId from grantedPeerIds', () => {
  useWhiteboardStore.getState().grantDrawing('peer-x')
  useWhiteboardStore.getState().revokeDrawing('peer-x')
  expect(useWhiteboardStore.getState().grantedPeerIds.has('peer-x')).toBe(false)
})

test('revokeDrawing is a no-op for unknown peerId', () => {
  expect(() => useWhiteboardStore.getState().revokeDrawing('nobody')).not.toThrow()
})

test('setTool updates currentTool', () => {
  useWhiteboardStore.getState().setTool('eraser')
  expect(useWhiteboardStore.getState().currentTool).toBe('eraser')
})

test('setColor updates currentColor', () => {
  useWhiteboardStore.getState().setColor('#ff4444')
  expect(useWhiteboardStore.getState().currentColor).toBe('#ff4444')
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd "/Users/ralphucious/App Builds/decentralized-video-app"
npx jest tests/unit/v2/stores/useWhiteboardStore.test.ts --no-coverage 2>&1 | tail -10
```
Expected: FAIL with `Cannot find module '../../../../src/v2/store/useWhiteboardStore'`

- [ ] **Step 3: Add types to `src/v2/types/index.ts`**

Append after the last export in `src/v2/types/index.ts`:

```ts
export interface StrokePoint {
  x: number  // normalized: rawX / canvasWidth
  y: number  // normalized: rawY / canvasHeight
}

export interface Stroke {
  id: string             // crypto.randomUUID()
  tool: 'pen' | 'eraser'
  color: string          // hex e.g. '#ff4444'
  width: number          // pen: 3, eraser: 20
  points: StrokePoint[]
  drawerId: string       // socket ID of the peer who drew
}
```

- [ ] **Step 4: Create `src/v2/store/useWhiteboardStore.ts`**

```ts
import { create } from 'zustand'
import type { Stroke } from '../types'

interface WhiteboardStore {
  strokes: Stroke[]
  grantedPeerIds: Set<string>
  currentTool: 'pen' | 'eraser'
  currentColor: string
  addStroke: (stroke: Stroke) => void
  clearStrokes: () => void
  grantDrawing: (peerId: string) => void
  revokeDrawing: (peerId: string) => void
  setTool: (tool: 'pen' | 'eraser') => void
  setColor: (color: string) => void
}

export const useWhiteboardStore = create<WhiteboardStore>((set) => ({
  strokes: [],
  grantedPeerIds: new Set(),
  currentTool: 'pen',
  currentColor: '#222222',

  addStroke: (stroke) => set((s) => ({ strokes: [...s.strokes, stroke] })),
  clearStrokes: () => set({ strokes: [] }),
  grantDrawing: (peerId) =>
    set((s) => ({ grantedPeerIds: new Set([...s.grantedPeerIds, peerId]) })),
  revokeDrawing: (peerId) =>
    set((s) => {
      const next = new Set(s.grantedPeerIds)
      next.delete(peerId)
      return { grantedPeerIds: next }
    }),
  setTool: (tool) => set({ currentTool: tool }),
  setColor: (color) => set({ currentColor: color }),
}))
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npx jest tests/unit/v2/stores/useWhiteboardStore.test.ts --no-coverage 2>&1 | tail -10
```
Expected: 9 tests passing

- [ ] **Step 6: Commit**

```bash
git add src/v2/types/index.ts src/v2/store/useWhiteboardStore.ts tests/unit/v2/stores/useWhiteboardStore.test.ts
git commit -m "feat(whiteboard): StrokePoint/Stroke types + useWhiteboardStore"
```

---

### Task 2: Store additions — socketId in useCallStore, whiteboard toggle in useUIStore

**Files:**
- Modify: `src/v2/store/useCallStore.ts`
- Modify: `src/v2/store/useUIStore.ts`
- Modify: `tests/unit/v2/stores/useUIStore.test.ts`

- [ ] **Step 1: Write failing tests for UIStore whiteboard toggle**

Open `tests/unit/v2/stores/useUIStore.test.ts` and append these tests at the end of the file (before the final closing line if any):

```ts
describe('whiteboard toggle', () => {
  beforeEach(() => {
    useUIStore.setState({
      isChatOpen: false,
      isParticipantsOpen: false,
      isQAOpen: false,
      isAIOpen: false,
      isWhiteboardOpen: false,
    })
  })

  test('toggleWhiteboard opens whiteboard', () => {
    useUIStore.getState().toggleWhiteboard()
    expect(useUIStore.getState().isWhiteboardOpen).toBe(true)
  })

  test('toggleWhiteboard closes whiteboard when already open', () => {
    useUIStore.setState({ isWhiteboardOpen: true })
    useUIStore.getState().toggleWhiteboard()
    expect(useUIStore.getState().isWhiteboardOpen).toBe(false)
  })

  test('toggleWhiteboard closes chat when opening whiteboard', () => {
    useUIStore.setState({ isChatOpen: true })
    useUIStore.getState().toggleWhiteboard()
    expect(useUIStore.getState().isChatOpen).toBe(false)
    expect(useUIStore.getState().isWhiteboardOpen).toBe(true)
  })

  test('toggleWhiteboard closes AI panel when opening whiteboard', () => {
    useUIStore.setState({ isAIOpen: true })
    useUIStore.getState().toggleWhiteboard()
    expect(useUIStore.getState().isAIOpen).toBe(false)
    expect(useUIStore.getState().isWhiteboardOpen).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest tests/unit/v2/stores/useUIStore.test.ts --no-coverage 2>&1 | tail -15
```
Expected: FAIL — `isWhiteboardOpen` and `toggleWhiteboard` not found

- [ ] **Step 3: Update `src/v2/store/useUIStore.ts`**

Add `isWhiteboardOpen` to the `UIStore` interface (after `isCaptionsOpen`):
```ts
isWhiteboardOpen: boolean
toggleWhiteboard: () => void
```

Add initial state (after `isCaptionsOpen: false`):
```ts
isWhiteboardOpen: false,
```

Add the toggle implementation (after the `toggleAI` definition):
```ts
toggleWhiteboard: () => set((s) => ({
  isWhiteboardOpen: !s.isWhiteboardOpen,
  isChatOpen: false,
  isParticipantsOpen: false,
  isQAOpen: false,
  isAIOpen: false,
})),
```

- [ ] **Step 4: Update `src/v2/store/useCallStore.ts`**

Add `socketId` to the `CallStore` interface (after `userName: string`):
```ts
socketId: string | null
setSocketId: (id: string | null) => void
```

Add to initial state (after `userName: ''`):
```ts
socketId: null,
```

Add the setter (after `setUserName`):
```ts
setSocketId: (id) => set({ socketId: id }),
```

Also add `socketId: null` to the `reset()` call so it clears on end-call:
```ts
reset: () => set({ isMuted: false, isCamOff: false, mediaError: null, isNoiseSuppressed: true, socketId: null }),
```

- [ ] **Step 5: Run UIStore tests — verify they pass**

```bash
npx jest tests/unit/v2/stores/useUIStore.test.ts --no-coverage 2>&1 | tail -10
```
Expected: all tests passing

- [ ] **Step 6: Commit**

```bash
git add src/v2/store/useCallStore.ts src/v2/store/useUIStore.ts tests/unit/v2/stores/useUIStore.test.ts
git commit -m "feat(whiteboard): socketId in useCallStore, isWhiteboardOpen + toggleWhiteboard in useUIStore"
```

---

### Task 3: signaling-server.js — 4 whiteboard socket events

**Files:**
- Modify: `signaling-server.js`

- [ ] **Step 1: Add 4 whiteboard handlers to `signaling-server.js`**

In `signaling-server.js`, locate the `recording-stopped` handler block (around line 1078). Immediately after the closing `});` of that handler, add:

```js
  // Whiteboard events — broadcast stroke/clear/grant/revoke to room
  socket.on('whiteboard-stroke', (stroke) => {
    try {
      const user = users[socket.id];
      if (user && user.roomId) {
        socket.broadcast.to(user.roomId).emit('whiteboard-stroke', stroke);
      }
    } catch (error) {
      console.error('Error in whiteboard-stroke:', error);
    }
  });

  socket.on('whiteboard-clear', () => {
    try {
      const user = users[socket.id];
      if (user && user.roomId) {
        socket.broadcast.to(user.roomId).emit('whiteboard-clear');
      }
    } catch (error) {
      console.error('Error in whiteboard-clear:', error);
    }
  });

  socket.on('whiteboard-grant', ({ peerId }) => {
    try {
      const user = users[socket.id];
      if (user && user.roomId) {
        socket.broadcast.to(user.roomId).emit('whiteboard-grant', { peerId });
      }
    } catch (error) {
      console.error('Error in whiteboard-grant:', error);
    }
  });

  socket.on('whiteboard-revoke', ({ peerId }) => {
    try {
      const user = users[socket.id];
      if (user && user.roomId) {
        socket.broadcast.to(user.roomId).emit('whiteboard-revoke', { peerId });
      }
    } catch (error) {
      console.error('Error in whiteboard-revoke:', error);
    }
  });
```

- [ ] **Step 2: Verify server starts cleanly**

```bash
cd "/Users/ralphucious/App Builds/decentralized-video-app"
node --check signaling-server.js && echo "syntax OK"
```
Expected: `syntax OK`

- [ ] **Step 3: Commit**

```bash
git add signaling-server.js
git commit -m "feat(whiteboard): add whiteboard-stroke/clear/grant/revoke broadcast events to signaling server"
```

---

### Task 4: PeerManager — broadcast methods + socket listeners + socketId

**Files:**
- Modify: `src/v2/call/PeerManager.tsx`
- Modify: `tests/unit/v2/call/PeerManager.test.tsx`

- [ ] **Step 1: Write failing tests**

Open `tests/unit/v2/call/PeerManager.test.tsx`. At the top of the file, after the existing imports, add the whiteboard store mock (alongside any existing mocks):

```ts
jest.mock('../../../../src/v2/store/useWhiteboardStore', () => ({
  useWhiteboardStore: {
    getState: jest.fn(() => ({
      addStroke: jest.fn(),
      clearStrokes: jest.fn(),
      grantDrawing: jest.fn(),
      revokeDrawing: jest.fn(),
    })),
  },
}))
```

Then append these tests at the end of the file:

```ts
test('broadcastWhiteboardStroke emits whiteboard-stroke with stroke payload', async () => {
  const ref = createRef<PeerManagerHandle>()
  await act(async () => { render(<PeerManager ref={ref} roomId="room-1" />) })
  const stroke = { id: 'stroke-1', tool: 'pen' as const, color: '#222', width: 3, points: [], drawerId: 'me' }
  act(() => { ref.current?.broadcastWhiteboardStroke(stroke) })
  expect(mockSocket.emit).toHaveBeenCalledWith('whiteboard-stroke', stroke)
})

test('broadcastWhiteboardClear emits whiteboard-clear', async () => {
  const ref = createRef<PeerManagerHandle>()
  await act(async () => { render(<PeerManager ref={ref} roomId="room-1" />) })
  act(() => { ref.current?.broadcastWhiteboardClear() })
  expect(mockSocket.emit).toHaveBeenCalledWith('whiteboard-clear')
})

test('broadcastWhiteboardGrant emits whiteboard-grant with peerId', async () => {
  const ref = createRef<PeerManagerHandle>()
  await act(async () => { render(<PeerManager ref={ref} roomId="room-1" />) })
  act(() => { ref.current?.broadcastWhiteboardGrant('peer-abc') })
  expect(mockSocket.emit).toHaveBeenCalledWith('whiteboard-grant', { peerId: 'peer-abc' })
})

test('broadcastWhiteboardRevoke emits whiteboard-revoke with peerId', async () => {
  const ref = createRef<PeerManagerHandle>()
  await act(async () => { render(<PeerManager ref={ref} roomId="room-1" />) })
  act(() => { ref.current?.broadcastWhiteboardRevoke('peer-abc') })
  expect(mockSocket.emit).toHaveBeenCalledWith('whiteboard-revoke', { peerId: 'peer-abc' })
})

test('incoming whiteboard-stroke calls useWhiteboardStore.addStroke', async () => {
  const { addStroke } = useWhiteboardStore.getState()
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  const stroke = { id: 's1', tool: 'pen' as const, color: '#222', width: 3, points: [], drawerId: 'peer-a' }
  await act(async () => { fireSocketEvent('whiteboard-stroke', stroke) })
  expect(addStroke).toHaveBeenCalledWith(stroke)
})

test('incoming whiteboard-clear calls useWhiteboardStore.clearStrokes', async () => {
  const { clearStrokes } = useWhiteboardStore.getState()
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  await act(async () => { fireSocketEvent('whiteboard-clear') })
  expect(clearStrokes).toHaveBeenCalled()
})

test('incoming whiteboard-grant calls useWhiteboardStore.grantDrawing', async () => {
  const { grantDrawing } = useWhiteboardStore.getState()
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  await act(async () => { fireSocketEvent('whiteboard-grant', { peerId: 'peer-x' }) })
  expect(grantDrawing).toHaveBeenCalledWith('peer-x')
})

test('incoming whiteboard-revoke calls useWhiteboardStore.revokeDrawing', async () => {
  const { revokeDrawing } = useWhiteboardStore.getState()
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  await act(async () => { fireSocketEvent('whiteboard-revoke', { peerId: 'peer-x' }) })
  expect(revokeDrawing).toHaveBeenCalledWith('peer-x')
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest tests/unit/v2/call/PeerManager.test.tsx --no-coverage 2>&1 | tail -15
```
Expected: FAIL — `broadcastWhiteboardStroke` is not a function, incoming handlers not found

- [ ] **Step 3: Update `src/v2/call/PeerManager.tsx`**

**3a — Add import for useWhiteboardStore** (after the existing store imports at the top):
```ts
import { useWhiteboardStore } from '../store/useWhiteboardStore'
import type { Stroke } from '../types'
```

**3b — Extend `PeerManagerHandle` interface** (add after `broadcastRecordingStopped`):
```ts
broadcastWhiteboardStroke: (stroke: Stroke) => void
broadcastWhiteboardClear: () => void
broadcastWhiteboardGrant: (peerId: string) => void
broadcastWhiteboardRevoke: (peerId: string) => void
```

**3c — Add `setSocketId` selector** (after the existing `setRecordingState` selector):
```ts
const setSocketId = useCallStore((s) => s.setSocketId)
```

**3d — Add to `useImperativeHandle`** (after `broadcastRecordingStopped`):
```ts
broadcastWhiteboardStroke: (stroke) => {
  if (!socketRef.current?.connected) return
  socketRef.current.emit('whiteboard-stroke', stroke)
},
broadcastWhiteboardClear: () => {
  if (!socketRef.current?.connected) return
  socketRef.current.emit('whiteboard-clear')
},
broadcastWhiteboardGrant: (peerId) => {
  if (!socketRef.current?.connected) return
  socketRef.current.emit('whiteboard-grant', { peerId })
},
broadcastWhiteboardRevoke: (peerId) => {
  if (!socketRef.current?.connected) return
  socketRef.current.emit('whiteboard-revoke', { peerId })
},
```

**3e — Set socketId when socket connects** — inside the async IIFE in the connect `useEffect`, immediately after `socketRef.current = socket`:
```ts
socket.on('connect', () => {
  setSocketId(socket.id ?? null)
  socket.emit('request-room-token', { roomId, userName })
})
```
(Replace the existing `socket.on('connect', ...)` handler — just add `setSocketId(socket.id ?? null)` as the first line inside it.)

**3f — Add 4 socket listeners for incoming whiteboard events** — inside the async IIFE, after the existing `socket.on('recording-stopped', ...)` listener:
```ts
socket.on('whiteboard-stroke', (stroke: Stroke) => {
  useWhiteboardStore.getState().addStroke(stroke)
})

socket.on('whiteboard-clear', () => {
  useWhiteboardStore.getState().clearStrokes()
})

socket.on('whiteboard-grant', ({ peerId }: { peerId: string }) => {
  useWhiteboardStore.getState().grantDrawing(peerId)
})

socket.on('whiteboard-revoke', ({ peerId }: { peerId: string }) => {
  useWhiteboardStore.getState().revokeDrawing(peerId)
})
```

**3g — Add cleanup** — in the `return () => { ... }` cleanup function, after `socketRef.current?.off('turn-credentials')`, add:
```ts
socketRef.current?.off('whiteboard-stroke')
socketRef.current?.off('whiteboard-clear')
socketRef.current?.off('whiteboard-grant')
socketRef.current?.off('whiteboard-revoke')
```

Also add `setSocketId` to the dependency array of the connect `useEffect` (it's already stable but TypeScript exhaustive-deps may require it).

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 5: Run PeerManager tests**

```bash
npx jest tests/unit/v2/call/PeerManager.test.tsx --no-coverage 2>&1 | tail -15
```
Expected: all existing tests + 8 new tests passing

- [ ] **Step 6: Commit**

```bash
git add src/v2/call/PeerManager.tsx tests/unit/v2/call/PeerManager.test.tsx
git commit -m "feat(whiteboard): PeerManager — broadcast methods + socket listeners + set socketId on connect"
```

---

### Task 5: WhiteboardToolbar

**Files:**
- Create: `src/v2/call/WhiteboardToolbar.tsx`
- Create: `tests/unit/v2/call/WhiteboardToolbar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/v2/call/WhiteboardToolbar.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { WhiteboardToolbar } from '../../../../src/v2/call/WhiteboardToolbar'

const defaultProps = {
  currentTool: 'pen' as const,
  currentColor: '#222222',
  onToolChange: jest.fn(),
  onColorChange: jest.fn(),
  onClear: jest.fn(),
}

beforeEach(() => jest.clearAllMocks())

test('renders pen button as active when currentTool is pen', () => {
  render(<WhiteboardToolbar {...defaultProps} />)
  expect(screen.getByTestId('btn-tool-pen')).toHaveAttribute('aria-pressed', 'true')
})

test('renders eraser button as inactive when currentTool is pen', () => {
  render(<WhiteboardToolbar {...defaultProps} />)
  expect(screen.getByTestId('btn-tool-eraser')).toHaveAttribute('aria-pressed', 'false')
})

test('calls onToolChange with eraser when eraser button clicked', () => {
  render(<WhiteboardToolbar {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-tool-eraser'))
  expect(defaultProps.onToolChange).toHaveBeenCalledWith('eraser')
})

test('calls onToolChange with pen when pen button clicked', () => {
  render(<WhiteboardToolbar {...defaultProps} currentTool="eraser" />)
  fireEvent.click(screen.getByTestId('btn-tool-pen'))
  expect(defaultProps.onToolChange).toHaveBeenCalledWith('pen')
})

test('renders all 4 color swatches', () => {
  render(<WhiteboardToolbar {...defaultProps} />)
  expect(screen.getAllByTestId(/^btn-color-/)).toHaveLength(4)
})

test('calls onColorChange when a color swatch is clicked', () => {
  render(<WhiteboardToolbar {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-color-#ff4444'))
  expect(defaultProps.onColorChange).toHaveBeenCalledWith('#ff4444')
})

test('renders clear button and calls onClear when clicked', () => {
  render(<WhiteboardToolbar {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-clear'))
  expect(defaultProps.onClear).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest tests/unit/v2/call/WhiteboardToolbar.test.tsx --no-coverage 2>&1 | tail -10
```
Expected: FAIL with `Cannot find module '../../../../src/v2/call/WhiteboardToolbar'`

- [ ] **Step 3: Create `src/v2/call/WhiteboardToolbar.tsx`**

```tsx
const COLORS = ['#222222', '#ff4444', '#4a9eff', '#22cc22'] as const

interface WhiteboardToolbarProps {
  currentTool: 'pen' | 'eraser'
  currentColor: string
  onToolChange: (tool: 'pen' | 'eraser') => void
  onColorChange: (color: string) => void
  onClear: () => void
}

export function WhiteboardToolbar({
  currentTool,
  currentColor,
  onToolChange,
  onColorChange,
  onClear,
}: WhiteboardToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-raised)] border-b border-[var(--border-subtle)]">
      <button
        data-testid="btn-tool-pen"
        aria-pressed={currentTool === 'pen'}
        aria-label="Pen"
        onClick={() => onToolChange('pen')}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          currentTool === 'pen'
            ? 'bg-[var(--accent-primary)] text-white'
            : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
        }`}
      >
        ✏️ Pen
      </button>

      <button
        data-testid="btn-tool-eraser"
        aria-pressed={currentTool === 'eraser'}
        aria-label="Eraser"
        onClick={() => onToolChange('eraser')}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          currentTool === 'eraser'
            ? 'bg-[var(--accent-primary)] text-white'
            : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
        }`}
      >
        🧹 Eraser
      </button>

      <div className="w-px h-6 bg-[var(--border-subtle)]" />

      <div className="flex items-center gap-1.5">
        {COLORS.map((color) => (
          <button
            key={color}
            data-testid={`btn-color-${color}`}
            aria-label={`Color ${color}`}
            onClick={() => onColorChange(color)}
            style={{ background: color }}
            className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
              currentColor === color ? 'ring-2 ring-white ring-offset-1 ring-offset-[var(--surface-raised)]' : ''
            }`}
          />
        ))}
      </div>

      <div className="w-px h-6 bg-[var(--border-subtle)]" />

      <button
        data-testid="btn-clear"
        aria-label="Clear canvas"
        onClick={onClear}
        className="px-3 py-1.5 rounded text-sm font-medium text-red-400 hover:bg-red-400/10 transition-colors"
      >
        Clear
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest tests/unit/v2/call/WhiteboardToolbar.test.tsx --no-coverage 2>&1 | tail -10
```
Expected: 7 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/v2/call/WhiteboardToolbar.tsx tests/unit/v2/call/WhiteboardToolbar.test.tsx
git commit -m "feat(whiteboard): WhiteboardToolbar — pen/eraser/colors/clear"
```

---

### Task 6: WhiteboardModal — canvas + drawing logic

**Files:**
- Create: `src/v2/call/WhiteboardModal.tsx`
- Create: `tests/unit/v2/call/WhiteboardModal.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/v2/call/WhiteboardModal.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { WhiteboardModal } from '../../../../src/v2/call/WhiteboardModal'
import { useWhiteboardStore } from '../../../../src/v2/store/useWhiteboardStore'

jest.mock('../../../../src/v2/call/ThumbnailStrip', () => ({
  ThumbnailStrip: () => <div data-testid="thumbnail-strip" />,
}))

const defaultProps = {
  onStroke: jest.fn(),
  onClear: jest.fn(),
  onGrant: jest.fn(),
  onRevoke: jest.fn(),
  onClose: jest.fn(),
  canDraw: true,
}

beforeEach(() => {
  jest.clearAllMocks()
  useWhiteboardStore.setState({ strokes: [], grantedPeerIds: new Set(), currentTool: 'pen', currentColor: '#222222' })
  // jsdom canvas stub
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    globalCompositeOperation: 'source-over',
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext
})

test('renders the canvas element', () => {
  render(<WhiteboardModal {...defaultProps} />)
  expect(screen.getByTestId('whiteboard-canvas')).toBeInTheDocument()
})

test('renders toolbar when canDraw is true', () => {
  render(<WhiteboardModal {...defaultProps} canDraw={true} />)
  expect(screen.getByTestId('btn-tool-pen')).toBeInTheDocument()
})

test('hides toolbar when canDraw is false', () => {
  render(<WhiteboardModal {...defaultProps} canDraw={false} />)
  expect(screen.queryByTestId('btn-tool-pen')).not.toBeInTheDocument()
})

test('calls onClose when exit button is clicked', () => {
  render(<WhiteboardModal {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-whiteboard-close'))
  expect(defaultProps.onClose).toHaveBeenCalled()
})

test('calls onClear from toolbar clear button', () => {
  render(<WhiteboardModal {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-clear'))
  expect(defaultProps.onClear).toHaveBeenCalled()
})

test('renders ThumbnailStrip', () => {
  render(<WhiteboardModal {...defaultProps} />)
  expect(screen.getByTestId('thumbnail-strip')).toBeInTheDocument()
})

test('shows read-only label when canDraw is false', () => {
  render(<WhiteboardModal {...defaultProps} canDraw={false} />)
  expect(screen.getByText('View only')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest tests/unit/v2/call/WhiteboardModal.test.tsx --no-coverage 2>&1 | tail -10
```
Expected: FAIL with `Cannot find module '../../../../src/v2/call/WhiteboardModal'`

- [ ] **Step 3: Create `src/v2/call/WhiteboardModal.tsx`**

```tsx
import { useRef, useEffect, useCallback } from 'react'
import { useWhiteboardStore } from '../store/useWhiteboardStore'
import { WhiteboardToolbar } from './WhiteboardToolbar'
import { ThumbnailStrip } from './ThumbnailStrip'
import type { Stroke, StrokePoint } from '../types'

interface WhiteboardModalProps {
  onStroke: (stroke: Stroke) => void
  onClear: () => void
  onGrant: (peerId: string) => void
  onRevoke: (peerId: string) => void
  onClose: () => void
  canDraw: boolean
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, w: number, h: number) {
  if (stroke.points.length < 2) return
  ctx.save()
  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = 'rgba(0,0,0,1)'
    ctx.lineWidth = stroke.width
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h)
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x * w, stroke.points[i].y * h)
  }
  ctx.stroke()
  ctx.restore()
}

export function WhiteboardModal({ onStroke, onClear, onGrant, onRevoke, onClose, canDraw }: WhiteboardModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const currentPointsRef = useRef<StrokePoint[]>([])

  const strokes = useWhiteboardStore((s) => s.strokes)
  const currentTool = useWhiteboardStore((s) => s.currentTool)
  const currentColor = useWhiteboardStore((s) => s.currentColor)
  const setTool = useWhiteboardStore((s) => s.setTool)
  const setColor = useWhiteboardStore((s) => s.setColor)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const stroke of strokes) {
      drawStroke(ctx, stroke, canvas.width, canvas.height)
    }
  }, [strokes])

  useEffect(() => { redraw() }, [redraw])

  // Resize canvas to match its CSS layout size
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      redraw()
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [redraw])

  function getPoint(e: React.MouseEvent<HTMLCanvasElement>): StrokePoint {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / canvas.width,
      y: (e.clientY - rect.top) / canvas.height,
    }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!canDraw) return
    isDrawingRef.current = true
    currentPointsRef.current = [getPoint(e)]
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || !canDraw) return
    currentPointsRef.current.push(getPoint(e))
    // Preview current stroke
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const stroke of strokes) {
      drawStroke(ctx, stroke, canvas.width, canvas.height)
    }
    drawStroke(ctx, {
      id: '__preview',
      tool: currentTool,
      color: currentColor,
      width: currentTool === 'eraser' ? 20 : 3,
      points: currentPointsRef.current,
      drawerId: '__local',
    }, canvas.width, canvas.height)
  }

  function finalizeStroke() {
    if (!isDrawingRef.current || !canDraw) return
    isDrawingRef.current = false
    const points = currentPointsRef.current
    currentPointsRef.current = []
    if (points.length < 2) return
    const stroke: Stroke = {
      id: crypto.randomUUID(),
      tool: currentTool,
      color: currentColor,
      width: currentTool === 'eraser' ? 20 : 3,
      points,
      drawerId: '__local',
    }
    onStroke(stroke)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" data-testid="whiteboard-modal">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--surface-raised)] border-b border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">✏️ Whiteboard</span>
          {!canDraw && (
            <span className="text-xs text-[var(--text-secondary)] bg-[var(--surface-hover)] px-2 py-0.5 rounded">
              View only
            </span>
          )}
        </div>
        <button
          data-testid="btn-whiteboard-close"
          aria-label="Close whiteboard"
          onClick={onClose}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3 py-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
        >
          ↩ Exit
        </button>
      </div>

      {/* Toolbar — only when canDraw */}
      {canDraw && (
        <WhiteboardToolbar
          currentTool={currentTool}
          currentColor={currentColor}
          onToolChange={setTool}
          onColorChange={setColor}
          onClear={onClear}
        />
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        data-testid="whiteboard-canvas"
        className="flex-1 w-full cursor-crosshair"
        style={{ touchAction: 'none', background: '#fff' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={finalizeStroke}
        onMouseLeave={finalizeStroke}
      />

      {/* Participant video strip */}
      <div className="shrink-0 border-t border-[var(--border-subtle)]">
        <ThumbnailStrip />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest tests/unit/v2/call/WhiteboardModal.test.tsx --no-coverage 2>&1 | tail -10
```
Expected: 7 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/v2/call/WhiteboardModal.tsx tests/unit/v2/call/WhiteboardModal.test.tsx
git commit -m "feat(whiteboard): WhiteboardModal — full-screen canvas + toolbar + thumbnail strip"
```

---

### Task 7: WhiteboardController

**Files:**
- Create: `src/v2/call/WhiteboardController.tsx`
- Create: `tests/unit/v2/call/WhiteboardController.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/v2/call/WhiteboardController.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { act } from 'react'
import { WhiteboardController } from '../../../../src/v2/call/WhiteboardController'
import { useWhiteboardStore } from '../../../../src/v2/store/useWhiteboardStore'
import type { Stroke } from '../../../../src/v2/types'

const stroke: Stroke = { id: 's1', tool: 'pen', color: '#222', width: 3, points: [{ x: 0.1, y: 0.2 }], drawerId: 'p1' }

beforeEach(() => {
  useWhiteboardStore.setState({ strokes: [stroke], grantedPeerIds: new Set(['peer-x']), currentTool: 'pen', currentColor: '#222222' })
})

test('renders nothing (null)', () => {
  const { container } = render(<WhiteboardController />)
  expect(container.firstChild).toBeNull()
})

test('clears strokes from store when unmounted', () => {
  const { unmount } = render(<WhiteboardController />)
  expect(useWhiteboardStore.getState().strokes).toHaveLength(1)
  act(() => { unmount() })
  expect(useWhiteboardStore.getState().strokes).toHaveLength(0)
})

test('clears grantedPeerIds from store when unmounted', () => {
  const { unmount } = render(<WhiteboardController />)
  act(() => { unmount() })
  expect(useWhiteboardStore.getState().grantedPeerIds.size).toBe(0)
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest tests/unit/v2/call/WhiteboardController.test.tsx --no-coverage 2>&1 | tail -10
```
Expected: FAIL with `Cannot find module '../../../../src/v2/call/WhiteboardController'`

- [ ] **Step 3: Create `src/v2/call/WhiteboardController.tsx`**

```tsx
import { useEffect } from 'react'
import { useWhiteboardStore } from '../store/useWhiteboardStore'

export function WhiteboardController() {
  useEffect(() => {
    return () => {
      useWhiteboardStore.getState().clearStrokes()
      useWhiteboardStore.setState({ grantedPeerIds: new Set() })
    }
  }, [])
  return null
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest tests/unit/v2/call/WhiteboardController.test.tsx --no-coverage 2>&1 | tail -10
```
Expected: 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/v2/call/WhiteboardController.tsx tests/unit/v2/call/WhiteboardController.test.tsx
git commit -m "feat(whiteboard): WhiteboardController — clears store on unmount"
```

---

### Task 8: ControlBar + RoomV2 wiring + full test suite

**Files:**
- Modify: `src/v2/call/ControlBar.tsx`
- Modify: `src/v2/pages/RoomV2.tsx`
- Modify: `tests/unit/v2/call/ControlBar.test.tsx`

- [ ] **Step 1: Write failing ControlBar test**

Open `tests/unit/v2/call/ControlBar.test.tsx` and append at the end:

```ts
test('renders whiteboard toggle button', () => {
  render(
    <ControlBar
      onEndCall={jest.fn()}
      onSendReaction={jest.fn()}
      onStartRecording={jest.fn()}
      onStopRecording={jest.fn()}
    />
  )
  expect(screen.getByTestId('btn-whiteboard')).toBeInTheDocument()
})

test('whiteboard button calls toggleWhiteboard on click', () => {
  const toggleWhiteboard = jest.fn()
  useUIStore.setState({ ...useUIStore.getState(), toggleWhiteboard })
  render(
    <ControlBar
      onEndCall={jest.fn()}
      onSendReaction={jest.fn()}
      onStartRecording={jest.fn()}
      onStopRecording={jest.fn()}
    />
  )
  fireEvent.click(screen.getByTestId('btn-whiteboard'))
  expect(toggleWhiteboard).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest tests/unit/v2/call/ControlBar.test.tsx --no-coverage 2>&1 | tail -10
```
Expected: FAIL — `btn-whiteboard` not found

- [ ] **Step 3: Update `src/v2/call/ControlBar.tsx`**

**3a — Add selector** (after `const toggleCaptions = useUIStore((s) => s.toggleCaptions)`):
```ts
const isWhiteboardOpen = useUIStore((s) => s.isWhiteboardOpen)
const toggleWhiteboard = useUIStore((s) => s.toggleWhiteboard)
```

**3b — Add button** (before the CC button, or after it — pick a consistent position; place it after CC):
```tsx
<Button
  data-testid="btn-whiteboard"
  variant={isWhiteboardOpen ? 'primary' : 'ghost'}
  onClick={toggleWhiteboard}
  aria-label="Whiteboard"
>
  ✏️
</Button>
```

- [ ] **Step 4: Run ControlBar tests — verify they pass**

```bash
npx jest tests/unit/v2/call/ControlBar.test.tsx --no-coverage 2>&1 | tail -10
```
Expected: all tests passing

- [ ] **Step 5: Update `src/v2/pages/RoomV2.tsx`**

**5a — Add imports** (after the existing call imports):
```ts
import { WhiteboardController } from '../call/WhiteboardController'
import { WhiteboardModal } from '../call/WhiteboardModal'
import { useWhiteboardStore } from '../store/useWhiteboardStore'
```

**5b — Add selector** (after `const isAIOpen = ...`):
```ts
const isWhiteboardOpen = useUIStore((s) => s.isWhiteboardOpen)
const toggleWhiteboard = useUIStore((s) => s.toggleWhiteboard)
const socketId = useCallStore((s) => s.socketId)
const isHost = useCallStore((s) => s.isHost)
const grantedPeerIds = useWhiteboardStore((s) => s.grantedPeerIds)
const canDraw = isHost || grantedPeerIds.has(socketId ?? '')
```

**5c — Mount WhiteboardController unconditionally** (after `<RecordingController roomId={roomId ?? ''} />`):
```tsx
{isWhiteboardOpen && <WhiteboardController />}
```

**5d — Render WhiteboardModal conditionally** (after the `{isAIOpen && <AISidePanel ... />}` block):
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

- [ ] **Step 6: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 7: Run the full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -15
```
Expected: all existing tests pass + new whiteboard tests pass. The 6 pre-existing failures in `PeerManager.integration.test.tsx` are expected and not regressions.

- [ ] **Step 8: Commit**

```bash
git add src/v2/call/ControlBar.tsx src/v2/pages/RoomV2.tsx tests/unit/v2/call/ControlBar.test.tsx
git commit -m "feat(whiteboard): wire ControlBar toggle + RoomV2 modal + controller mounting"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| Full-screen modal placement | Task 6 — `WhiteboardModal` uses `fixed inset-0 z-50` |
| Permission-based drawing — host draws by default | Task 2/8 — `canDraw = isHost \|\| grantedPeerIds.has(socketId)` |
| Host can grant/revoke drawing rights | Task 4 — `broadcastWhiteboardGrant/Revoke` in PeerManager; Task 8 — callbacks in RoomV2 |
| Minimal tool set — pen, eraser, 4 colors, clear | Task 5 — `WhiteboardToolbar` |
| Ephemeral canvas — clears on close | Task 7 — `WhiteboardController` clears store on unmount |
| Signaling server relay for stroke sync | Task 3 — 4 socket events in server |
| Strokes emitted on mouseup | Task 6 — `finalizeStroke` called on `onMouseUp` |
| Normalized coordinates | Task 6 — points stored as `x/canvas.width`, `y/canvas.height` |
| Eraser uses `destination-out` compositing | Task 6 — `drawStroke` function |
| Toolbar hidden for read-only participants | Task 6 — `{canDraw && <WhiteboardToolbar />}` |
| ThumbnailStrip visible at bottom | Task 6 — `<ThumbnailStrip />` in modal footer |
| ControlBar whiteboard button | Task 8 — `btn-whiteboard` with `toggleWhiteboard` |
| socketId tracked in useCallStore | Task 2 — `socketId` + `setSocketId` |
| socketId set when socket connects | Task 4 — `setSocketId(socket.id)` in connect handler |
| Cleanup in PeerManager useEffect | Task 4 — 4 `socketRef.current?.off(...)` calls |

### Placeholder scan
None found. All steps contain complete code.

### Type consistency
- `Stroke` / `StrokePoint` defined in Task 1, imported consistently in Tasks 4, 5, 6, 7
- `broadcastWhiteboardStroke(stroke: Stroke)` — defined in PeerManagerHandle (Task 4), called in RoomV2 (Task 8)
- `useWhiteboardStore.getState().addStroke(stroke)` — method name matches store definition throughout
- `grantedPeerIds: Set<string>` — used as `Set` in store, `.has()` called correctly in RoomV2
