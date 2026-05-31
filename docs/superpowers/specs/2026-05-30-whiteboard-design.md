# Whiteboard Feature Design

**Date:** 2026-05-30
**Status:** Approved — ready for implementation planning

---

## Summary

A collaborative, real-time whiteboard for video call participants. The host can draw and can grant/revoke drawing rights to specific participants. Strokes are synced via the existing Socket.io signaling server. The whiteboard is ephemeral — all strokes are lost when closed or when the call ends.

---

## Decisions

| Question | Decision |
|---|---|
| UI placement | Full-screen modal — whiteboard takes the entire window; participant video thumbnails move to a strip at the bottom |
| Who can draw | Permission-based — host draws by default; host can grant/revoke drawing rights to specific participants |
| Tool set | Minimal MVP — pen, eraser, 4 color swatches (`#222222`, `#ff4444`, `#4a9eff`, `#22cc22`), clear canvas |
| Persistence | Ephemeral — canvas resets on close or call end; no storage |
| Sync mechanism | Signaling server relay — strokes broadcast via Socket.io room events, consistent with chat/polls/reactions |

---

## Architecture

### New Files

| File | Role |
|---|---|
| `src/v2/call/WhiteboardController.tsx` | Headless component — wires socket events to store (pattern: `RecordingController`, `TranscriptionController`) |
| `src/v2/call/WhiteboardModal.tsx` | Full-screen modal — toolbar + `<canvas>` |
| `src/v2/call/WhiteboardToolbar.tsx` | Pen / eraser / 4 color swatches / clear button |
| `src/v2/store/useWhiteboardStore.ts` | Zustand store — strokes, granted peer IDs, current tool/color |

### Modified Files

| File | Change |
|---|---|
| `src/v2/store/useUIStore.ts` | Add `isWhiteboardOpen: boolean` + `toggleWhiteboard()` — mutually exclusive with Chat/Participants/QA/AI panels |
| `src/v2/call/PeerManager.tsx` | Add 4 emit methods + socket listeners for whiteboard events |
| `src/v2/call/ControlBar.tsx` | Add whiteboard toggle button (pencil icon), same Button pattern as existing panel toggles |
| `src/v2/pages/RoomV2.tsx` | Mount `<WhiteboardController />`, conditionally render `<WhiteboardModal />` when `isWhiteboardOpen` |
| `signaling-server.js` | Room-scoped broadcast for 4 whiteboard socket events |

---

## Data Model

```ts
type StrokePoint = { x: number; y: number }  // normalized: x/width, y/height

type Stroke = {
  id: string           // nanoid — dedup on re-emit
  tool: 'pen' | 'eraser'
  color: string        // hex color string
  width: number        // pen: 3, eraser: 20
  points: StrokePoint[]
  drawerId: string     // socket ID of the peer who drew
}
```

Points are stored as **normalized fractions** (`x / canvasWidth`, `y / canvasHeight`) so strokes render correctly across different viewport sizes.

---

## Socket Events

All events are room-scoped broadcasts. No server-side persistence.

| Event | Emitter | Payload | Server action |
|---|---|---|---|
| `whiteboard-stroke` | Any drawer | `Stroke` | Broadcast to all room members |
| `whiteboard-clear` | Host only | `{}` | Broadcast to all room members |
| `whiteboard-grant` | Host only | `{ peerId: string }` | Broadcast to all room members |
| `whiteboard-revoke` | Host only | `{ peerId: string }` | Broadcast to all room members |

Strokes are emitted on `mouseup` (one message per complete stroke, not per point). A typical stroke is 20–80 normalized points ≈ under 1KB.

---

## Store — `useWhiteboardStore`

```ts
interface WhiteboardStore {
  strokes: Stroke[]
  grantedPeerIds: Set<string>
  currentTool: 'pen' | 'eraser'
  currentColor: string       // default: '#222222'
  addStroke: (stroke: Stroke) => void
  clearStrokes: () => void
  grantDrawing: (peerId: string) => void
  revokeDrawing: (peerId: string) => void
  setTool: (tool: 'pen' | 'eraser') => void
  setColor: (color: string) => void
}
```

Store is ephemeral — no persistence, resets on call end.

