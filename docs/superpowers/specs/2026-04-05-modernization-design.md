# Velo Modernization Design Spec
**Date:** 2026-04-05
**Status:** Approved — ready for implementation planning

---

## Overview

Full modernization of the decentralized video app — visual redesign and architecture cleanup — using a parallel rebuild strategy. All new work lives in `src/v2/`. Existing code untouched until cutover.

---

## Approach: Parallel Rebuild

- New code in `src/v2/` — TypeScript and Zustand from day one
- Existing `src/components/` untouched until each screen is ready to cut over
- `Room.jsx` replaced by a thin `RoomV2.tsx` orchestrator (~80 lines) with logic extracted into focused sub-components
- Cut over page-by-page: Home first, then Room

---

## Design System

**Constraint: max 4 per category. No exceptions without removing one first.**

### Color Tokens
```css
/* Surface */
--surface-base:    #000000;
--surface-raised:  #0a0a0a;
--surface-overlay: #111111;
--surface-hover:   #1a1a1a;

/* Border */
--border-subtle:  #1e1e1e;
--border-default: #2e2e2e;
--border-strong:  #ffffff;

/* Text */
--text-primary:   #ffffff;
--text-secondary: #888888;
--text-muted:     #444444;

/* Accent */
--accent-live:   #22c55e;
--accent-danger: #ef4444;
--accent-warn:   #f59e0b;
--accent-info:   #3b82f6;
```

### Typography
- Font: Inter
- `--text-xl`: 20px / 700 / tracking-tight — logo, hero headings
- `--text-lg`: 15px / 600 — section headings, room names
- `--text-sm`: 12px / 400 / text-secondary — metadata, timestamps
- `--text-label`: 10px / 500 / uppercase / tracking-widest — field labels, section headers

### Spacing
Base unit: 4px. Scale: 4, 8, 12, 16, 24, 32, 48px.

### Border Radius
- `r-sm`: 4px — badges, tags
- `r-md`: 8px — inputs, cards, video tiles
- `r-lg`: 12px — panels, modals
- `r-full`: 9999px — pill buttons, control bar buttons

---

## State Architecture

### Ownership Rule
> **Each peer owns their own state. Others hold a received cache. `PeerManager.tsx` is the only bridge between Socket.io events and the store.**

Local state changes → emit Socket.io event → all peers update their `usePeerStore` for that peer.
Peer disconnects → `peers.delete(id)` → everything for that peer is gone. One operation, no cross-store cleanup.

### Four Stores

#### `usePeerStore`
All per-peer data. The only store that reads/writes `PeerRecord`.
```ts
peers: Map<string, PeerRecord>
setPeer(id: string, partial: Partial<PeerRecord>): void
removePeer(id: string): void
```

#### `useCallStore`
Local peer only — nothing about remote peers.
```ts
localStream: MediaStream | null
isMuted: boolean
isCamOff: boolean
roomId: string
screenSharePeerId: string | null
```

#### `useUIStore`
Local UI state only — no peer data ever touches this store.
```ts
isChatOpen: boolean
isParticipantsOpen: boolean
activeModal: string | null
toasts: Toast[]
layout: 'spotlight' | 'grid'
```

#### `useSessionStore`
Room-level interactions — not per-peer.
```ts
messages: ChatMessage[]
pinnedMessage: ChatMessage | null
activePoll: Poll | null
pollResponses: Record<string, string>  // peerId → choiceId. Plain object — Map is not serializable in Zustand.
recordingState: 'idle' | 'recording' | 'paused'
recordingConsentPeers: string[]
```

### Supporting Types
```ts
interface Reaction {
  emoji: string        // e.g. "👍", "❤️", "😂"
  sentAt: number       // Unix ms — used to auto-clear after 3000ms
}
```

### PeerRecord — Complete Shape
```ts
interface PeerRecord {
  // identity
  id: string
  name: string
  role: 'host' | 'guest'

  // media
  stream: MediaStream | null
  isMuted: boolean
  isCamOff: boolean
  videoEnabled: boolean        // distinct from isCamOff — stream exists but track ended
  isScreenSharing: boolean

  // connection
  connectionState: RTCPeerConnectionState
  networkQuality: 'good' | 'fair' | 'poor'

  // interactions
  isSpeaking: boolean          // local peer: Web Audio API detection then broadcast. remote: received cache only.
  isPinned: boolean            // LOCAL ONLY — never broadcast. local user override — overrides isSpeaking spotlight.
  hasRaisedHand: boolean
  handRaisedAt: number | null  // enables ordered speaker queue
  reaction: Reaction | null    // auto-cleared after 3000ms via setTimeout in PeerManager
  isAway: boolean              // Page Visibility API
  isTyping: boolean            // drives typing indicator in chat panel
}
```

