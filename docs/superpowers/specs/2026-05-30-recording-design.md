# Recording — Design Spec

**Date:** 2026-05-30
**Status:** Approved

## Goal

Add client-side meeting recording for the host. A single WebM file is downloaded to the host's device at the end of the session, containing all participant video and audio composited together. No server storage. All participants see a visible recording indicator while recording is active.

## Decisions

| Question | Decision |
|---|---|
| What is captured | Full room view — all participants composited into one file |
| Who can record | Host only (first user into an empty room) |
| Notification | All participants see a toast + persistent indicator when recording starts/stops |
| Output destination | Local download to host's device (no cloud) |
| Transcript export | Out of scope — separate feature |
| Recording end trigger | Manual stop by host OR auto-stop when host leaves the room |

## Architecture

```
Host clicks Record
  → useSessionStore.setRecordingState('recording')
  → socket.emit('recording-started', { roomId })
  → RecordingManager.start():
      - Creates in-memory <video> elements per stream (local + all remotes)
      - Draws them to a hidden <canvas> at 15fps via rAF loop
      - Mixes all audio streams into one AudioDestinationNode
      - Combines canvas.captureStream(15) + audio track → MediaRecorder
      - MediaRecorder.start(1000) — collects chunks every second

All participants receive socket 'recording-started':
  → Toast: "Recording has started"
  → RecordingIndicator (red dot + timer) appears for everyone

Host clicks Stop OR leaves the room:
  → RecordingManager.stop() → MediaRecorder.stop()
  → Blob assembled → auto-download as recording-{roomId}-{timestamp}.webm
  → socket.emit('recording-stopped')
  → All participants: toast "Recording ended"
  → RecordingIndicator disappears
```

## Components

### New files

**`src/v2/recording/RecordingManager.ts`**
Service class. Owns the canvas draw loop, Web Audio graph, and MediaRecorder lifecycle. Accepts `{ localStream, remoteStreams }` on `start()`, tears everything down on `stop()`, and triggers the file download. No React, no store — pure logic.

**`src/v2/call/RecordingController.tsx`**
Thin React component mounted once in `RoomV2` (same pattern as `TranscriptionController`). Reads `recordingState` from `useSessionStore`, reads streams from `useCallStore` + `usePeerStore`, instantiates `RecordingManager`, and handles socket events. Receives `peerManagerRef` as a prop and calls `broadcastRecordingStarted()` / `broadcastRecordingStopped()` on it to emit socket events. Listens for host leaving (`onEndCall`) to auto-stop.

**`src/v2/components/RecordingIndicator.tsx`**
Red pulsing dot + elapsed timer (e.g. `● REC 00:42`). Visible to all participants when `recordingState === 'recording'`. Positioned top-right of the video grid in `RoomV2`.

### Modified files

| File | Change |
|---|---|
| `src/v2/store/useCallStore.ts` | Add `isHost: boolean` + `setIsHost()` |
| `src/v2/store/useSessionStore.ts` | No changes — `recordingState` + `setRecordingState` already exist |
| `src/v2/call/ControlBar.tsx` | Add Record/Stop button, visible only when `isHost`, red when recording |
| `src/v2/pages/RoomV2.tsx` | Mount `<RecordingController />` and `<RecordingIndicator />` |
| `src/v2/call/PeerManager.tsx` | Handle `you-are-host` event → `setIsHost(true)`; add `broadcastRecordingStarted()` + `broadcastRecordingStopped()` to `PeerManagerHandle` |
| `signaling-server.js` | Emit `you-are-host` to first user in empty room; broadcast `recording-started` / `recording-stopped` to room |

## Data Flow

### Canvas compositing

`RecordingManager` creates one in-memory `HTMLVideoElement` per stream (never added to the DOM), sets `srcObject`, and calls `play()`. On each rAF tick (throttled to 15fps) it draws all video elements onto a hidden `<canvas>` in a simple grid — same √N column math as `SpotlightView`.

```
localStream + remoteStreams[]
  → one HTMLVideoElement per stream (srcObject set, play())
  → rAF loop: ctx.drawImage(videoEl, x, y, w, h) for each
  → canvas.captureStream(15) → video track
```

### Audio mixing

```
each stream → AudioContext.createMediaStreamSource(stream)
           → connect to AudioContext.createMediaStreamDestination()
dest.stream.getAudioTracks()[0] → audio track
```

### MediaRecorder assembly

```
canvasStream.addTrack(audioTrack)
new MediaRecorder(canvasStream, { mimeType: 'video/webm;codecs=vp8,opus' })
recorder.ondataavailable → push chunk to chunks[]
recorder.onstop → new Blob(chunks) → URL.createObjectURL → <a>.click() → download
```

**File name:** `recording-{roomId}-{Date.now()}.webm`

### Socket events

| Event | Direction | Payload | Client action |
|---|---|---|---|
| `you-are-host` | server → client | — | `setIsHost(true)` |
| `recording-started` | client → server → room | `{ roomId }` | toast + show `RecordingIndicator` |
| `recording-stopped` | client → server → room | `{ roomId }` | toast + hide `RecordingIndicator` |

## Error Handling

**MediaRecorder not supported:**
Check `MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')` before starting. Fall back to `video/webm` without codec hint. If `MediaRecorder` is absent entirely, show toast "Recording isn't supported in this browser" and abort.

**Host leaves mid-recording (auto-stop):**
`RecordingController` calls `RecordingManager.stop()` before `resetCall()` so the `onstop` handler fires and the download triggers before the page unloads. A `beforeunload` guard warns if recording is still active.

**Remote peer drops mid-recording:**
Their in-memory `HTMLVideoElement` stops producing frames — canvas draws a black tile for that slot. Their audio source is disconnected from the Web Audio graph when the peer removal event fires from `usePeerStore`. No crash.

## Testing

**Unit (`RecordingManager`):**
- `start()` creates a MediaRecorder and begins collecting chunks
- `stop()` assembles a Blob and triggers download
- Canvas grid math produces correct `(x, y, w, h)` for 1, 2, 4, and 6 participants
- Audio disconnect on peer removal doesn't throw

**Integration (`RecordingController`):**
- Record button only renders when `isHost === true`
- Clicking Record emits `recording-started` and sets `recordingState = 'recording'`
- Clicking Stop (or `onEndCall`) triggers `RecordingManager.stop()` and emits `recording-stopped`
- Non-host receives `recording-started` → toast appears + `RecordingIndicator` renders

`MediaRecorder` and `canvas.captureStream` are unavailable in jsdom — those tests run with mocks. No E2E tests at this stage; download trigger is hard to intercept in Playwright for v1.
