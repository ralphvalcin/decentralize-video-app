# Noise Suppression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insert ML-based noise suppression (RNNoise via `@jitsi/rnnoise-wasm`) into the audio pipeline between `getUserMedia` and `PeerManager`, with a one-tap toggle in the control bar.

**Architecture:** A `NoiseProcessor` class owns a `ScriptProcessorNode`-based Web Audio graph. After `getUserMedia` resolves, `MediaController` pipes the raw stream through `NoiseProcessor.process()` and stores the processed stream. `MediaController` observes `isNoiseSuppressed` from `useCallStore` and calls `NoiseProcessor.setEnabled()` to bypass processing without tearing down the graph. Note: `@jitsi/rnnoise-wasm` is a JS wrapper that runs in the main thread; `ScriptProcessorNode` is the correct integration point (vs AudioWorklet which would require raw WASM binary manipulation).

**Tech Stack:** `@jitsi/rnnoise-wasm` v0.2.1, Web Audio API (`AudioContext`, `ScriptProcessorNode`, `MediaStreamAudioDestinationNode`), Zustand, React, TypeScript, Jest

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Create | `src/v2/audio/NoiseProcessor.ts` | Audio processing module |
| Create | `tests/unit/v2/audio/NoiseProcessor.test.ts` | NoiseProcessor unit tests |
| Modify | `src/v2/store/useCallStore.ts` | Add `isNoiseSuppressed` + `toggleNoiseSuppression` |
| Modify | `tests/unit/v2/stores/useCallStore.test.ts` | Tests for new store fields |
| Modify | `src/v2/call/MediaController.tsx` | Pipe stream through NoiseProcessor |
| Modify | `tests/unit/v2/call/MediaController.test.tsx` | Update for NoiseProcessor wiring |
| Modify | `src/v2/call/ControlBar.tsx` | Add noise suppression button |
| Modify | `tests/unit/v2/call/ControlBar.test.tsx` | Tests for noise button |

---

## Task 1: Install @jitsi/rnnoise-wasm

**Files:**
- n/a (package install + optional type declaration)

- [ ] **Step 1: Install the package**

```bash
cd "/Users/ralphucious/App Builds/decentralized-video-app"
npm install @jitsi/rnnoise-wasm
```

Expected: installs `@jitsi/rnnoise-wasm@0.2.1` with no peer dependency warnings.

- [ ] **Step 2: Check if TypeScript types are bundled**

```bash
ls node_modules/@jitsi/rnnoise-wasm/*.d.ts 2>/dev/null || echo "no types found"
```

- [ ] **Step 3: If no types found, create a declaration file**

If the previous step printed "no types found", create `src/v2/audio/rnnoise-wasm.d.ts`:

```typescript
declare module '@jitsi/rnnoise-wasm' {
  interface RnnoiseState {
    /** Denoises the 480-sample frame in-place. Returns VAD probability (0–1). */
    processFrame(frame: Float32Array): number
    destroy(): void
  }
  interface RnnoiseProcessor {
    newState(): RnnoiseState
  }
  function createRnnoiseProcessor(): Promise<RnnoiseProcessor>
  export default createRnnoiseProcessor
}
```

If types are already bundled, skip this step.

- [ ] **Step 4: Run the existing test suite to confirm nothing broke**

```bash
npm test -- --watchAll=false --passWithNoTests 2>&1 | tail -5
```

Expected: `Tests: 6 failed, 310 passed` (same pre-existing failures as before).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/v2/audio/rnnoise-wasm.d.ts 2>/dev/null
git commit -m "feat: install @jitsi/rnnoise-wasm for ML noise suppression"
```

---

## Task 2: useCallStore — isNoiseSuppressed state

**Files:**
- Modify: `src/v2/store/useCallStore.ts`
- Modify: `tests/unit/v2/stores/useCallStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit/v2/stores/useCallStore.test.ts` — append after the last test:

```typescript
test('isNoiseSuppressed defaults to true', () => {
  expect(useCallStore.getState().isNoiseSuppressed).toBe(true)
})

