# Velo Migration Completion Design Spec

**Date:** 2026-05-27
**Status:** Approved

---

## Goal

Complete the v1→v2 migration and bring all half-built features to a shippable state. Work proceeds in two phases executed sequentially: Phase A cleans the architecture, Phase B completes the features.

---

## Approach

Spec-driven sequential execution. Each step gets its own implementation plan before any code is written. Existing approved specs are used as-is where they exist.

---

## Phase A — Architecture Clean

### Step 1: Route Cutover

**Spec:** `docs/superpowers/specs/2026-04-07-route-cutover-state-cleanup.md` (already approved)

**What changes:**

- `App.jsx` routing:
  - Remove `<Route path="/room/:roomId" element={<Room />} />` (old Room)
  - Rename `<Route path="/v2/room/:roomId" ...>` → `<Route path="/room/:roomId" ...>` → `RoomV2`
  - Remove `<Route path="/v2-legacy" element={<Home />} />`
  - Remove lazy imports for `Room` and `Home` from `App.jsx`
  - Delete `src/App.global-state.tsx` (orphaned, never imported)

- `useCallStore` (`src/v2/store/useCallStore.ts`):
  - Remove `roomId` field — URL params are the source of truth
  - Add `reset()` — clears `isMuted → false`, `isCamOff → false`

- `JoinForm` (`src/v2/pages/home/JoinForm.tsx`):
  - Navigate to `/room/:roomId` (not `/v2/room/...`)
  - Do not write `roomId` to store on submit

- `RoomV2` (`src/v2/pages/RoomV2.tsx`):
  - Read `roomId` from `useParams()` only
  - Redirect to `/?redirect=/room/:id` when `userName` is empty
  - Pass `roomId` as prop to `PeerManager`
  - Call `reset()` on end call before navigating to `/`

- Tests (4 files updated per the cutover spec):
  - `tests/unit/v2/call/PeerManager.test.tsx`
  - `tests/unit/v2/pages/JoinForm.test.tsx`
  - `tests/unit/v2/pages/RoomV2.test.tsx`
  - `tests/unit/v2/call/ControlBar.test.tsx`

**Done when:** All tests pass, `/room/:roomId` routes to RoomV2, old Room.jsx no longer referenced.

---

### Step 2: V1 Component Deletion

**Spec needed:** Yes (new, small)

**What changes:**

- Audit: grep for imports from `src/components/`, `src/hooks/`, `src/services/` across all of `src/v2/` and `App.jsx`. If any remain, port or inline them before proceeding — do not delete with live imports.
- Delete `src/components/` (v1 components fully replaced by `src/v2/call/`, `src/v2/ui/`, `src/v2/pages/`)
- Delete `src/hooks/` (replaced by v2 stores + service layer)
- Delete `src/services/` (replaced by `src/v2/call/` layer)
- Verify: `npm run build` passes with no dead import errors
- Single cleanup commit

**Done when:** Build passes, no references to deleted directories remain.

---

## Phase B — Feature Completion

### Step 3: Polls & Q&A Voting

**Spec needed:** Yes

**What changes:**

- `signaling-server.js`:
  - Wire poll voting TODO (~line 1304): tally votes per option, broadcast updated poll state to room
  - Wire Q&A answer submission TODO (~line 1387): append answer to question record, broadcast to room
  - Track vote-per-user to prevent double-voting

- `src/v2/call/PollBanner.tsx`:
  - Connect to real `poll:vote` and `poll:update` socket events
  - Show live vote counts

- `src/v2/call/` — new `QAPanel.tsx`:
  - Port from `src/components/QA.jsx` to TypeScript
  - Connect to real `qa:answer` and `qa:update` socket events
  - Support upvoting questions, submitting answers

- Tests:
  - Unit: server vote tallying logic, double-vote prevention
  - Integration: socket broadcast on vote, socket broadcast on answer

**Done when:** Polls can receive votes and show live counts; Q&A can receive answers; no TODOs remain in signaling server for these features.

---

### Step 4: E2E Encryption for Chat

**Spec needed:** Yes

**Scope:** Chat messages only. Media streams are already encrypted via DTLS-SRTP (WebRTC default).

**What changes:**

- Key derivation: room key derived from `roomId` + a shared secret (env var `VITE_CHAT_ENCRYPTION_SECRET`) using PBKDF2. Server never sees the plaintext key.
- On room join: derive room key client-side from URL param + secret
- `ChatPanel.tsx` (`src/v2/call/ChatPanel.tsx`):
  - Encrypt message with AES-256-GCM before emitting to socket
  - Decrypt incoming messages with room key before rendering
- `crypto-js` is already installed — use it directly, no new dependency
- Add `VITE_CHAT_ENCRYPTION_SECRET` to `env.example` with a placeholder value and a comment explaining its purpose
- Messages that fail decryption render as `[encrypted message]` instead of crashing
- Tests: unit for encrypt/decrypt round-trip; integration confirms server receives ciphertext, not plaintext

**Done when:** Chat messages are encrypted in transit; server logs show ciphertext; decryption works for all room participants.

---

### Step 5: AI Components Backed by Real Logic

**Spec needed:** Yes

**No external AI service required.** All three components use data already available in-process.

All three components land in `src/v2/components/ai/` as TypeScript files.

**`ConnectionQualityPredictions`** (`src/components/ai/ConnectionQualityPredictions.jsx` → `src/v2/components/ai/ConnectionQualityPredictions.tsx`):
- Replace stub with real `RTCPeerConnection.getStats()` polling (every 5s)
- Track: packet loss %, jitter (ms), round-trip time (ms), available outbound bitrate
- Classify connection as: Excellent / Good / Fair / Poor based on thresholds
- Thresholds: packet loss <1% → Excellent, 1–3% → Good, 3–8% → Fair, >8% → Poor

**`TroubleshootingAssistant`** (`src/components/ai/TroubleshootingAssistant.jsx` → `src/v2/components/ai/TroubleshootingAssistant.tsx`):
- Replace stub with a decision-tree diagnostic:
  - ICE connection state `failed` → suggest TURN server / firewall check
  - Packet loss >8% → suggest closing background apps / switching network
  - Jitter >100ms → suggest wired connection
  - `getUserMedia` error → guide through browser permissions
- No ML needed — deterministic rules based on observable WebRTC state

**`AIInsightsDashboard`** (`src/components/ai/AIInsightsDashboard.jsx` → `src/v2/components/ai/AIInsightsDashboard.tsx`):
- Wire to real signaling server `/metrics` endpoint (already emits every 30s)
- Display: connections/min, message throughput, avg response time from circular buffer
- Replace static mock data with live fetch

**Done when:** All three components show real data, no mocks or stubs remain, components ported to TypeScript in `src/v2/`.

---

## Execution Order

| Step | Phase | Spec | Implementation Plan |
|------|-------|------|---------------------|
| 1. Route Cutover | A | Approved (exists) | Needs writing |
| 2. V1 Deletion | A | Needs writing | After step 1 lands |
| 3. Polls & Q&A | B | Needs writing | After step 2 lands |
| 4. E2E Encryption | B | Needs writing | After step 3 lands |
| 5. AI Components | B | Needs writing | After step 4 lands |

Each step: write implementation plan → execute → tests pass → commit → next step.

---

## What This Does Not Cover

- Encrypting media streams (already handled by WebRTC DTLS-SRTP)
- New features (AI transcription, noise suppression, recording, whiteboard) — deferred until Phase B is complete
- Mobile app
- Infrastructure changes (Kubernetes, multi-region)
