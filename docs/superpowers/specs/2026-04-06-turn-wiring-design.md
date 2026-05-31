# TURN Server Wiring Design

**Date:** 2026-04-06  
**Status:** Approved

## Goal

Wire v2 `PeerManager` to the existing TURN credential infrastructure that is already implemented but never called. Fix three bugs in the service layer that cause incorrect caching behavior. Document required env vars.

## Context

`TURNCredentialService` and the `request-turn-credentials` socket event exist and work. The v2 `PeerManager` ignores them entirely — it uses a hardcoded Google STUN array. This means all v2 calls fall back to STUN-only, which fails for users behind symmetric NAT.

## Architecture

On mount, `PeerManager` emits `request-turn-credentials` before registering any peer-creating socket handlers. It waits up to 3 seconds for the response. The resolved ICE config (or STUN fallback) is stored in an `iceServersRef`. All `SimplePeer` instances read from that ref.

```
PeerManager mount
  → emit request-turn-credentials
      ├─ turn-credentials        → iceServersRef = turnConfig.servers
      ├─ turn-credentials-error  → iceServersRef = ICE_SERVERS (fallback)
      └─ 3s timeout              → iceServersRef = ICE_SERVERS (fallback)
  → register peer socket handlers (user-joined, offer, answer, ice-candidate, user-left)
```

The `ICE_SERVERS` constant (two Google STUN servers) remains as the fallback value — never removed.

## Files

| File | Change |
|------|--------|
| `src/v2/call/PeerManager.tsx` | Fetch-on-mount; gate peer handler registration behind resolved ICE config |
| `signaling-server.js` | User-exists guard before rate limit check in `request-turn-credentials` handler |
| `src/services/TURNCredentialService.js` | Fix 1: cache key uses server URL not userId. Fix 2: propagate `expires` onto server object |
| `env.example` | Document `TURN_SERVER_URL`, `TURN_SECRET`, `TURN_SERVER_URL_2`, `TURN_SECRET_2` |

## Detailed Changes

### 1. `src/v2/call/PeerManager.tsx`

Add an `initIceConfig` async function called inside the mount `useEffect`, before the block that registers `user-joined`, `offer`, `answer`, `ice-candidate`, `user-left` handlers:

```ts
const iceServersRef = useRef<RTCIceServer[]>(ICE_SERVERS)

async function initIceConfig(): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('[PeerManager] TURN credential timeout — using STUN fallback')
      resolve()
    }, 3000)

    socket.once('turn-credentials', (config) => {
      clearTimeout(timeout)
      if (Array.isArray(config.servers) && config.servers.length > 0) {
        iceServersRef.current = config.servers
      }
      resolve()
    })

    socket.once('turn-credentials-error', (err) => {
      clearTimeout(timeout)
      console.warn('[PeerManager] TURN credential error:', err.code, '— using STUN fallback')
      resolve()
    })

    socket.emit('request-turn-credentials')
  })
}
```

All `new SimplePeer({ config: { iceServers: ICE_SERVERS } })` calls become `new SimplePeer({ config: { iceServers: iceServersRef.current } })`.

Mount effect structure:
```ts
useEffect(() => {
  initIceConfig().then(() => {
    // register user-joined, offer, answer, ice-candidate, user-left handlers here
  })
  return () => { /* cleanup */ }
}, [])
```

### 2. `signaling-server.js`

Move the user-exists check before the rate limit check:

```js
socket.on('request-turn-credentials', async () => {
  // Guard: user must have joined a room
  const user = users[socket.id]
  if (!user) {
    socket.emit('turn-credentials-error', {
      message: 'Must join a room before requesting TURN credentials',
      code: 'AUTH_REQUIRED'
    })
    return
  }

  // Then rate limit
  if (!rateLimiter.checkLimit(socket.id, 'turn-credentials', 10)) {
    socket.emit('turn-credentials-error', {
      message: 'Rate limit exceeded for TURN credentials',
      code: 'RATE_LIMIT_EXCEEDED'
    })
    return
  }

  const turnConfig = await turnCredentialService.getTURNCredentials(user.id)
  // ... rest unchanged
})
```

### 3. `src/services/TURNCredentialService.js`

**Fix 1 — cache key:** Replace per-userId key with per-server key so all users sharing the same TURN server reuse one cache entry:

```js
// Before
const cacheKey = `turn-credentials-${userId}`

// After
const serverKey = process.env.TURN_SERVER_URL || 'default'
const cacheKey = `turn-credentials-${serverKey}`
```

**Fix 2 — expires propagation:** Add `expires` to each server object when pushing:

```js
// Before
turnConfig.servers.push({
  urls: [...],
  username: credentials.username,
  credential: credentials.password,
  credentialType: 'password'
})

// After
turnConfig.servers.push({
  urls: [...],
  username: credentials.username,
  credential: credentials.password,
  credentialType: 'password',
  expires: credentials.expires        // ← carry TTL through for cache Math.min()
})
```

Same fix for the secondary server block (`TURN_SERVER_URL_2`).

### 4. `env.example`

```bash
# TURN Server (required for NAT traversal in production)
TURN_SERVER_URL=your-turn-server-hostname-or-ip
TURN_SECRET=your-turn-shared-secret
# Optional secondary TURN server for redundancy
TURN_SERVER_URL_2=
TURN_SECRET_2=
```

## Tests

### `tests/unit/v2/call/PeerManager.test.tsx`

- `fetches TURN credentials on mount and passes them to SimplePeer` — mock socket emitting `turn-credentials` with one server; assert `SimplePeer` constructor receives that server in `config.iceServers`
- `falls back to ICE_SERVERS on turn-credentials-error` — mock socket emitting `turn-credentials-error`; assert `SimplePeer` receives `ICE_SERVERS`
- `falls back to ICE_SERVERS on 3s timeout` — use fake timers, advance 3001ms without emitting anything; assert fallback

### `tests/unit/services/TURNCredentialService.test.js`

- `cache key is based on server URL not userId` — call `getTURNCredentials('alice')` and `getTURNCredentials('bob')` with same env; assert `credentialCache.size === 1`
- `expires is stored on server objects` — call `getTURNCredentials`; assert each server in result has numeric `expires` field
- `cache is reused within TTL` — call twice; assert `generateTURNCredentials` called once (spy)
- `cache is bypassed after TTL` — set `expires` to past; call again; assert regenerated

### `signaling-server.js` (existing test file or integration test)

- `returns AUTH_REQUIRED when socket has not joined` — emit `request-turn-credentials` before `join`; assert `turn-credentials-error` with `code: 'AUTH_REQUIRED'`
- `returns credentials when user has joined` — join first, then emit; assert `turn-credentials` received

## Failure modes

| Scenario | Behavior |
|----------|----------|
| TURN env vars not set | `turnConfig.servers` is empty; server emits `turn-credentials` with empty array; PeerManager falls back to STUN |
| TURN server unreachable at call time | WebRTC ICE fails on TURN candidates, falls back to STUN candidates automatically (browser behavior) |
| Socket not yet authenticated | Server returns `AUTH_REQUIRED`; PeerManager uses STUN fallback |
| Credential fetch takes > 3s | Timeout fires; PeerManager uses STUN fallback and proceeds |
