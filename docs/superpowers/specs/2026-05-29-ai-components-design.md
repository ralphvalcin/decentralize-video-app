# AI Components Design Spec

**Date:** 2026-05-29
**Status:** Approved

---

## Goal

Port three AI components to `src/v2/components/ai/` as TypeScript files backed by real data: live WebRTC stats, a deterministic decision-tree, and a live `/metrics` fetch. No mocks or stubs remain in production code.

---

## Approach

Approach A — shared parent state. An `AISidePanel` parent component owns `worstQuality` state. `ConnectionQualityPredictions` polls `RTCPeerConnection.getStats()` every 5s and calls an `onQualityChange` callback. The panel conditionally mounts `TroubleshootingAssistant` when quality degrades. `AIInsightsDashboard` fetches `/metrics` independently.

---

## Section 1 — Component Inventory and Data Flow

### New files

| File | Responsibility |
|------|---------------|
| `src/v2/components/ai/ConnectionQualityPredictions.tsx` | Polls getStats every 5s, classifies per-peer quality, calls onQualityChange |
| `src/v2/components/ai/TroubleshootingAssistant.tsx` | Deterministic decision-tree; renders a single warning card |
| `src/v2/components/ai/AIInsightsDashboard.tsx` | Fetches /metrics every 30s, displays three stat tiles |
| `src/v2/call/AISidePanel.tsx` | Panel shell; owns worstQuality state; conditionally renders TroubleshootingAssistant |

### Modified files

| File | Change |
|------|--------|
| `src/v2/call/PeerManager.tsx` | Add `getPeerConnections(): Map<string, RTCPeerConnection>` to PeerManagerHandle |
| `src/v2/store/useUIStore.ts` | Add `isAIOpen: boolean` + `toggleAI()` action |
| `src/v2/call/ControlBar.tsx` | Add AI toggle button that dispatches `toggleAI()` |
| `src/v2/pages/RoomV2.tsx` | Conditionally render `<AISidePanel>` when `isAIOpen`; pass `peerManagerRef` |

### Data flow

1. RoomV2 passes `peerManagerRef` to `AISidePanel`.
2. `AISidePanel` passes `() => peerManagerRef.current?.getPeerConnections()` to `ConnectionQualityPredictions`.
3. `ConnectionQualityPredictions` polls every 5s, classifies quality per peer, calls `onQualityChange(worst)` upward.
4. `AISidePanel` stores `worst` in local state and conditionally mounts `TroubleshootingAssistant` when worst is `'Poor'` or any peer ICE state is `'failed'`.
5. `AIInsightsDashboard` fetches `/metrics` independently every 30s — no peer connection needed.

### Exposing RTCPeerConnection from PeerManager

`simple-peer` exposes the underlying `RTCPeerConnection` as `peer._pc`. `getPeerConnections()` iterates `peerConnsRef.current` and maps each entry to its `_pc`:

```ts
getPeerConnections: () => {
  const result = new Map<string, RTCPeerConnection>()
  peerConnsRef.current.forEach(({ peer }, id) => {
    const rtc = (peer as unknown as { _pc: RTCPeerConnection })._pc
    if (rtc) result.set(id, rtc)
  })
  return result
},
```

---

## Section 2 — Per-Component Logic

### `ConnectionQualityPredictions`

```ts
type Quality = 'Excellent' | 'Good' | 'Fair' | 'Poor'

interface PeerQualityRow {
  peerId: string
  quality: Quality
  packetLoss: number  // percent
  jitter: number      // ms
  rtt: number         // ms
}

interface QualitySnapshot {
  worst: Quality | null
  worstPacketLoss: number   // percent, worst across all peers
  worstJitter: number       // ms, worst across all peers
  connections: Map<string, RTCPeerConnection>
}

interface Props {
  getPeerConnections: () => Map<string, RTCPeerConnection> | undefined
  onQualityChange: (snapshot: QualitySnapshot) => void
}
```

Polls every 5s via `setInterval` (cleared on unmount). For each `RTCPeerConnection`, calls `getStats()` and reads `inbound-rtp` / `remote-inbound-rtp` report entries:

- `packetLoss = packetsLost / (packetsLost + packetsReceived) * 100`
- `jitter = entry.jitter * 1000` (ms)
- `rtt = entry.currentRoundTripTime * 1000` (ms)

**Quality thresholds (packet loss drives classification):**

| Packet loss | Quality |
|-------------|---------|
| < 1% | Excellent |
| 1–3% | Good |
| 3–8% | Fair |
| > 8% | Poor |

After each poll, calls `onQualityChange` with a `QualitySnapshot` containing the worst classification, the worst raw packet loss and jitter across all peers, and the current connections map. `AISidePanel` stores this snapshot in local state and passes the raw values down to `TroubleshootingAssistant`. Renders a compact list: one row per peer showing peer name and a coloured quality badge.

If no peer connections exist, calls `onQualityChange(null)` and renders nothing.

---

### `TroubleshootingAssistant`

```ts
interface Props {
  peerConnections: Map<string, RTCPeerConnection>
  packetLoss: number  // worst across peers
  jitter: number      // worst across peers
}
```

Evaluates rules in priority order on every render (props change triggers re-evaluation). Returns the first matching rule:

1. Any peer `iceConnectionState === 'failed'` → "Connection blocked — check your firewall or try a different network. If the problem persists, a TURN relay server may be required."
2. `packetLoss > 8` → "High packet loss detected — close background applications and pause any large downloads. Switching to a wired connection may help."
3. `jitter > 100` → "Unstable network — a wired (Ethernet) connection will significantly improve call stability."
4. `useCallStore().mediaError !== null` (getUserMedia failure) → "Camera or microphone access was denied — open your browser settings and allow this site to use your devices."

