# Noise Suppression — Design Spec

**Date:** 2026-05-29
**Status:** Approved

## Goal

Add ML-based noise suppression to the v2 audio pipeline using RNNoise (WASM). Clean audio improves call quality now and sets up the AudioWorklet infrastructure needed for AI transcription (next feature).

## Approach

Insert a Web Audio processing graph between `getUserMedia` and `PeerManager`. The raw `MediaStream` is piped through a `NoiseProcessor` module that runs RNNoise in an `AudioWorklet`. The processed stream replaces the raw one in `useCallStore` — everything downstream (PeerManager, peer connections) is unchanged.

Toggle bypass mid-call by rewiring the audio graph rather than replacing the stream, avoiding peer renegotiation.

## Architecture

```
getUserMedia → raw MediaStream
  → NoiseProcessor.process(raw)   [async: load WASM, register worklet]
  → processed MediaStream
  → useCallStore.setLocalStream(processed)
  → PeerManager.addTrack(...)     [unchanged]
```

**Toggle (mid-call):**
`NoiseProcessor.setEnabled(false)` reconnects source node directly to destination, bypassing RNNoise. `setEnabled(true)` reconnects through the worklet. Stream identity in the store does not change — no peer renegotiation required.

## Files

### New

**`src/v2/audio/NoiseProcessor.ts`**
Core module. Responsibilities:
- Initialize `AudioContext`
- Load `@jitsi/rnnoise-wasm` and register the AudioWorklet
- Expose `process(rawStream: MediaStream): Promise<MediaStream>` — returns processed stream; falls back to raw stream on any failure
- Expose `setEnabled(enabled: boolean): void` — rewires audio graph for bypass
- Resume suspended `AudioContext` on first user interaction

**`src/v2/audio/noise-suppression.worklet.ts`**
AudioWorklet processor. Responsibilities:
- Buffer incoming 128-sample frames into 480-sample RNNoise frames (RNNoise requires 480 samples at 48kHz / 10ms chunks)
- Feed buffered frames to RNNoise
- Write denoised output back to AudioWorklet output buffer

**`@jitsi/rnnoise-wasm`** (npm dependency)
Jitsi's production-maintained RNNoise WASM fork. ~100KB binary, loads once per session.

### Modified

**`src/v2/call/MediaController.tsx`**
After `getUserMedia` resolves, pipe stream through `NoiseProcessor.process()` before calling `useCallStore.setLocalStream()`. Initialize `NoiseProcessor` once on mount, dispose on unmount.

**`src/v2/store/useCallStore.ts`**
Add:
- `isNoiseSuppressed: boolean` — default `true`
- `toggleNoiseSuppression(): void` — flips state only (mirrors the existing `isMuted` pattern)

`MediaController` observes `isNoiseSuppressed` in a `useEffect` and calls `NoiseProcessor.setEnabled()` — the store does not call the audio module directly.

**`src/v2/ui/ControlBar.tsx`**
Add noise suppression button:
- Icon: waveform (active) / waveform with slash (inactive)
- Reads `isNoiseSuppressed` from store
- Calls `toggleNoiseSuppression()` on click
- Renders disabled (with tooltip "Not supported in this browser") if AudioWorklet unavailable

## Error Handling

All failures fall back gracefully to the raw stream. The feature is never fatal.

| Failure | Behavior |
|---|---|
| `AudioWorklet` API not supported | `process()` returns raw stream; button disabled with tooltip |
| WASM load failure | `process()` returns raw stream; logs warning |
| `AudioContext` suspended (autoplay policy) | Resumed on first user interaction (mic toggle or room join) |

## Default State

Noise suppression is **on by default** (`isNoiseSuppressed: true`). Users in noisy environments benefit immediately; users in quiet environments won't notice the overhead (~2% CPU on modern hardware).

## Testing

**Unit — `NoiseProcessor`**
- Mock `AudioContext` and WASM module
- Verify worklet registration on `process()`
- Verify bypass graph rewiring on `setEnabled(false)` and `setEnabled(true)`
- Verify raw stream returned when worklet unavailable

**Unit — worklet**
- Feed known 480-sample frames, verify output shape
- Verify RNNoise called with correctly buffered input

**Store**
- `toggleNoiseSuppression` flips `isNoiseSuppressed`
- Default value is `true`

**UI**
- Button renders in ControlBar
- Clicking dispatches `toggleNoiseSuppression`
- Active/inactive visual states reflect store value
- Disabled state renders when `AudioWorklet` unavailable

## Out of Scope

- Per-device noise suppression settings (same setting applies to all audio input devices)
- Server-side audio processing
- Noise suppression for remote participants' streams
- Visual noise level indicator / meter