---

## HomeV2 Screen

**Layout:** Split — left form, right panel. Full viewport height.

### Left Half — Join Form
- Logo: green dot + "Velo" wordmark (--text-xl, tracking-tight)
- Tagline: "Private video. No sign-up." + subtitle "End-to-end encrypted · Peer-to-peer · Yours."
- Field: Your name (--text-label, --surface-raised, --border-default)
- Field: Room ID (optional — leave blank to create new)
- Buttons: "Create Room" (white/black, full width) + "Join →" (--surface-raised, --text-secondary)

### Right Half — Pre-flight + Quick Rejoin
**Top:** Live camera preview with avatar fallback. Mic/cam toggle buttons docked at bottom of preview. Device status indicators (green dot + "Mic ready", "Cam ready").

**Bottom:** Compact recent/active rooms strip.
- Active room: green dot, white text, participant count, "Rejoin →" in --accent-live
- Past rooms: dimmed, grey text, timestamp, "Rejoin →" in --text-muted
- Footer: "stored locally · never uploaded" — reinforces decentralized trust

---

## RoomV2 Screen

**Layout:** Spotlight + Sidebar. Main area left, persistent chat panel right.

### Main Area
**Top bar (minimal):**
- Left: green dot + room name + participant count + duration
- Right: layout toggle (spotlight/grid), more menu

**Spotlight view (`SpotlightView.tsx`):**
- Active speaker tile fills available space
- Auto-switches to `isSpeaking: true` peer unless `isPinned: true` overrides
- Screen share peer takes spotlight automatically when `screenSharePeerId` is set
- Peer name + network quality badge overlaid bottom-left

**Thumbnail strip (`ThumbnailStrip.tsx`):**
- Horizontal scrollable strip below spotlight
- Each tile: video or avatar, name, muted indicator, reaction overlay, raised hand badge
- `isAway` peers show a dimmed "Away" overlay
- `isTyping` peers show a subtle animated dot indicator

**Control bar (`ControlBar.tsx`):**
- Docked to bottom of main area
- Pills: Mute, Camera, Screen share, Raise hand, Reactions, End call
- End call: --accent-danger background
- Raised hand shows ordered queue count badge when others have hands up
- Auto-hides after 3s idle, reappears on mouse move

### Chat Panel (`ChatPanel.tsx`)
- Persistent right sidebar, 280px wide
- Pinned message banner at top when `pinnedMessage` is set
- Message list with sender name, timestamp, reaction support
- `isTyping` peers shown as animated dots above input
- Input with emoji picker trigger

### Participants Panel
- Triggered by `isParticipantsOpen` in `useUIStore` — slides in over the chat panel (replaces it, not alongside it)
- Lists all peers with role badge (host/guest), network quality indicator, hand-raise position
- Host sees mute controls per peer here

---

## Component File Structure

```
src/
  v2/
    design-system/
      tokens.ts          ← exports all CSS custom property values as JS constants
      index.css          ← @layer base { :root { --surface-base: ... } }
    store/
      usePeerStore.ts
      useCallStore.ts
      useUIStore.ts
      useSessionStore.ts
    pages/
      HomeV2.tsx
      RoomV2.tsx         ← thin orchestrator, ~80 lines
    call/
      PeerManager.tsx    ← WebRTC + Socket.io → store. No UI.
      MediaController.tsx
      SpotlightView.tsx
      ThumbnailStrip.tsx
      ControlBar.tsx
      ChatPanel.tsx
    ui/
      Button.tsx
      Avatar.tsx
      VideoTile.tsx
      Badge.tsx
  components/            ← existing, untouched until cutover
```

---

## Animation Strategy

Library: **Framer Motion**

- Panel open/close: slide + fade (200ms ease-out)
- Spotlight switch: crossfade between tiles (300ms)
- Reactions: float up and fade out (1.2s)
- Raised hand badge: spring pop-in
- Control bar hide/show: fade (150ms)
- Thumbnail strip scroll: smooth native scroll with momentum

Rule: **no animation longer than 300ms on interactions.** Ambient animations (reactions floating) can be longer.

---

## Cutover Plan

1. Build `HomeV2` → route `/v2` → validate → swap `/` to `HomeV2`
2. Build `RoomV2` → route `/room-v2/:id` → validate → swap `/room/:id` to `RoomV2`
3. Delete old components after 1 stable week in production

---

## Deferred (Not in v1)

- `muteRequests` — needs host permission model
- Room password protection
- Recording feature (state is tracked, UI deferred)
- Agenda panel
- Breakout rooms