If no rule matches, renders nothing (component returns null).

Renders a single warning card with an icon, the matched message, and a dismiss button. The dismiss button sets a `dismissed` boolean in local state, hiding the card until the component unmounts and remounts (i.e., the panel is closed and reopened).

**Note:** `TroubleshootingAssistant` is only mounted by `AISidePanel` when `worstQuality === 'Poor'` or any peer ICE state is `'failed'`. The component's internal null-return is a secondary safety net.

---

### `AIInsightsDashboard`

No props. Uses `SIGNALING_URL` from the same build-time constant as PeerManager.

Fetches `${SIGNALING_URL}/metrics` on mount and every 30s via `setInterval`. The `/metrics` endpoint returns:

```json
{
  "connections": { "total": 0, "peak": 0, "connectionRate": 0, "byRoom": {} },
  "messages": { "totalSent": 0, "totalReceived": 0, "avgResponseTime": 0, "errorCount": 0 },
  "rooms": { "active": 0, "totalCreated": 0, "averageParticipants": 0 }
}
```

Displays three stat tiles:
- **Connections/min** — `connections.connectionRate`
- **Messages sent** — `messages.totalSent`
- **Avg response time** — `messages.avgResponseTime ms`

Shows a "Last updated: Xs ago" timestamp updated every second via a separate `setInterval`.

On fetch error: renders a muted "Metrics unavailable" state. Does not throw or crash.

---

### `AISidePanel`

```ts
interface Props {
  peerManagerRef: React.RefObject<PeerManagerHandle>
}
```

Holds in local state:
- `snapshot: QualitySnapshot | null`

On `onQualityChange(snapshot)`, replaces the stored snapshot. Derives `worstQuality`, `worstPacketLoss`, `worstJitter`, and `peerConnections` from it when rendering. Mounts `TroubleshootingAssistant` when `worstQuality === 'Poor'` or any peer in `peerConnections` has `iceConnectionState === 'failed'`.

Renders a fixed-width right-side panel (same width as ChatPanel) with three stacked sections: `ConnectionQualityPredictions`, then conditionally `TroubleshootingAssistant`, then `AIInsightsDashboard`.

---

## Section 3 — Testing

### `tests/unit/v2/components/ai/ConnectionQualityPredictions.test.tsx`

- Mock `RTCPeerConnection` with a `getStats()` returning fake `remote-inbound-rtp` entries; assert correct quality at each threshold boundary (0.5%, 2%, 5%, 10% packet loss → Excellent, Good, Fair, Poor)
- Two peers with different quality → `onQualityChange` called with the worse classification
- Component unmounts → `clearInterval` called

### `tests/unit/v2/components/ai/TroubleshootingAssistant.test.tsx`

- ICE state `failed` → TURN/firewall message shown (highest priority even when packet loss is also high)
- Packet loss > 8, ICE ok → background-apps message shown
- Jitter > 100, packet loss ok → wired-connection message shown
- No rules match → nothing rendered
- Dismiss button hides the card

### `tests/unit/v2/components/ai/AIInsightsDashboard.test.tsx`

- Mock `fetch`; resolve with sample `/metrics` JSON → three stat tiles display correct values
- `fetch` rejects → "Metrics unavailable" shown, no crash
- After 30s (fake timers) → `fetch` called again

### `tests/unit/v2/call/AISidePanel.test.tsx`

- `onQualityChange('Good')` → `TroubleshootingAssistant` not in DOM
- `onQualityChange('Poor')` → `TroubleshootingAssistant` mounts
- All three sub-components render

### `tests/unit/v2/call/PeerManager.test.tsx` addition

- After a peer is created, `getPeerConnections()` returns a Map containing an `RTCPeerConnection` for that peer

---

## Files Changed

| File | Change |
|------|--------|
| `src/v2/components/ai/ConnectionQualityPredictions.tsx` | **Create** |
| `src/v2/components/ai/TroubleshootingAssistant.tsx` | **Create** |
| `src/v2/components/ai/AIInsightsDashboard.tsx` | **Create** |
| `src/v2/call/AISidePanel.tsx` | **Create** |
| `src/v2/call/PeerManager.tsx` | Add `getPeerConnections()` to handle |
| `src/v2/store/useUIStore.ts` | Add `isAIOpen` + `toggleAI()` |
| `src/v2/call/ControlBar.tsx` | Add AI toggle button |
| `src/v2/pages/RoomV2.tsx` | Conditionally render AISidePanel |
| `tests/unit/v2/components/ai/ConnectionQualityPredictions.test.tsx` | **Create** |
| `tests/unit/v2/components/ai/TroubleshootingAssistant.test.tsx` | **Create** |
| `tests/unit/v2/components/ai/AIInsightsDashboard.test.tsx` | **Create** |
| `tests/unit/v2/call/AISidePanel.test.tsx` | **Create** |
| `tests/unit/v2/call/PeerManager.test.tsx` | Add getPeerConnections test |

---

## Done When

- All three components show live data — no hardcoded values or mocks in production code
- `TroubleshootingAssistant` is hidden when the call is healthy; appears when a rule fires
- `AIInsightsDashboard` pulls from `/metrics` and updates every 30s
- AI panel opens/closes via ControlBar toggle
- All new tests pass; existing 273 tests remain green
