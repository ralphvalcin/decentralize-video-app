# TURN Server Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire v2 PeerManager to the existing TURN credential infrastructure and fix three bugs that prevent credentials from being cached correctly.

**Architecture:** `PeerManager` emits `request-turn-credentials` immediately after `join-room`; once-listeners on `turn-credentials` / `turn-credentials-error` update an `iceServersRef` that all `SimplePeer` constructors read from. The signaling server gains a user-exists guard before the rate-limit check. `TURNCredentialService` gets a server-URL-based cache key and carries `expires` through to the cached server object.

**Tech Stack:** TypeScript, React, simple-peer, socket.io-client, Jest/jsdom

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `src/services/TURNCredentialService.js` | Modify | Fix cache key (server URL, not userId); add `expires` to pushed server objects |
| `signaling-server.js` | Modify | Extract handler into `handleTurnCredentialsRequest`; add user-exists guard before rate-limit |
| `src/v2/call/PeerManager.tsx` | Modify | Add `iceServersRef`; emit `request-turn-credentials` in `room-token` handler; use `iceServersRef.current` in all `new Peer(...)` calls |
| `env.example` | Modify | Document four TURN env vars |
| `tests/unit/services/TURNCredentialService.test.js` | Create | Unit tests for cache key and expires |
| `tests/unit/signaling/turnCredentials.test.js` | Create | Unit tests for the extracted handler function |
| `tests/unit/v2/call/PeerManager.test.tsx` | Modify | Add three TURN wiring tests |

---

## Task 1: Fix TURNCredentialService — cache key and expires propagation

**Files:**
- Modify: `src/services/TURNCredentialService.js:42-86`
- Create: `tests/unit/services/TURNCredentialService.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/services/TURNCredentialService.test.js`:

```js
import { TURNCredentialService } from '../../../src/services/TURNCredentialService.js'

function makeService(env = {}) {
  const origEnv = { ...process.env }
  Object.assign(process.env, env)
  const svc = new TURNCredentialService()
  // restore env after construction (credentials read at call time, not construction)
  Object.assign(process.env, origEnv)
  return { svc, env }
}

const ENV = {
  TURN_SERVER_URL: 'turn.example.com',
  TURN_SECRET: 'secret-abc',
}

afterEach(() => {
  delete process.env.TURN_SERVER_URL
  delete process.env.TURN_SECRET
  delete process.env.TURN_SERVER_URL_2
  delete process.env.TURN_SECRET_2
})

test('returned server objects include numeric expires field', async () => {
  Object.assign(process.env, ENV)
  const svc = new TURNCredentialService()
  const config = await svc.getTURNCredentials('alice')
  expect(typeof config.servers[0].expires).toBe('number')
  expect(config.servers[0].expires).toBeGreaterThan(Date.now())
})

test('cache key is based on server URL — two users share one cache entry', async () => {
  Object.assign(process.env, ENV)
  const svc = new TURNCredentialService()
  await svc.getTURNCredentials('alice')
  await svc.getTURNCredentials('bob')
  expect(svc.credentialCache.size).toBe(1)
})

test('second call within TTL returns cached result without regenerating', async () => {
  Object.assign(process.env, ENV)
  const svc = new TURNCredentialService()
  const genSpy = jest.spyOn(svc, 'generateTURNCredentials')
  await svc.getTURNCredentials('alice')
  await svc.getTURNCredentials('alice')
  expect(genSpy).toHaveBeenCalledTimes(1)
})

test('cache miss after manual expiry regenerates credentials', async () => {
  Object.assign(process.env, ENV)
  const svc = new TURNCredentialService()
  await svc.getTURNCredentials('alice')
  // Force expire
  const [key, entry] = [...svc.credentialCache.entries()][0]
  svc.credentialCache.set(key, { ...entry, expires: Date.now() - 1000 })
  const genSpy = jest.spyOn(svc, 'generateTURNCredentials')
  await svc.getTURNCredentials('alice')
  expect(genSpy).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "/Users/ralphucious/App Builds/decentralized-video-app"
npx jest tests/unit/services/TURNCredentialService.test.js --no-coverage
```