test('toggleNoiseSuppression flips isNoiseSuppressed', () => {
  useCallStore.getState().toggleNoiseSuppression()
  expect(useCallStore.getState().isNoiseSuppressed).toBe(false)
  useCallStore.getState().toggleNoiseSuppression()
  expect(useCallStore.getState().isNoiseSuppressed).toBe(true)
})

test('reset restores isNoiseSuppressed to true', () => {
  useCallStore.getState().toggleNoiseSuppression() // set to false
  useCallStore.getState().reset()
  expect(useCallStore.getState().isNoiseSuppressed).toBe(true)
})
```

Also update the `beforeEach` to include the new field so tests start from a clean state:

```typescript
beforeEach(() => {
  useCallStore.setState({
    localStream: null,
    isMuted: false,
    isCamOff: false,
    userName: '',
    screenSharePeerId: null,
    mediaError: null,
    isNoiseSuppressed: true,
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test -- --watchAll=false --testPathPattern="useCallStore" 2>&1 | tail -15
```

Expected: 3 new failures about `isNoiseSuppressed` and `toggleNoiseSuppression` not existing.

- [ ] **Step 3: Implement the store changes**

Replace the contents of `src/v2/store/useCallStore.ts`:

```typescript
import { create } from 'zustand'

interface CallStore {
  localStream: MediaStream | null
  isMuted: boolean
  isCamOff: boolean
  isNoiseSuppressed: boolean
  userName: string
  screenSharePeerId: string | null
  mediaError: string | null
  setLocalStream: (stream: MediaStream | null) => void
  setMuted: (value: boolean) => void
  setCamOff: (value: boolean) => void
  toggleNoiseSuppression: () => void
  setUserName: (name: string) => void
  setScreenSharePeerId: (id: string | null) => void
  setMediaError: (err: string | null) => void
  reset: () => void
}

export const useCallStore = create<CallStore>((set) => ({
  localStream: null,
  isMuted: false,
  isCamOff: false,
  isNoiseSuppressed: true,
  userName: '',
  screenSharePeerId: null,
  mediaError: null,
  setLocalStream: (stream) => set({ localStream: stream }),
  setMuted: (value) => set({ isMuted: value }),
  setCamOff: (value) => set({ isCamOff: value }),
  toggleNoiseSuppression: () => set((s) => ({ isNoiseSuppressed: !s.isNoiseSuppressed })),
  setUserName: (name) => set({ userName: name }),
  setScreenSharePeerId: (id) => set({ screenSharePeerId: id }),
  setMediaError: (err) => set({ mediaError: err }),
  reset: () => set({ isMuted: false, isCamOff: false, mediaError: null, isNoiseSuppressed: true }),
}))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --watchAll=false --testPathPattern="useCallStore" 2>&1 | tail -10
```

Expected: all tests in useCallStore.test.ts pass.

- [ ] **Step 5: Commit**

```bash
git add src/v2/store/useCallStore.ts tests/unit/v2/stores/useCallStore.test.ts
git commit -m "feat(store): add isNoiseSuppressed state and toggleNoiseSuppression action"
```

---

## Task 3: NoiseProcessor module

**Files:**
- Create: `src/v2/audio/NoiseProcessor.ts`
- Create: `tests/unit/v2/audio/NoiseProcessor.test.ts`

- [ ] **Step 1: Create the test directory**

```bash
mkdir -p "/Users/ralphucious/App Builds/decentralized-video-app/tests/unit/v2/audio"
```

- [ ] **Step 2: Write the failing tests**

Create `tests/unit/v2/audio/NoiseProcessor.test.ts`:

```typescript
import { NoiseProcessor } from '../../../../src/v2/audio/NoiseProcessor'

const mockProcessFrame = jest.fn((frame: Float32Array) => {
  frame.fill(0) // simulate in-place denoising
  return 0.9   // VAD score
})
const mockDenoiseState = { processFrame: mockProcessFrame, destroy: jest.fn() }
const mockRnnoiseModule = { newState: jest.fn(() => mockDenoiseState) }

jest.mock('@jitsi/rnnoise-wasm', () => jest.fn().mockResolvedValue(mockRnnoiseModule))

const mockDestStream = { id: 'dest-stream' } as unknown as MediaStream
const mockDestination = { stream: mockDestStream, connect: jest.fn() }
const mockScriptNode = { connect: jest.fn(), disconnect: jest.fn(), onaudioprocess: null as any }
const mockSource = { connect: jest.fn(), disconnect: jest.fn() }
const mockCtx = {
  createMediaStreamSource: jest.fn(() => mockSource),
  createScriptProcessor: jest.fn(() => mockScriptNode),
  createMediaStreamDestination: jest.fn(() => mockDestination),
  close: jest.fn().mockResolvedValue(undefined),
}

beforeEach(() => {
  global.AudioContext = jest.fn().mockReturnValue(mockCtx) as any
  mockScriptNode.connect.mockClear()
  mockScriptNode.disconnect.mockClear()
  mockSource.connect.mockClear()
  mockSource.disconnect.mockClear()
  mockCtx.close.mockClear()
  mockProcessFrame.mockClear()
  mockDenoiseState.destroy.mockClear()
  mockRnnoiseModule.newState.mockClear()
})

afterEach(() => {
  delete (global as any).AudioContext
})

test('process() returns the destination MediaStream', async () => {
  const processor = new NoiseProcessor()
  const result = await processor.process({} as MediaStream)
  expect(result).toBe(mockDestStream)
})

test('process() wires: source → scriptNode → destination', async () => {
  const processor = new NoiseProcessor()
  await processor.process({} as MediaStream)
  expect(mockSource.connect).toHaveBeenCalledWith(mockScriptNode)
  expect(mockScriptNode.connect).toHaveBeenCalledWith(mockDestination)
})

test('process() creates ScriptProcessorNode with bufferSize 4096, 1 input, 1 output channel', async () => {
  const processor = new NoiseProcessor()
  await processor.process({} as MediaStream)
  expect(mockCtx.createScriptProcessor).toHaveBeenCalledWith(4096, 1, 1)
})

test('process() returns raw stream and sets isSupported=false if AudioContext unavailable', async () => {
  delete (global as any).AudioContext
  const processor = new NoiseProcessor()
  const rawStream = {} as MediaStream
  const result = await processor.process(rawStream)
  expect(result).toBe(rawStream)
  expect(processor.isSupported).toBe(false)
})

test('process() returns raw stream and logs warning if rnnoise-wasm throws', async () => {
  const createRnnoise = require('@jitsi/rnnoise-wasm')
  createRnnoise.mockRejectedValueOnce(new Error('WASM load failed'))
  const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const processor = new NoiseProcessor()
  const rawStream = {} as MediaStream
  const result = await processor.process(rawStream)
  expect(result).toBe(rawStream)
  expect(consoleSpy).toHaveBeenCalledWith(
    '[NoiseProcessor] init failed, using raw stream',
    expect.any(Error)
  )
  consoleSpy.mockRestore()
})

test('setEnabled(false) passes audio through without calling processFrame', async () => {
  const processor = new NoiseProcessor()
  await processor.process({} as MediaStream)
  processor.setEnabled(false)

  const input = new Float32Array(128).fill(0.5)
  const output = new Float32Array(128)
  ;(processor as any)._processAudio(input, output)

  expect(output[0]).toBe(0.5)
  expect(mockProcessFrame).not.toHaveBeenCalled()
})

test('setEnabled(true) routes audio through rnnoise processFrame', async () => {
  const processor = new NoiseProcessor()
  await processor.process({} as MediaStream)
  processor.setEnabled(true)

  const input = new Float32Array(480).fill(0.5)
  const output = new Float32Array(480)
  ;(processor as any)._processAudio(input, output)

  expect(mockProcessFrame).toHaveBeenCalledTimes(1)
})

test('_processAudio buffers samples until 480 accumulate before processing', async () => {
  const processor = new NoiseProcessor()
  await processor.process({} as MediaStream)
  processor.setEnabled(true)

  // 256 samples — below 480 threshold
  ;(processor as any)._processAudio(new Float32Array(256).fill(0.3), new Float32Array(256))
  expect(mockProcessFrame).not.toHaveBeenCalled()

  // 256 more — combined 512 >= 480: one frame processes, 32 remain pending
  ;(processor as any)._processAudio(new Float32Array(256).fill(0.3), new Float32Array(256))
  expect(mockProcessFrame).toHaveBeenCalledTimes(1)
  expect((processor as any).inputPending.length).toBe(32)
})

test('_processAudio processes 8 frames from a 4096-sample ScriptProcessor callback', async () => {
  const processor = new NoiseProcessor()
  await processor.process({} as MediaStream)
  processor.setEnabled(true)

  ;(processor as any)._processAudio(new Float32Array(4096).fill(0.4), new Float32Array(4096))

  // 4096 / 480 = 8.53 → 8 complete frames (3840 samples), 256 pending
  expect(mockProcessFrame).toHaveBeenCalledTimes(8)
  expect((processor as any).inputPending.length).toBe(256)
})

test('dispose() disconnects source, scriptNode, destroys denoiseState, and closes AudioContext', async () => {
  const processor = new NoiseProcessor()
  await processor.process({} as MediaStream)
  processor.dispose()

  expect(mockSource.disconnect).toHaveBeenCalled()
  expect(mockScriptNode.disconnect).toHaveBeenCalled()
  expect(mockDenoiseState.destroy).toHaveBeenCalled()
  expect(mockCtx.close).toHaveBeenCalled()
})
```

- [ ] **Step 3: Run to verify they fail**

```bash
npm test -- --watchAll=false --testPathPattern="NoiseProcessor" 2>&1 | tail -10
```

Expected: all tests fail — `NoiseProcessor` does not exist yet.

- [ ] **Step 4: Create the NoiseProcessor module**

Create `src/v2/audio/NoiseProcessor.ts`:

```typescript
import createRnnoiseProcessor from '@jitsi/rnnoise-wasm'

interface DenoiseState {
  processFrame(frame: Float32Array): number
  destroy(): void
}

export class NoiseProcessor {
  private ctx: AudioContext | null = null
  private scriptNode: ScriptProcessorNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private destination: MediaStreamAudioDestinationNode | null = null
  private denoiseState: DenoiseState | null = null
  private _enabled = true
  private _supported = true
  // Samples that did not fill a complete 480-sample RNNoise frame
  private inputPending = new Float32Array(0)
  // Processed samples waiting to fill the next ScriptProcessor output buffer
  private outputPending = new Float32Array(0)

  async process(rawStream: MediaStream): Promise<MediaStream> {
    if (typeof AudioContext === 'undefined') {
      this._supported = false
      return rawStream
    }
    try {
      const rnnoise = await createRnnoiseProcessor()
      this.denoiseState = rnnoise.newState()
      this.ctx = new AudioContext({ sampleRate: 48000 })
      this.source = this.ctx.createMediaStreamSource(rawStream)
      this.scriptNode = this.ctx.createScriptProcessor(4096, 1, 1)
      this.destination = this.ctx.createMediaStreamDestination()

      this.scriptNode.onaudioprocess = (e) => {
        this._processAudio(
          e.inputBuffer.getChannelData(0),
          e.outputBuffer.getChannelData(0),
        )
      }

      this.source.connect(this.scriptNode)
      this.scriptNode.connect(this.destination)
      return this.destination.stream
    } catch (err) {
      console.warn('[NoiseProcessor] init failed, using raw stream', err)
      return rawStream
    }
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled
  }

  get isSupported(): boolean {
    return this._supported
  }

  dispose(): void {
    this.source?.disconnect()
    this.scriptNode?.disconnect()
    this.denoiseState?.destroy()
    this.ctx?.close()
    this.ctx = null
    this.source = null
    this.scriptNode = null
    this.destination = null
    this.denoiseState = null
  }

  _processAudio(input: Float32Array, output: Float32Array): void {
    if (!this._enabled || !this.denoiseState) {
      output.set(input)
      return
    }

    // Combine any leftover samples with new input
    const combined = new Float32Array(this.inputPending.length + input.length)
    combined.set(this.inputPending)
    combined.set(input, this.inputPending.length)

    // Process all complete 480-sample frames
    const outputChunks: Float32Array[] = []
    let offset = 0
    while (offset + 480 <= combined.length) {
      const frame = combined.slice(offset, offset + 480)
      this.denoiseState.processFrame(frame) // modifies frame in-place
      outputChunks.push(frame)
      offset += 480
    }
    this.inputPending = combined.slice(offset)

    // Collect newly processed output alongside any previously buffered output
    const totalNew = outputChunks.reduce((s, c) => s + c.length, 0)
    const allProcessed = new Float32Array(this.outputPending.length + totalNew)
    allProcessed.set(this.outputPending)
    let pos = this.outputPending.length
    for (const chunk of outputChunks) {
      allProcessed.set(chunk, pos)
      pos += chunk.length
    }

    // Write what fits into the output buffer; pad with silence if behind
    const toWrite = Math.min(allProcessed.length, output.length)
    output.set(allProcessed.subarray(0, toWrite))
    if (toWrite < output.length) output.fill(0, toWrite)
    this.outputPending = allProcessed.slice(toWrite)
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --watchAll=false --testPathPattern="NoiseProcessor" 2>&1 | tail -10
```

Expected: all NoiseProcessor tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/v2/audio/NoiseProcessor.ts tests/unit/v2/audio/NoiseProcessor.test.ts
git commit -m "feat: NoiseProcessor — RNNoise WASM audio processing via ScriptProcessorNode"
```

---

## Task 4: MediaController — wire NoiseProcessor

**Files:**
- Modify: `src/v2/call/MediaController.tsx`
- Modify: `tests/unit/v2/call/MediaController.test.tsx`

- [ ] **Step 1: Update the MediaController tests**

Replace the entire contents of `tests/unit/v2/call/MediaController.test.tsx`:

```typescript
import { render, act } from '@testing-library/react'
import { MediaController } from '../../../../src/v2/call/MediaController'
import { useCallStore } from '../../../../src/v2/store/useCallStore'

// Mock NoiseProcessor so MediaController tests don't need AudioContext
const mockProcessedStream = {
  id: 'processed-stream',
  getTracks: () => [],
} as unknown as MediaStream
const mockNoiseProcessorInstance = {
  process: jest.fn().mockResolvedValue(mockProcessedStream),
  setEnabled: jest.fn(),
  dispose: jest.fn(),
  isSupported: true,
}
jest.mock('../../../../src/v2/audio/NoiseProcessor', () => ({
  NoiseProcessor: jest.fn().mockImplementation(() => mockNoiseProcessorInstance),
}))

describe('MediaController', () => {
  const mockAudioTrack = { enabled: true, stop: jest.fn(), kind: 'audio', onended: null as (() => void) | null }
  const mockVideoTrack = { enabled: true, stop: jest.fn(), kind: 'video', onended: null as (() => void) | null }
  const mockStream = {
    getTracks: () => [mockAudioTrack, mockVideoTrack],
    getAudioTracks: () => [mockAudioTrack],
    getVideoTracks: () => [mockVideoTrack],
  }

  beforeEach(() => {
    mockAudioTrack.enabled = true
    mockVideoTrack.enabled = true
    mockAudioTrack.onended = null
    mockVideoTrack.onended = null
    mockAudioTrack.stop.mockClear()
    mockVideoTrack.stop.mockClear()
    mockNoiseProcessorInstance.process.mockClear()
    mockNoiseProcessorInstance.setEnabled.mockClear()
    mockNoiseProcessorInstance.dispose.mockClear()
    mockNoiseProcessorInstance.process.mockResolvedValue(mockProcessedStream)
    jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream as any)
    useCallStore.setState({
      localStream: null, isMuted: false, isCamOff: false,
      mediaError: null, isNoiseSuppressed: true,
    })
  })

  afterEach(() => { jest.restoreAllMocks() })

  test('acquires stream, pipes through NoiseProcessor, writes processed stream to store', async () => {
    await act(async () => { render(<MediaController />) })
    expect(mockNoiseProcessorInstance.process).toHaveBeenCalledWith(mockStream)
    expect(useCallStore.getState().localStream).toBe(mockProcessedStream)
  })

  test('stops all raw tracks and clears store on unmount', async () => {
    let unmount!: () => void
    await act(async () => { unmount = render(<MediaController />).unmount })
    act(() => { unmount() })
    expect(mockAudioTrack.stop).toHaveBeenCalled()
    expect(mockVideoTrack.stop).toHaveBeenCalled()
    expect(useCallStore.getState().localStream).toBeNull()
  })

  test('disposes NoiseProcessor on unmount', async () => {
    let unmount!: () => void
    await act(async () => { unmount = render(<MediaController />).unmount })
    act(() => { unmount() })
    expect(mockNoiseProcessorInstance.dispose).toHaveBeenCalled()
  })

  test('calls NoiseProcessor.setEnabled when isNoiseSuppressed changes', async () => {
    await act(async () => { render(<MediaController />) })
    act(() => { useCallStore.getState().toggleNoiseSuppression() })
    expect(mockNoiseProcessorInstance.setEnabled).toHaveBeenCalledWith(false)
    act(() => { useCallStore.getState().toggleNoiseSuppression() })
    expect(mockNoiseProcessorInstance.setEnabled).toHaveBeenCalledWith(true)
  })

  test('disables audio track when isMuted becomes true', async () => {
    await act(async () => { render(<MediaController />) })
    act(() => { useCallStore.getState().setMuted(true) })
    expect(mockAudioTrack.enabled).toBe(false)
  })

  test('re-enables audio track when isMuted becomes false', async () => {
    useCallStore.setState({ isMuted: true })
    await act(async () => { render(<MediaController />) })
    act(() => { useCallStore.getState().setMuted(false) })
    expect(mockAudioTrack.enabled).toBe(true)
  })

  test('disables video track when isCamOff becomes true', async () => {
    await act(async () => { render(<MediaController />) })
    act(() => { useCallStore.getState().setCamOff(true) })
    expect(mockVideoTrack.enabled).toBe(false)
  })

  test('re-enables video track when isCamOff becomes false', async () => {
    useCallStore.setState({ isCamOff: true })
    await act(async () => { render(<MediaController />) })
    act(() => { useCallStore.getState().setCamOff(false) })
    expect(mockVideoTrack.enabled).toBe(true)
  })

  test('applies initial muted/cam state to tracks when stream resolves', async () => {
    useCallStore.setState({ isMuted: true, isCamOff: true })
    await act(async () => { render(<MediaController />) })
    expect(mockAudioTrack.enabled).toBe(false)
    expect(mockVideoTrack.enabled).toBe(false)
  })

  test('stops acquired stream immediately if unmounted before getUserMedia resolves', async () => {
    let resolveStream!: (s: MediaStream) => void
    jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockReturnValue(
      new Promise<MediaStream>((res) => { resolveStream = res })
    )
    const { unmount } = render(<MediaController />)
    act(() => { unmount() })
    await act(async () => { resolveStream(mockStream as any) })
    expect(mockAudioTrack.stop).toHaveBeenCalled()
    expect(mockVideoTrack.stop).toHaveBeenCalled()
    expect(useCallStore.getState().localStream).toBeNull()
  })

  test('sets isMuted true when audio track ends unexpectedly', async () => {
    await act(async () => { render(<MediaController />) })
    act(() => { mockAudioTrack.onended?.() })
    expect(useCallStore.getState().isMuted).toBe(true)
  })

  test('sets isCamOff true when video track ends unexpectedly', async () => {
    await act(async () => { render(<MediaController />) })
    act(() => { mockVideoTrack.onended?.() })
    expect(useCallStore.getState().isCamOff).toBe(true)
  })

  test('permission denied: store stays empty and mediaError is set', async () => {
    jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(
      new DOMException('Permission denied', 'NotAllowedError')
    )
    jest.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => { render(<MediaController />) })
    expect(useCallStore.getState().localStream).toBeNull()
    expect(useCallStore.getState().mediaError).toBe('Permission denied')
  })

  test('unmount clears onended handlers before stopping tracks', async () => {
    let unmount!: () => void
    await act(async () => { unmount = render(<MediaController />).unmount })
    expect(mockAudioTrack.onended).not.toBeNull()
    expect(mockVideoTrack.onended).not.toBeNull()
    act(() => { unmount() })
    expect(mockAudioTrack.onended).toBeNull()
    expect(mockVideoTrack.onended).toBeNull()
    expect(useCallStore.getState().isMuted).toBe(false)
    expect(useCallStore.getState().isCamOff).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify new tests fail**

```bash
npm test -- --watchAll=false --testPathPattern="MediaController" 2>&1 | tail -15
```

Expected: failures on the new tests (NoiseProcessor not yet wired into MediaController).

- [ ] **Step 3: Update MediaController to pipe through NoiseProcessor**

Replace the entire contents of `src/v2/call/MediaController.tsx`:

```typescript
import { useEffect, useRef } from 'react'
import { useCallStore } from '../store/useCallStore'
import { NoiseProcessor } from '../audio/NoiseProcessor'

export function MediaController() {
  const setLocalStream = useCallStore((s) => s.setLocalStream)
  const isMuted = useCallStore((s) => s.isMuted)
  const isCamOff = useCallStore((s) => s.isCamOff)
  const isNoiseSuppressed = useCallStore((s) => s.isNoiseSuppressed)
  const rawStreamRef = useRef<MediaStream | null>(null)
  const noiseProcessorRef = useRef<NoiseProcessor | null>(null)

  useEffect(() => {
    let cancelled = false
    const noiseProcessor = new NoiseProcessor()
    noiseProcessorRef.current = noiseProcessor

    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const { isMuted: muted, isCamOff: camOff } = useCallStore.getState()
        stream.getAudioTracks().forEach((t) => {
          t.enabled = !muted
          t.onended = () => { useCallStore.getState().setMuted(true) }
        })
        stream.getVideoTracks().forEach((t) => {
          t.enabled = !camOff
          t.onended = () => { useCallStore.getState().setCamOff(true) }
        })
        rawStreamRef.current = stream

        const processedStream = await noiseProcessor.process(stream)
        if (!cancelled) {
          setLocalStream(processedStream)
        }
      })
      .catch((err) => {
        console.error('[MediaController] getUserMedia failed:', err)
        useCallStore.getState().setMediaError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      cancelled = true
      rawStreamRef.current?.getTracks().forEach((t) => {
        t.onended = null
        t.stop()
      })
      rawStreamRef.current = null
      noiseProcessorRef.current?.dispose()
      noiseProcessorRef.current = null
      setLocalStream(null)
    }
  }, [setLocalStream])

  useEffect(() => {
    rawStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !isMuted
    })
  }, [isMuted])

  useEffect(() => {
    rawStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !isCamOff
    })
  }, [isCamOff])

  useEffect(() => {
    noiseProcessorRef.current?.setEnabled(isNoiseSuppressed)
  }, [isNoiseSuppressed])

  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --watchAll=false --testPathPattern="MediaController" 2>&1 | tail -10
```

Expected: all MediaController tests pass.

- [ ] **Step 5: Run full suite**

```bash
npm test -- --watchAll=false 2>&1 | tail -5
```

Expected: `Tests: 6 failed, N passed` where the 6 failures are the same pre-existing PeerManager integration failures and N is higher than before.

- [ ] **Step 6: Commit**

```bash
git add src/v2/call/MediaController.tsx tests/unit/v2/call/MediaController.test.tsx
git commit -m "feat(MediaController): pipe getUserMedia stream through NoiseProcessor"
```

---

## Task 5: ControlBar — noise suppression button

**Files:**
- Modify: `src/v2/call/ControlBar.tsx`
- Modify: `tests/unit/v2/call/ControlBar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/v2/call/ControlBar.test.tsx`:

```typescript
test('noise button renders in the control bar', () => {
  useCallStore.setState({ isNoiseSuppressed: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-noise')).toBeInTheDocument()
})

test('noise button shows primary variant when noise suppression is on', () => {
  useCallStore.setState({ isNoiseSuppressed: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  // Button text reflects active state
  expect(screen.getByTestId('btn-noise')).toHaveTextContent('🎛 Noise: On')
})

test('noise button shows ghost variant when noise suppression is off', () => {
  useCallStore.setState({ isNoiseSuppressed: false })
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-noise')).toHaveTextContent('🎛 Noise: Off')
})

test('clicking noise button toggles isNoiseSuppressed in store', () => {
  useCallStore.setState({ isNoiseSuppressed: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-noise'))
  expect(useCallStore.getState().isNoiseSuppressed).toBe(false)
  fireEvent.click(screen.getByTestId('btn-noise'))
  expect(useCallStore.getState().isNoiseSuppressed).toBe(true)
})
```

Also update the `beforeEach` at the top of the ControlBar test to include `isNoiseSuppressed`:

```typescript
beforeEach(() => {
  useCallStore.setState({ isMuted: false, isCamOff: false, isNoiseSuppressed: true })
  useUIStore.setState({ isChatOpen: false, isParticipantsOpen: false, isQAOpen: false, isAIOpen: false })
  jest.useFakeTimers()
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test -- --watchAll=false --testPathPattern="ControlBar" 2>&1 | tail -10
```

Expected: 4 new failures — `btn-noise` not found.

- [ ] **Step 3: Add the noise suppression button to ControlBar**

In `src/v2/call/ControlBar.tsx`, add the store selector after `toggleAI`:

```typescript
  const isNoiseSuppressed = useCallStore((s) => s.isNoiseSuppressed)
  const toggleNoiseSuppression = useCallStore((s) => s.toggleNoiseSuppression)
```

Then add the button between the AI button and the Leave button (inside the motion.div, after the `btn-ai` Button):

```tsx
          <Button
            data-testid="btn-noise"
            variant={isNoiseSuppressed ? 'primary' : 'ghost'}
            onClick={toggleNoiseSuppression}
            aria-label="Noise Suppression"
          >
            {isNoiseSuppressed ? '🎛 Noise: On' : '🎛 Noise: Off'}
          </Button>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --watchAll=false --testPathPattern="ControlBar" 2>&1 | tail -10
```

Expected: all ControlBar tests pass.

- [ ] **Step 5: Run full test suite**

```bash
npm test -- --watchAll=false 2>&1 | tail -5
```

Expected: `Tests: 6 failed, N passed` — only the pre-existing PeerManager integration failures.

- [ ] **Step 6: Commit**

```bash
git add src/v2/call/ControlBar.tsx tests/unit/v2/call/ControlBar.test.tsx
git commit -m "feat(ControlBar): add noise suppression toggle button"
```

---

## Done

All 5 tasks complete. The noise suppression pipeline is live:
- `getUserMedia` → `NoiseProcessor.process()` → processed stream in store → PeerManager (unchanged)
- Toggle mid-call via `setEnabled()` — no stream replacement, no peer renegotiation
- Control bar button reflects `isNoiseSuppressed` state from store
- All new tests pass; 6 pre-existing integration failures unchanged
