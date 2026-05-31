# AI Transcription — Design Spec

**Date:** 2026-05-29
**Status:** Approved

## Goal

Add real-time speech-to-text captions for all participants (local + remote) using Whisper WASM via `@huggingface/transformers`. Audio never leaves the browser — no API key, no server, works offline after first model download.

## Approach

A `TranscriptionManager` service class creates one `ScriptProcessorNode` per participant stream, buffers 5-second audio windows, downsamples 48kHz → 16kHz, and enqueues jobs to a `TranscriptionWorker` (Web Worker) running `Xenova/whisper-tiny`. Results flow into `useTranscriptionStore` and render in a `CaptionOverlay` floating above the ControlBar.

Captions are **off by default** — user opts in via a CC button in the ControlBar to avoid an unexpected 40MB model download on every call.

## Architecture

```
CC button clicked
  → useUIStore.toggleCaptions() → isCaptionsOpen=true
  → useTranscriptionStore.enable() → isEnabled=true
  → TranscriptionController creates TranscriptionManager
  → Manager spawns TranscriptionWorker
  → Worker loads Xenova/whisper-tiny (isLoading=true)
  → Worker ready → isLoading=false
  → Manager attaches ScriptProcessorNode to:
      • useCallStore.localStream (processed, 48kHz)
      • each remote stream from usePeerStore
```

**Per-speaker audio cycle:**
```
ScriptProcessorNode fires every 4096 samples (~85ms at 48kHz)
  → accumulate into per-speaker Float32Array buffer
  → at 5-second threshold → downsample 48kHz→16kHz → enqueue to worker
Worker processes one job at a time → posts { speakerId, userName, text, timestamp }
  → useTranscriptionStore.addSegment()
  → CaptionOverlay re-renders
```

**Toggle bypass (mid-call):**
When CC is toggled off, `TranscriptionManager.dispose()` disconnects all nodes and terminates the worker. Toggling back on creates a fresh manager and re-attaches streams. `useTranscriptionStore.clear()` resets the segment history.

## Files

### New

**`src/v2/audio/TranscriptionWorker.ts`**
Web Worker. Responsibilities:
- Initialize `Xenova/whisper-tiny` pipeline on first `init` message; post `{ type: 'ready' }` when done
- Process one `{ type: 'transcribe', speakerId, userName, audio: Float32Array }` job at a time
- Post back `{ type: 'result', speakerId, userName, text, timestamp }` for each completed job
- Post `{ type: 'error', speakerId, error }` on inference failure (worker stays alive)

**`src/v2/audio/TranscriptionManager.ts`**
Service class. Responsibilities:
- `addStream(speakerId: string, userName: string, stream: MediaStream): void` — creates an `AudioContext` + `ScriptProcessorNode(4096, 1, 1)` for the stream; accumulates audio into a per-speaker buffer; when buffer reaches 5 seconds (240,000 samples at 48kHz), downsamples to 16kHz (16,000 samples) and enqueues to worker
- `removeStream(speakerId: string): void` — disconnects and disposes that speaker's nodes
- `dispose(): void` — removes all streams, terminates worker
- Downsampling: average every 3 samples (48000/16000 = 3:1 ratio) into a new Float32Array

**`src/v2/store/useTranscriptionStore.ts`**
Zustand store. Shape:
```typescript
interface TranscriptSegment {
  speakerId: string
  userName: string
  text: string
  timestamp: number
}
interface TranscriptionStore {
  isEnabled: boolean
  isLoading: boolean
  segments: TranscriptSegment[]
  enable: () => void
  disable: () => void
  setLoading: (value: boolean) => void
  addSegment: (segment: TranscriptSegment) => void
  clear: () => void
}
```
Default: `isEnabled: false`, `isLoading: false`, `segments: []`.