---

## Permission Model

```
canDraw = isHost || grantedPeerIds.has(mySocketId)
```

- `isHost` — from existing `useCallStore`
- Host sees Grant/Revoke buttons next to each participant name inside `WhiteboardModal`
- Participants with `canDraw = true` see the full toolbar
- Participants with `canDraw = false` see the canvas read-only (toolbar hidden)
- Permission enforcement is client-side only (MVP — server trusts all clients)

---

## Canvas Rendering

**Element:** `useRef<HTMLCanvasElement>` — direct DOM access, bypasses React render cycle for drawing performance.

**Draw loop:**
1. `mousedown` → start accumulating points into `currentStrokeRef`
2. `mousemove` → push point + `requestAnimationFrame` to redraw in-progress stroke
3. `mouseup` / `mouseleave` → finalize stroke → call `onStroke(stroke)` prop → `addStroke` to store

**Full repaint** triggered on every `strokes` store change (remote stroke arrives):
- Clear canvas
- Iterate `strokes` array
- Replay each: `ctx.beginPath()` → `ctx.moveTo(first point)` → `ctx.lineTo(...)` per point → `ctx.stroke()`

**Eraser:** uses `ctx.globalCompositeOperation = 'destination-out'` — composites transparency rather than painting white.

**Coordinate normalization:** all points stored as `{ x: rawX / canvas.width, y: rawY / canvas.height }`. On render, multiply back by current canvas dimensions. Handles window resize and cross-peer viewport differences.

---

## `WhiteboardModal` Layout

```
┌─────────────────────────────────────────────┐
│ ✏️ Whiteboard — room-abc    [↩ Exit]         │  ← modal header
├─────────────────────────────────────────────┤
│  [✏️] [🧹]  ⬤ ⬤ ⬤ ⬤  [Clear]  [Grant: ...]│  ← WhiteboardToolbar (canDraw only)
├─────────────────────────────────────────────┤
│                                             │
│              <canvas>                       │  ← full remaining height
│                                             │
├─────────────────────────────────────────────┤
│  [👤 Alice] [👤 Bob] [👤 Carol]             │  ← participant video thumbnail strip
└─────────────────────────────────────────────┘
```

The participant strip at the bottom reuses `<ThumbnailStrip />` directly (same component as `RoomV2`) — participants remain visible while drawing. No changes to `ThumbnailStrip` needed.

---

## `PeerManagerHandle` additions

```ts
broadcastWhiteboardStroke: (stroke: Stroke) => void
broadcastWhiteboardClear: () => void
broadcastWhiteboardGrant: (peerId: string) => void
broadcastWhiteboardRevoke: (peerId: string) => void
```

`WhiteboardController` calls these via `peerManagerRef.current`.

---

## Testing

| Test file | Coverage |
|---|---|
| `tests/unit/v2/store/useWhiteboardStore.test.ts` | `addStroke`, `clearStrokes`, `grantDrawing`, `revokeDrawing`, `setTool`, `setColor` |
| `tests/unit/v2/call/WhiteboardController.test.tsx` | `whiteboard-stroke` → `addStroke`; `whiteboard-clear` → `clearStrokes`; `whiteboard-grant`/`whiteboard-revoke` → `grantedPeerIds` |
| `tests/unit/v2/call/WhiteboardModal.test.tsx` | Toolbar renders; canvas present; `onStroke` fires on mouseup; `onClear` fires on clear; toolbar hidden when `canDraw=false` |
| `tests/unit/v2/call/PeerManager.test.tsx` *(extend)* | `broadcastWhiteboardStroke` emits `whiteboard-stroke`; `broadcastWhiteboardClear` emits `whiteboard-clear`; grant/revoke emit correct payloads |
| `tests/unit/v2/store/useUIStore.test.ts` *(extend)* | `toggleWhiteboard` opens whiteboard and closes all other panels |

All tests follow TDD: failing tests written first, then implementation.

---

## Out of Scope (MVP)

- Undo/redo
- Shapes (rectangle, circle, arrow)
- Text tool
- Sticky notes
- Image upload
- PNG export
- Server-side permission enforcement
- Whiteboard persistence across calls
- Mobile/touch support
