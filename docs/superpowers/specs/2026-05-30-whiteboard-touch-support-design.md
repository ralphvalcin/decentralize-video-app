# Whiteboard Touch Support Design

**Date:** 2026-05-30
**Status:** Approved — ready for implementation planning

---

## Summary

Add touch/stylus drawing support to `WhiteboardModal`. The canvas already has `touchAction: none` but no touch event handlers — this makes drawing impossible on iPads and touch-enabled devices.

---

## Architecture

**One file modified:** `src/v2/call/WhiteboardModal.tsx`

---

## Implementation

**New helper inside `WhiteboardModal`:**
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

**Three handlers added to `<canvas>`:**
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
  // same live-preview logic as handleMouseMove
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

`e.preventDefault()` on `touchstart` and `touchmove` prevents the browser from scrolling or zooming while drawing.

---

## Testing

| Test file | Coverage |
|---|---|
| `tests/unit/v2/call/WhiteboardModal.test.tsx` *(extend)* | `touchstart → touchmove → touchend` calls `onStroke`; touch does not call `onStroke` when `canDraw=false` |

Touch events fired via `fireEvent.touchStart`, `fireEvent.touchMove`, `fireEvent.touchEnd` in jsdom.

---

## Out of Scope

- Multi-touch / pinch-zoom
- Pressure sensitivity
- Palm rejection