Expected: 2–4 failures — `expires` is undefined, cache has multiple entries.

- [ ] **Step 3: Fix `getTURNCredentials` in `src/services/TURNCredentialService.js`**

Replace the two `turnConfig.servers.push(...)` blocks (lines ~61–70 and ~76–85). The only change is adding `expires: credentials.expires` to each pushed object, and changing the `cacheKey` from userId to server URL:

```js
async getTURNCredentials(userId = 'anonymous') {
  // Cache key: server URL (credentials are server-specific, not user-specific)
  const serverKey = process.env.TURN_SERVER_URL || 'default';
  const cacheKey = `turn-credentials-${serverKey}`;
  const cached = this.credentialCache.get(cacheKey);

  if (cached && Date.now() < cached.expires - 300000) {
    return cached.config;
  }

  const turnConfig = {
    servers: [],
    iceTransportPolicy: 'all',
    generated: Date.now()
  };

  try {
    if (process.env.TURN_SERVER_URL && process.env.TURN_SECRET) {
      const credentials = this.generateTURNCredentials(process.env.TURN_SECRET);
      turnConfig.servers.push({
        urls: [
          `turn:${process.env.TURN_SERVER_URL}:3478?transport=udp`,
          `turn:${process.env.TURN_SERVER_URL}:3478?transport=tcp`,
          `turns:${process.env.TURN_SERVER_URL}:5349?transport=tcp`
        ],
        username: credentials.username,
        credential: credentials.password,
        credentialType: 'password',
        expires: credentials.expires,          // ← carry TTL through
      });
    }

    if (process.env.TURN_SERVER_URL_2 && process.env.TURN_SECRET_2) {
      const credentials = this.generateTURNCredentials(process.env.TURN_SECRET_2);
      turnConfig.servers.push({
        urls: [
          `turn:${process.env.TURN_SERVER_URL_2}:3478?transport=udp`,
          `turn:${process.env.TURN_SERVER_URL_2}:3478?transport=tcp`,
          `turns:${process.env.TURN_SERVER_URL_2}:5349?transport=tcp`
        ],
        username: credentials.username,
        credential: credentials.password,
        credentialType: 'password',
        expires: credentials.expires,          // ← carry TTL through
      });
    }

    if (this.twilioConfig) {
      const twilioTurnServers = await this.getTwilioTURNServers();
      turnConfig.servers.push(...twilioTurnServers);
    }

    if (turnConfig.servers.length > 0) {
      const expires = Math.min(...turnConfig.servers.map(s => s.expires || Date.now() + 86400000));
      this.credentialCache.set(cacheKey, { config: turnConfig, expires });
    }

    return turnConfig;
  } catch (error) {
    console.error('Error generating TURN credentials:', error);
    throw new Error(`TURN credential generation failed: ${error.message}`);
  }
}
```

- [ ] **Step 4: Run tests — all should pass**

```bash
npx jest tests/unit/services/TURNCredentialService.test.js --no-coverage
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/services/TURNCredentialService.js tests/unit/services/TURNCredentialService.test.js
git commit -m "fix(turn): correct cache key and propagate expires to server objects

Cache was keyed per-userId causing unbounded growth; all users sharing
a TURN server now reuse one cache entry. The expires value from
generateTURNCredentials was never stored on the server object so
Math.min() always produced Date.now()+86400000 regardless of TTL."
```

---

## Task 2: Fix signaling server — user-exists guard before rate limit

**Files:**
- Modify: `signaling-server.js:976-1026`
- Create: `tests/unit/signaling/turnCredentials.test.js`

- [ ] **Step 1: Extract the handler into a testable function at the top of `signaling-server.js`**

Find the `request-turn-credentials` socket handler (around line 976). Extract its body into a named function placed just above the `io.on('connection', ...)` block. Add the user-exists guard as the first check:

