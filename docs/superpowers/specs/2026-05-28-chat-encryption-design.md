# Chat E2E Encryption Design Spec

**Date:** 2026-05-28
**Status:** Approved

---

## Goal

Encrypt chat messages end-to-end so the signaling server never sees plaintext. Media streams are already encrypted via DTLS-SRTP (WebRTC default) — this spec covers text chat only.

---

## Approach

A standalone crypto utility module (`src/v2/lib/chatCrypto.ts`) exposes three pure async functions backed by `window.crypto.subtle` (Web Crypto API). `PeerManager.tsx` derives the room key once on connect, encrypts before emitting `send-message`, and decrypts incoming `new-message` and `chat-history` payloads before storing them. `ChatPanel.tsx` is unchanged.

---

## Section 1 — Crypto Utility (`src/v2/lib/chatCrypto.ts`)

Three exported async functions with no React dependencies:

### `deriveKey(roomId: string, secret: string): Promise<CryptoKey>`

Derives a non-extractable AES-GCM key using PBKDF2-SHA-256:

```ts
const keyMaterial = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(roomId + ':' + secret),
  { name: 'PBKDF2' },
  false,
  ['deriveKey'],
)
return crypto.subtle.deriveKey(
  {
    name: 'PBKDF2',
    salt: new TextEncoder().encode('decentralized-video-app-chat'),
    iterations: 100_000,
    hash: 'SHA-256',
  },
  keyMaterial,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt', 'decrypt'],
)
```

- Salt is static — acceptable because key material already varies per room (`roomId`) and per deployment (`VITE_CHAT_ENCRYPTION_SECRET`).
- Key is non-extractable: it cannot be read back out of the browser's crypto engine.

### `encryptMessage(text: string, key: CryptoKey): Promise<string>`

- Generates a random 12-byte IV via `crypto.getRandomValues`.
- Encrypts with AES-256-GCM (tag length: 128 bits, the Web Crypto default).
- Returns `btoa(String.fromCharCode(...iv, ...ciphertext))` — a single Base64 string with the IV prepended to the ciphertext.

### `decryptMessage(encoded: string, key: CryptoKey): Promise<string>`

- Base64-decodes the input.
- Splits the first 12 bytes as IV, the remainder as ciphertext (including the 16-byte GCM authentication tag).
- Decrypts with AES-256-GCM using the extracted IV.
- Returns the plaintext string.
- **Throws** on any failure (wrong key, corrupted data, truncated input) — callers catch and substitute `"[encrypted message]"`.

### Behavior when `VITE_CHAT_ENCRYPTION_SECRET` is unset

If the env var is missing or empty, `secret` is an empty string. Key derivation still runs — messages are encrypted with a weak key rather than skipped. This ensures the full encrypt/decrypt path is always exercised in development.

---

## Section 2 — PeerManager Integration (`src/v2/call/PeerManager.tsx`)

### Key derivation on connect

Add a ref to hold the derived key:

```ts
const cryptoKeyRef = useRef<CryptoKey | null>(null)
```

Inside the connect `useEffect`, wrap the existing body in an async IIFE and derive the key immediately after socket creation:

```ts
useEffect(() => {
  (async () => {
    const socket = io(...)
    socketRef.current = socket

    const secret = import.meta.env.VITE_CHAT_ENCRYPTION_SECRET ?? ''
    cryptoKeyRef.current = await deriveKey(roomId, secret)

    // ... rest of existing listener setup ...
  })()

  return () => {
    cryptoKeyRef.current = null
    // ... existing cleanup ...
  }
}, [...])
```

The key is cleared in the cleanup return so stale keys do not persist across room changes.

### Encrypt on send

`sendMessage` in `useImperativeHandle` changes from a direct emit to a fire-and-forget async. The interface type stays `(text: string) => void`:

```ts
sendMessage: (text) => {
  const key = cryptoKeyRef.current
  if (!socketRef.current || !key) return
  encryptMessage(text, key).then((ciphertext) => {
    socketRef.current?.emit('send-message', { text: ciphertext, timestamp: Date.now() })
  })
},
```

If the key is not yet derived (race condition on first send), the message is dropped rather than sent as plaintext.

### Decrypt on receive

