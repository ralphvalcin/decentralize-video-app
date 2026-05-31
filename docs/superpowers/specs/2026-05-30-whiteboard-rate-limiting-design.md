# Whiteboard Stroke Rate-Limiting Design

**Date:** 2026-05-30
**Status:** Approved — ready for implementation planning

---

## Summary

Add server-side rate-limiting to `whiteboard-stroke` events in `signaling-server.js` using the existing `rateLimiter` infrastructure. Prevents abusive clients from flooding the room with strokes.

---

## Architecture

**One file modified:** `signaling-server.js`

---

## Implementation

**Step 1 — Add to the rate-limit config object** (same place `send-message` is configured):

```js
'whiteboard-stroke': { limit: 60, window: 60000 },
```

60 strokes per minute per socket. A normal drawing session produces ~5–15 strokes/minute; 60 gives 4× headroom for fast sketching while blocking floods.

**Step 2 — Wrap the `whiteboard-stroke` handler** with the same guard used for `send-message`:

```js
socket.on('whiteboard-stroke', (stroke) => {
  if (!rateLimiter.checkLimit(socket.id, 'whiteboard-stroke')) {
    socket.emit('error', { message: 'Rate limit exceeded for whiteboard', code: 'RATE_LIMIT_EXCEEDED' })
    return
  }
  try {
    const user = users[socket.id]
    if (user && user.roomId) {
      socket.broadcast.to(user.roomId).emit('whiteboard-stroke', stroke)
    }
  } catch (error) {
    console.error('Error in whiteboard-stroke:', error)
  }
})
```

`whiteboard-clear`, `whiteboard-grant`, `whiteboard-revoke` are low-frequency events — no rate-limiting needed for those.

---

## Testing

No unit test needed — `rateLimiter` is a server-side utility without a test harness in this project. Verify with `node --check signaling-server.js` after the change.

---

## Out of Scope

- Per-room rate limiting (per-socket is sufficient)
- Client-side throttling of stroke events