```js
// Place this above the io.on('connection', ...) block
export async function handleTurnCredentialsRequest(socket, { users, rateLimiter, turnCredentialService, performanceMonitor, logSecurityEvent }) {
  const requestStart = Date.now();

  // Guard: socket must have joined a room
  const user = users[socket.id];
  if (!user) {
    socket.emit('turn-credentials-error', {
      message: 'Must join a room before requesting TURN credentials',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  if (!rateLimiter.checkLimit(socket.id, 'turn-credentials', 10)) {
    socket.emit('turn-credentials-error', { message: 'Rate limit exceeded for TURN credentials', code: 'RATE_LIMIT_EXCEEDED' });
    performanceMonitor.recordError();
    return;
  }

  try {
    logSecurityEvent('TURN_CREDENTIALS_REQUESTED', user.id, {
      userAgent: socket.handshake.headers['user-agent'],
      ip: socket.handshake.address,
    });

    const turnConfig = await turnCredentialService.getTURNCredentials(user.id);

    if (turnConfig && turnConfig.servers.length > 0) {
      socket.emit('turn-credentials', turnConfig);
      logSecurityEvent('TURN_CREDENTIALS_PROVIDED', user.id, {
        serverCount: turnConfig.servers.length,
        hasAuthentication: turnConfig.servers.every(s => s.username && s.credential),
      });
      performanceMonitor.recordMessage(Date.now() - requestStart);
    } else {
      socket.emit('turn-credentials-error', { message: 'No TURN servers configured', code: 'NO_TURN_SERVERS' });
      performanceMonitor.recordError();
    }
  } catch (error) {
    console.error('Error providing TURN credentials:', error);
    logSecurityEvent('TURN_CREDENTIALS_ERROR', socket.id, { error: error.message, severity: 'high' });
    socket.emit('turn-credentials-error', { message: 'Failed to generate TURN credentials', code: 'SERVER_ERROR' });
    performanceMonitor.recordError();
  }
}
```

Then replace the inline handler body:

```js
socket.on('request-turn-credentials', () =>
  handleTurnCredentialsRequest(socket, { users, rateLimiter, turnCredentialService, performanceMonitor, logSecurityEvent })
);
```

- [ ] **Step 2: Write failing test**

Create `tests/unit/signaling/turnCredentials.test.js`:

```js
import { handleTurnCredentialsRequest } from '../../../signaling-server.js'

function makeSocket(id = 'socket-1') {
  return {
    id,
    emit: jest.fn(),
    handshake: { headers: { 'user-agent': 'jest' }, address: '127.0.0.1' },
  }
}

const deps = {
  users: {},
  rateLimiter: { checkLimit: jest.fn(() => true) },
  turnCredentialService: {
    getTURNCredentials: jest.fn(async () => ({
      servers: [{ urls: ['turn:example.com:3478'], username: 'u', credential: 'p' }],
    })),
  },
  performanceMonitor: { recordError: jest.fn(), recordMessage: jest.fn() },
  logSecurityEvent: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  deps.users = {}
  deps.rateLimiter.checkLimit.mockReturnValue(true)
})

test('emits AUTH_REQUIRED when socket has not joined', async () => {
  const socket = makeSocket()
  // users is empty — socket hasn't joined
  await handleTurnCredentialsRequest(socket, deps)
  expect(socket.emit).toHaveBeenCalledWith('turn-credentials-error', expect.objectContaining({ code: 'AUTH_REQUIRED' }))
  expect(deps.rateLimiter.checkLimit).not.toHaveBeenCalled()
})

test('emits RATE_LIMIT_EXCEEDED when joined but over limit', async () => {
  const socket = makeSocket()
  deps.users['socket-1'] = { id: 'user-1' }
  deps.rateLimiter.checkLimit.mockReturnValue(false)
  await handleTurnCredentialsRequest(socket, deps)
  expect(socket.emit).toHaveBeenCalledWith('turn-credentials-error', expect.objectContaining({ code: 'RATE_LIMIT_EXCEEDED' }))
})

test('emits turn-credentials when joined and within rate limit', async () => {
  const socket = makeSocket()
  deps.users['socket-1'] = { id: 'user-1' }
  await handleTurnCredentialsRequest(socket, deps)
  expect(socket.emit).toHaveBeenCalledWith('turn-credentials', expect.objectContaining({ servers: expect.any(Array) }))
})

test('emits NO_TURN_SERVERS when service returns empty servers array', async () => {
  const socket = makeSocket()
  deps.users['socket-1'] = { id: 'user-1' }
  deps.turnCredentialService.getTURNCredentials.mockResolvedValueOnce({ servers: [] })
  await handleTurnCredentialsRequest(socket, deps)
  expect(socket.emit).toHaveBeenCalledWith('turn-credentials-error', expect.objectContaining({ code: 'NO_TURN_SERVERS' }))
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx jest tests/unit/signaling/turnCredentials.test.js --no-coverage
```