**`src/v2/call/TranscriptionController.tsx`**
Renderless component, mounted in `RoomV2` alongside `MediaController`. Responsibilities:
- Observes `isEnabled` from `useTranscriptionStore`
- When `isEnabled` becomes true: creates `TranscriptionManager`, passes worker result callback to `useTranscriptionStore.addSegment`, attaches local stream + all current remote streams
- Observes `usePeerStore` for peer joins/leaves: calls `addStream` / `removeStream` accordingly
- When `isEnabled` becomes false or component unmounts: calls `dispose()`

**`src/v2/components/ai/CaptionOverlay.tsx`**
UI component. Responsibilities:
- Reads `isCaptionsOpen` from `useUIStore`; returns null when false
- Reads `isLoading` and `segments` from `useTranscriptionStore`
- When `isLoading`: shows a centered spinner with "Loading captions model…"
- When ready: shows the last 3 `TranscriptSegment` entries, each formatted as `[userName]: text`
- Positioned absolutely above the ControlBar, full-width, semi-transparent background

### Modified

**`src/v2/store/useUIStore.ts`**
Add:
- `isCaptionsOpen: boolean` — default `false`
- `toggleCaptions(): void` — flips state; also calls `useTranscriptionStore.getState().enable()` / `.disable()`

**`src/v2/call/ControlBar.tsx`**
Add CC button between the noise button and Leave:
- `data-testid="btn-cc"`
- Disabled + spinner when `isLoading`
- `primary` variant when `isCaptionsOpen`, `ghost` when not
- Label: `CC` (off) / `CC ✓` (on) / `CC …` (loading)

**`src/v2/pages/RoomV2.tsx`**
- Mount `<TranscriptionController />` as a sibling of `<MediaController />`
- Render `<CaptionOverlay />` inside the video column div, positioned above the ControlBar

## Error Handling

| Failure | Behavior |
|---|---|
| Model download fails | `isLoading=false`; toast "Captions unavailable — model failed to load"; CC button re-enabled to retry |
| Worker inference error | Skip that segment; log warning; worker stays alive for next job |
| No audio track on stream | Skip that stream silently (guard in `addStream`) |
| Peer leaves before buffer flushes | `removeStream` drops pending buffer |
| AudioContext unavailable (old browser) | `addStream` returns early; no crash |

## Default State

Captions are **off by default** (`isEnabled: false`). On first enable, the 40MB model downloads once and is cached in browser IndexedDB by `@huggingface/transformers`. Subsequent enables are instant.

## Testing

**Unit — `TranscriptionManager`**
- Mock `AudioContext`, `ScriptProcessorNode`, worker
- `addStream` creates one ScriptProcessorNode per stream
- Buffer accumulates across multiple `onaudioprocess` callbacks until 5s threshold
- Downsampling produces correct output length (input÷3)
- `removeStream` disconnects correct nodes
- `dispose` disconnects all nodes and terminates worker

**Unit — `useTranscriptionStore`**
- Default state: `isEnabled=false`, `isLoading=false`, `segments=[]`
- `enable/disable` flip `isEnabled`
- `addSegment` appends to segments
- `clear` empties segments
- `setLoading` toggles `isLoading`

**Unit — `CaptionOverlay`**
- Returns null when `isCaptionsOpen=false`
- Shows spinner when `isLoading=true`
- Renders last 3 segments when ready
- Renders `[userName]: text` format

**Unit — `TranscriptionController`**
- Mock TranscriptionManager
- Creates manager when `isEnabled` becomes true
- Calls `dispose` when `isEnabled` becomes false
- Calls `addStream` when a peer joins while enabled
- Calls `removeStream` when a peer leaves

**Unit — TranscriptionWorker**
- Mock `@huggingface/transformers`; verify `ready` message on init
- Verify `result` message shape on transcribe job
- Verify `error` message on inference failure (worker does not crash)

## Out of Scope

- Speaker diarization (identifying who is speaking when streams mix)
- Transcript export / download
- Translation to other languages
- Persistent transcript history across sessions
- Captions for screen share audio