Both `new-message` and `chat-history` listeners decrypt before calling `addMessage`. Failed decryption falls back to `"[encrypted message]"`:

**`new-message`:**
```ts
socket.on('new-message', async (m: { id: string; sender: string; senderName?: string; text: string; timestamp: number }) => {
  const key = cryptoKeyRef.current
  const text = key
    ? await decryptMessage(m.text, key).catch(() => '[encrypted message]')
    : m.text
  addMessage({ id: m.id, peerId: m.sender, peerName: m.senderName ?? m.sender, text, sentAt: m.timestamp })
})
```

**`chat-history`:**
```ts
socket.on('chat-history', async (messages: Array<{ id: string; sender: string; senderName?: string; text: string; timestamp: number }>) => {
  const key = cryptoKeyRef.current
  for (const m of messages) {
    const text = key
      ? await decryptMessage(m.text, key).catch(() => '[encrypted message]')
      : m.text
    addMessage({ id: m.id, peerId: m.sender, peerName: m.senderName ?? m.sender, text, sentAt: m.timestamp })
  }
})
```

### Server — one-line change

`signaling-server.js` defaults `MAX_MESSAGE_LENGTH` to `1000`. Base64-encoded ciphertext for a 1000-char plaintext message is approximately 1372 characters (12-byte IV + ~1000-byte ciphertext + 16-byte GCM tag, base64-encoded). Bump the default to `2000`:

```js
MAX_MESSAGE_LENGTH: parseInt(process.env.MAX_MESSAGE_LENGTH) || 2000,
```

The server's `sanitizeInput` passes Base64 ciphertext through unchanged (Base64 contains only `A-Z`, `a-z`, `0-9`, `+`, `/`, `=` — no XSS vectors).

---

## Section 3 — Environment, Testing, and Done-When

### `env.example`

Add:
```
# Chat encryption — all clients joining the same room must share this secret
# Generate with: openssl rand -hex 32
VITE_CHAT_ENCRYPTION_SECRET=change-me-before-production
```

### Tests

**`tests/unit/v2/lib/chatCrypto.test.ts`** (new file):
- Round-trip: `decryptMessage(await encryptMessage(text, key), key)` returns original text
- Wrong key: decrypting with a different derived key throws
- Empty string input: round-trips correctly
- `deriveKey` called with same inputs produces keys that can decrypt each other's output (deterministic derivation)

Web Crypto is available in jsdom (Jest's default test environment) — no mocking needed.

**`tests/unit/v2/call/PeerManager.test.tsx`** (modifications):
- `sendMessage` test: verify `socket.emit` is called with `'send-message'` and that the emitted `text` field is a non-empty string different from the original plaintext (i.e., it is ciphertext). Do not assert the exact ciphertext value.
- `new-message` listener test: seed `cryptoKeyRef` with a real derived key (via `beforeAll`), emit a properly encrypted message, assert the store receives the decrypted plaintext.
- `chat-history` listener test: same approach — send encrypted history, assert store receives plaintext.
- Fallback test: emit a `new-message` with corrupted ciphertext, assert the store receives `"[encrypted message]"`.

### Files Changed

| File | Change |
|------|--------|
| `src/v2/lib/chatCrypto.ts` | **Create** — `deriveKey`, `encryptMessage`, `decryptMessage` |
| `src/v2/call/PeerManager.tsx` | `cryptoKeyRef`, async IIFE in useEffect, encrypt send, decrypt receive |
| `signaling-server.js` | `MAX_MESSAGE_LENGTH` default: 1000 → 2000 |
| `env.example` | Add `VITE_CHAT_ENCRYPTION_SECRET` |
| `tests/unit/v2/lib/chatCrypto.test.ts` | **Create** — round-trip, wrong-key, edge case tests |
| `tests/unit/v2/call/PeerManager.test.tsx` | Update sendMessage assertion, add decrypt + fallback tests |

### Done When

- `encryptMessage` / `decryptMessage` round-trip passes in tests
- Chat messages emitted to the socket are ciphertext (server never sees plaintext)
- Recipients decrypt correctly; wrong-key or corrupted messages render as `"[encrypted message]"`
- `env.example` documents `VITE_CHAT_ENCRYPTION_SECRET`
- All existing tests pass