Expected: 4 failures — `handleTurnCredentialsRequest` is not exported yet.

- [ ] **Step 4: Apply the signaling server change**

In `signaling-server.js`:
1. Add the `handleTurnCredentialsRequest` function above the `io.on('connection', ...)` block (full function body from Step 1 above).
2. Add `export` keyword to the function declaration.
3. Replace the `socket.on('request-turn-credentials', async () => { ... })` inline body with the one-liner from Step 1.

- [ ] **Step 5: Run tests — all should pass**

```bash
npx jest tests/unit/signaling/turnCredentials.test.js --no-coverage
```

Expected: 4 passing.

- [ ] **Step 6: Commit**

```bash
git add signaling-server.js tests/unit/signaling/turnCredentials.test.js
git commit -m "fix(signaling): guard turn-credentials behind user-exists check

Unauthenticated sockets could previously trigger rate-limit consumption
and receive TURN credentials (falling back to socket.id as userId).
User-exists check now runs before rate-limit. Extract handler into
handleTurnCredentialsRequest() for testability."
```

---

## Task 3: Wire v2 PeerManager to fetch TURN credentials on join

**Files:**
- Modify: `src/v2/call/PeerManager.tsx:12,91-140`
- Modify: `tests/unit/v2/call/PeerManager.test.tsx`

- [ ] **Step 1: Write three failing tests**

Add to `tests/unit/v2/call/PeerManager.test.tsx` after the existing tests:

```tsx
import { ICE_SERVERS } from '../../../../src/v2/call/PeerManager'
import SimplePeer from 'simple-peer'

// (SimplePeer is already mocked at the top of this file as jest.fn(() => mockPeerInstance))
const MockPeer = SimplePeer as jest.MockedClass<typeof SimplePeer>

test('emits request-turn-credentials after join-room', async () => {
  await act(async () => { render(<PeerManager />) })
  act(() => {
    fireSocketEvent('connect')
    fireSocketEvent('room-token', { token: 'tok' })
  })
  expect(mockSocket.emit).toHaveBeenCalledWith('request-turn-credentials')
})

test('uses fetched TURN servers when turn-credentials arrives before all-users', async () => {
  const turnServers = [{ urls: ['turn:test.example.com:3478'], username: 'u', credential: 'p' }]
  await act(async () => { render(<PeerManager />) })
  act(() => {
    fireSocketEvent('connect')
    fireSocketEvent('room-token', { token: 'tok' })
    // TURN arrives before all-users
    fireSocketEvent('turn-credentials', { servers: turnServers })
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })
  const constructorCall = MockPeer.mock.calls[0][0] as any
  expect(constructorCall.config.iceServers).toEqual(turnServers)
})

test('falls back to ICE_SERVERS when turn-credentials-error fires', async () => {
  await act(async () => { render(<PeerManager />) })
  act(() => {
    fireSocketEvent('connect')
    fireSocketEvent('room-token', { token: 'tok' })
    fireSocketEvent('turn-credentials-error', { code: 'NO_TURN_SERVERS' })
    fireSocketEvent('all-users', [{ id: 'peer-a', name: 'Alice', role: 'guest' }])
  })
  const constructorCall = MockPeer.mock.calls[0][0] as any
  expect(constructorCall.config.iceServers).toEqual(ICE_SERVERS)
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/unit/v2/call/PeerManager.test.tsx --no-coverage
```

