# Whiteboard Stroke Rate-Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side rate-limiting to `whiteboard-stroke` events so abusive clients cannot flood rooms with strokes.

**Architecture:** Add `'whiteboard-stroke': { limit: 60, window: 60000 }` to the existing `RateLimiter.defaultLimits` object in `signaling-server.js`, then wrap the `whiteboard-stroke` handler with the same `rateLimiter.checkLimit` guard used by `send-message`.

**Tech Stack:** Node.js, Socket.io, existing `RateLimiter` class in `signaling-server.js`.

---

## File Map

| File | Status | Role |
|---|---|---|
| `signaling-server.js` | Modify | Add `whiteboard-stroke` to rate-limit config + guard the handler |

---

### Task 1: Add rate-limiting to whiteboard-stroke

**Files:**
- Modify: `signaling-server.js`

- [ ] **Step 1: Add `whiteboard-stroke` to `defaultLimits`**

In `signaling-server.js`, find the `defaultLimits` object inside the `RateLimiter` constructor (around line 529). It currently ends with:
```js
'turn-credentials': { limit: 10, window: 60000 } // 10 per minute
```

Add `whiteboard-stroke` as a new entry (add a comma after `turn-credentials` line and append):
```js
'whiteboard-stroke': { limit: 60, window: 60000 }
```

The full updated `defaultLimits` block should look like:
```js
this.defaultLimits = {
  'token-request': { limit: 5, window: 60000 },
  'join-room': { limit: 3, window: 60000 },
  'send-message': { limit: 20, window: 60000 },
  'send-reaction': { limit: 30, window: 60000 },
  'create-poll': { limit: 5, window: 300000 },
  'vote-poll': { limit: 20, window: 60000 },
  'submit-question': { limit: 10, window: 300000 },
  'vote-question': { limit: 30, window: 60000 },
  'answer-question': { limit: 10, window: 300000 },
  'turn-credentials': { limit: 10, window: 60000 },
  'whiteboard-stroke': { limit: 60, window: 60000 }
};
```

- [ ] **Step 2: Wrap the `whiteboard-stroke` handler with rate-limit check**

Find the `whiteboard-stroke` handler (around line 1098). It currently reads:
```js
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
```

Replace with:
```js
socket.on('whiteboard-stroke', (stroke) => {
  if (!rateLimiter.checkLimit(socket.id, 'whiteboard-stroke')) {
    socket.emit('error', { message: 'Rate limit exceeded for whiteboard', code: 'RATE_LIMIT_EXCEEDED' });
    return;
  }
  try {
    const user = users[socket.id];
    if (user && user.roomId) {
      socket.broadcast.to(user.roomId).emit('whiteboard-stroke', stroke);
    }
  } catch (error) {
    console.error('Error in whiteboard-stroke:', error);
  }
});
```

- [ ] **Step 3: Verify server syntax**

```bash
cd "/Users/ralphucious/App Builds/decentralized-video-app"
node --check signaling-server.js && echo "syntax OK"
```
Expected: `syntax OK`

- [ ] **Step 4: Commit**

```bash
git add signaling-server.js
git commit -m "feat(whiteboard): rate-limit whiteboard-stroke to 60/min per socket"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Covered by |
|---|---|
| `whiteboard-stroke` rate-limited at 60/min | Step 1 — `defaultLimits` entry |
| Returns `RATE_LIMIT_EXCEEDED` error on breach | Step 2 — `socket.emit('error', ...)` |
| `whiteboard-clear`/`grant`/`revoke` not rate-limited | Not touched — correct per spec |

### Placeholder scan
None found.

### Type consistency
N/A — JavaScript, no types.
