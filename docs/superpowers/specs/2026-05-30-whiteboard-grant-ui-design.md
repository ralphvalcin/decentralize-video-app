# Whiteboard Permission Grant UI Design

**Date:** 2026-05-30
**Status:** Approved — ready for implementation planning

---

## Summary

Add a host-only "Participants ▾" dropdown in the whiteboard header that lets the host grant or revoke per-participant drawing rights. The dropdown closes after each action. Disconnecting peers are auto-revoked.

---

## Decisions

| Question | Decision |
|---|---|
| UI placement | Header dropdown — "Participants ▾" button opens a list overlay |
| Close behavior | Closes after each Grant/Revoke action (and on click-outside) |
| Visibility | Host only — guests never see the dropdown |
| Disconnect cleanup | Auto-revoke drawing rights when a granted peer leaves the room |

---

## Architecture

### New File

| File | Role |
|---|---|
| `src/v2/call/WhiteboardParticipantDropdown.tsx` | Dropdown component — participant list, Grant/Revoke buttons, click-outside close |

### Modified Files

| File | Change |
|---|---|
| `src/v2/call/WhiteboardModal.tsx` | Re-add `onGrant`/`onRevoke` props; render `<WhiteboardParticipantDropdown>` in header when `isHost` |
| `src/v2/pages/RoomV2.tsx` | Pass `onGrant`/`onRevoke` callbacks to `WhiteboardModal` |
| `src/v2/call/PeerManager.tsx` | Add `useWhiteboardStore.getState().revokeDrawing(socketId)` to `user-left` handler |

---

## Component: `WhiteboardParticipantDropdown`

```ts
interface WhiteboardParticipantDropdownProps {
  onGrant: (peerId: string) => void
  onRevoke: (peerId: string) => void
}
```

**Store reads (internal — no prop drilling):**
- `usePeerStore` → `peers: Map<string, PeerRecord>` — connected participant names and IDs
- `useWhiteboardStore` → `grantedPeerIds: Set<string>` — who currently has drawing rights

**Behavior:**
- `isOpen` local state controls visibility
- "Participants ▾" button in header toggles `isOpen`
- Each peer row shows: avatar initial, name, ✏️ badge if granted, Grant or Revoke button
- Clicking Grant → calls `onGrant(peerId)` → `isOpen = false`
- Clicking Revoke → calls `onRevoke(peerId)` → `isOpen = false`
- Click-outside: `useEffect` adds `mousedown` listener to `document`; closes when click lands outside component ref
- Host's own socket ID excluded from the list (no need to grant yourself)

---

## `WhiteboardModal` Changes

**Props re-added:**
```ts
interface WhiteboardModalProps {
  onStroke: (stroke: Stroke) => void
  onClear: () => void
  onClose: () => void
  canDraw: boolean
  onGrant: (peerId: string) => void   // re-added — now has UI to invoke it
  onRevoke: (peerId: string) => void  // re-added — now has UI to invoke it
}
```

**Header change:**
```tsx
{isHost && (
  <WhiteboardParticipantDropdown onGrant={onGrant} onRevoke={onRevoke} />
)}
```

`isHost` read from `useCallStore` inside `WhiteboardModal` (already imported).

---

## `RoomV2` Changes

Add `onGrant` and `onRevoke` to the `<WhiteboardModal>` render:
```tsx
<WhiteboardModal
  canDraw={canDraw}
  onClose={toggleWhiteboard}
  onStroke={(stroke) => {
    useWhiteboardStore.getState().addStroke(stroke)
    peerManagerRef.current?.broadcastWhiteboardStroke(stroke)
  }}
  onClear={() => {
    useWhiteboardStore.getState().clearStrokes()
    peerManagerRef.current?.broadcastWhiteboardClear()
  }}
  onGrant={(peerId) => {
    useWhiteboardStore.getState().grantDrawing(peerId)
    peerManagerRef.current?.broadcastWhiteboardGrant(peerId)
  }}
  onRevoke={(peerId) => {
    useWhiteboardStore.getState().revokeDrawing(peerId)
    peerManagerRef.current?.broadcastWhiteboardRevoke(peerId)
  }}
/>
```

---

## `PeerManager` Disconnect Cleanup

In the existing `user-left` socket handler (one line added):
```ts
socket.on('user-left', (socketId: string) => {
  removePeer(socketId)
  destroyPeerConn(socketId)
  useWhiteboardStore.getState().revokeDrawing(socketId)  // new
})
```

Keeps `grantedPeerIds` clean when a granted peer disconnects mid-session.

---

## Data Flow

1. Host clicks "Participants ▾" → `isOpen = true` → dropdown renders over canvas
2. Host clicks Grant next to Alice → `onGrant('alice-socket-id')` → `isOpen = false`
3. `onGrant` in RoomV2 → `grantDrawing('alice-socket-id')` + `broadcastWhiteboardGrant('alice-socket-id')`
4. Alice's `PeerManager` receives `whiteboard-grant` → `useWhiteboardStore.getState().grantDrawing(aliceSocketId)`
5. Alice's `canDraw = isHost || grantedPeerIds.has(socketId)` → becomes `true` → toolbar appears
6. If Alice disconnects → `user-left` → `revokeDrawing('alice-socket-id')` → grant cleaned up

---

## Testing

| Test file | Coverage |
|---|---|
| `tests/unit/v2/call/WhiteboardParticipantDropdown.test.tsx` | Renders peer list; Grant calls `onGrant(peerId)` + closes; Revoke calls `onRevoke(peerId)` + closes; granted peer shows Revoke not Grant; click-outside closes |
| `tests/unit/v2/call/WhiteboardModal.test.tsx` *(extend)* | Dropdown renders when `isHost=true`; hidden when `isHost=false` |
| `tests/unit/v2/call/PeerManager.test.tsx` *(extend)* | `user-left` calls `revokeDrawing` with departing peer's socket ID |

All TDD — failing tests written first.

---

## Out of Scope

- Grant all / Revoke all shortcut
- Dropdown animation
- Participant count badge on the button