Expected: 3 new failures — `request-turn-credentials` never emitted, peer always uses `ICE_SERVERS`.

- [ ] **Step 3: Update `src/v2/call/PeerManager.tsx`**

Add `iceServersRef` after `reactionTimersRef`:

```ts
const reactionTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
const iceServersRef = useRef<RTCIceServer[]>(ICE_SERVERS)   // ← add this line
```

In the `room-token` handler (around line 99), emit `request-turn-credentials` and register once-listeners:

```ts
socket.on('room-token', ({ token }: { token: string }) => {
  socket.emit('join-room', { roomId, token, name: userName, role: 'guest' })

  // Request TURN credentials right after joining; update ref when they arrive.
  // iceServersRef starts as ICE_SERVERS so peer creation is never blocked.
  socket.emit('request-turn-credentials')
  socket.once('turn-credentials', (config: { servers: RTCIceServer[] }) => {
    if (Array.isArray(config?.servers) && config.servers.length > 0) {
      iceServersRef.current = config.servers
    }
  })
  socket.once('turn-credentials-error', (err: { code: string }) => {
    console.warn('[PeerManager] TURN credential error:', err?.code, '— using STUN fallback')
  })
})
```

Replace both `ICE_SERVERS` references in `all-users` and `user-joined` handlers:

```ts
// In all-users handler (line ~108):
config: { iceServers: iceServersRef.current },

// In user-joined handler (line ~130):
config: { iceServers: iceServersRef.current },
```

- [ ] **Step 4: Run tests — all should pass**

```bash
npx jest tests/unit/v2/call/PeerManager.test.tsx --no-coverage
```

Expected: all existing tests plus 3 new ones passing.

- [ ] **Step 5: Run full suite to check for regressions**

```bash
npx jest --no-coverage
```

Expected: all tests passing, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/v2/call/PeerManager.tsx tests/unit/v2/call/PeerManager.test.tsx
git commit -m "feat(v2): wire PeerManager to fetch TURN credentials on join

Emit request-turn-credentials immediately after join-room in the
room-token handler. Once-listeners update iceServersRef when
turn-credentials arrives. All SimplePeer constructors read from
iceServersRef.current instead of the hardcoded ICE_SERVERS constant.
Falls back silently to STUN-only on error or if no servers configured."
```

---

## Task 4: Document TURN env vars in env.example

**Files:**
- Modify: `env.example`

- [ ] **Step 1: Add TURN vars to `env.example`**

Append to `env.example`:

```bash
# TURN Server — required for WebRTC NAT traversal in production
# Set these on your hosting provider (Render, Railway, etc.)
TURN_SERVER_URL=your-turn-server-hostname-or-ip
TURN_SECRET=your-turn-shared-secret
# Optional secondary TURN server for redundancy
TURN_SERVER_URL_2=
TURN_SECRET_2=
```

- [ ] **Step 2: Commit**

```bash
git add env.example
git commit -m "docs: document TURN env vars in env.example

TURN_SERVER_URL and TURN_SECRET were required for production NAT
traversal but undocumented. Adds all four vars with descriptions."
```

---

## Self-Review

**Spec coverage check:**
- ✅ `TURNCredentialService` cache key bug — Task 1
- ✅ `TURNCredentialService` expires propagation bug — Task 1
- ✅ Signaling server user-exists guard before rate limit — Task 2
- ✅ v2 PeerManager fetch-on-join — Task 3
- ✅ `env.example` documentation — Task 4
- ✅ Fallback to `ICE_SERVERS` on error — Task 3 Step 3
- ✅ Fallback to `ICE_SERVERS` on `turn-credentials-error` — Task 3 tests

**Placeholder scan:** None found.

**Type consistency:** `RTCIceServer[]` used consistently. `iceServersRef.current` typed correctly. `ICE_SERVERS` export unchanged and reused as fallback.
