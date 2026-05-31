# Whiteboard Touch Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add touch/stylus drawing support to the whiteboard canvas so users on iPads and touch-enabled devices can draw.

**Architecture:** Add three touch event handlers (`onTouchStart`, `onTouchMove`, `onTouchEnd`) to the `<canvas>` in `WhiteboardModal.tsx`, mirroring the existing mouse handlers. A `getTouchPoint` helper extracts normalized coordinates from `e.touches[0]`. `e.preventDefault()` prevents scroll/zoom during drawing.

**Tech Stack:** React 18, TypeScript, HTML5 Touch Events API.

---

## File Map

| File | Status | Role |
|---|---|---|
| `src/v2/call/WhiteboardModal.tsx` | Modify | Add touch handlers + `getTouchPoint` helper |

---

### Task 1: Add touch drawing support

**Files:**
- Modify: `src/v2/call/WhiteboardModal.tsx`
- Modify: `tests/unit/v2/call/WhiteboardModal.test.tsx`

- [ ] **Step 1: Write failing tests**

Open `tests/unit/v2/call/WhiteboardModal.test.tsx` and append these two tests at the end:

```ts
test('calls onStroke after touchstart → touchmove → touchend sequence', () => {
  render(<WhiteboardModal {...defaultProps} canDraw={true} />)
  const canvas = screen.getByTestId('whiteboard-canvas')

  fireEvent.touchStart(canvas, { touches: [{ clientX: 10, clientY: 10 }] })
  fireEvent.touchMove(canvas, { touches: [{ clientX: 20, clientY: 20 }] })
  fireEvent.touchEnd(canvas, { touches: [] })

  expect(defaultProps.onStroke).toHaveBeenCalledTimes(1)
  const stroke = defaultProps.onStroke.mock.calls[0][0]
  expect(stroke.points.length).toBeGreaterThanOrEqual(2)
  expect(stroke.tool).toBe('pen')
})

test('does not call onStroke on touch when canDraw is false', () => {
  render(<WhiteboardModal {...defaultProps} canDraw={false} />)
  const canvas = screen.getByTestId('whiteboard-canvas')

  fireEvent.touchStart(canvas, { touches: [{ clientX: 10, clientY: 10 }] })
  fireEvent.touchMove(canvas, { touches: [{ clientX: 20, clientY: 20 }] })
  fireEvent.touchEnd(canvas, { touches: [] })

  expect(defaultProps.onStroke).not.toHaveBeenCalled()
})
```

Note: if `defaultProps` in this test file now requires `onGrant`/`onRevoke` (added by the grant UI plan), include them: `onGrant: jest.fn(), onRevoke: jest.fn()`. Read the current `defaultProps` definition before editing.

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd "/Users/ralphucious/App Builds/decentralized-video-app"
npx jest tests/unit/v2/call/WhiteboardModal.test.tsx --no-coverage 2>&1 | tail -10
```
Expected: 2 new FAIL — `onStroke` not called after touch events

- [ ] **Step 3: Update `src/v2/call/WhiteboardModal.tsx`**

**3a — Add `getTouchPoint` helper** inside the component body, immediately after `getPoint`:

```ts
function getTouchPoint(e: React.TouchEvent<HTMLCanvasElement>): StrokePoint {
  const canvas = canvasRef.current!
  const rect = canvas.getBoundingClientRect()
  const touch = e.touches[0]
  return {
    x: (touch.clientX - rect.left) / (canvas.width || 1),
    y: (touch.clientY - rect.top) / (canvas.height || 1),
  }
}
```

**3b — Add three touch handlers** to the `<canvas>` element, immediately after `onMouseLeave={finalizeStroke}`:

```tsx
onTouchStart={(e) => {
  e.preventDefault()
  if (!canDraw) return
  isDrawingRef.current = true
  currentPointsRef.current = [getTouchPoint(e)]
}}
onTouchMove={(e) => {
  e.preventDefault()
  if (!isDrawingRef.current || !canDraw) return
  currentPointsRef.current.push(getTouchPoint(e))
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
}}
onTouchEnd={() => finalizeStroke()}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest tests/unit/v2/call/WhiteboardModal.test.tsx --no-coverage 2>&1 | tail -10
```
Expected: all tests passing (existing + 2 new touch tests)

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage 2>&1 | tail -8
```
Expected: all tests pass, 6 pre-existing integration failures only.

- [ ] **Step 6: Commit**

```bash
git add src/v2/call/WhiteboardModal.tsx tests/unit/v2/call/WhiteboardModal.test.tsx
git commit -m "feat(whiteboard): add touch/stylus drawing support"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Covered by |
|---|---|
| `onTouchStart` starts stroke with first touch point | Task 1 Step 3b |
| `onTouchMove` accumulates points + live preview | Task 1 Step 3b |
| `onTouchEnd` finalizes stroke via `finalizeStroke()` | Task 1 Step 3b |
| `e.preventDefault()` on touchstart + touchmove | Task 1 Step 3b |
| `canDraw=false` blocks touch drawing | Task 1 Step 3b guard + test |
| Normalized coordinates via `getTouchPoint` | Task 1 Step 3a |

### Placeholder scan
None found.

### Type consistency
`getTouchPoint` returns `StrokePoint` — same type as `getPoint`. `currentPointsRef.current` typed `StrokePoint[]` throughout.
