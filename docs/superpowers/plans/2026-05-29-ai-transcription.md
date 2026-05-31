# AI Transcription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time Whisper WASM speech-to-text captions for all call participants (local + remote), off by default, toggled via a CC button in the ControlBar.

**Architecture:** A `TranscriptionManager` service class attaches a `ScriptProcessorNode` per participant stream, accumulates 5-second audio windows, downsamples 48kHz → 16kHz, and serially enqueues jobs to a Web Worker running `Xenova/whisper-tiny`. Results flow through `useTranscriptionStore` and render in a `CaptionOverlay` floating above the ControlBar. A renderless `TranscriptionController` component wires the manager to store events and peer join/leave signals.

**Tech Stack:** `@huggingface/transformers` (Xenova/whisper-tiny), Zustand, Web Workers, Web Audio API (ScriptProcessorNode), React hooks, Jest + @testing-library/react

---

## File Map

**Create:**
- `src/v2/types/index.ts` — add `TranscriptSegment` interface (modify existing)
- `src/v2/store/useTranscriptionStore.ts` — Zustand store: `isEnabled`, `isLoading`, `segments[]`
- `src/v2/audio/TranscriptionWorker.ts` — Web Worker: loads whisper-tiny, transcribes Float32Array jobs
- `src/v2/audio/workerFactory.ts` — thin factory: `createTranscriptionWorker()` — isolates `import.meta.url` from Jest
- `src/v2/audio/TranscriptionManager.ts` — service class: ScriptProcessorNode per stream, 5s buffer, serial job queue
- `src/v2/call/TranscriptionController.tsx` — renderless component: observes stores, creates/disposes manager
- `src/v2/components/ai/CaptionOverlay.tsx` — overlay: last 3 segments above ControlBar

**Modify:**
- `src/v2/store/useUIStore.ts` — add `isCaptionsOpen: boolean`, `toggleCaptions()` (calls transcription store)
- `src/v2/call/ControlBar.tsx` — add CC button (btn-cc) between noise button and Leave
- `src/v2/pages/RoomV2.tsx` — mount `<TranscriptionController />`, render `<CaptionOverlay />`
- `jest.setup.js` — add global mock for `@huggingface/transformers`

**Tests (new):**
- `tests/unit/v2/stores/useTranscriptionStore.test.ts`
- `tests/unit/v2/audio/TranscriptionWorker.test.ts`
- `tests/unit/v2/audio/TranscriptionManager.test.ts`
- `tests/unit/v2/components/ai/CaptionOverlay.test.tsx`
- `tests/unit/v2/call/TranscriptionController.test.tsx`

**Tests (modify):**
- `tests/unit/v2/stores/useUIStore.test.ts`
- `tests/unit/v2/call/ControlBar.test.tsx`

---

## Task 1: Install package + TranscriptSegment type + useTranscriptionStore

**Files:**
- Modify: `package.json` (npm install)
- Modify: `src/v2/types/index.ts`
- Create: `src/v2/store/useTranscriptionStore.ts`
- Create: `tests/unit/v2/stores/useTranscriptionStore.test.ts`

- [ ] **Step 1: Install @huggingface/transformers**

```bash
cd "/Users/ralphucious/App Builds/decentralized-video-app"
npm install @huggingface/transformers
```

Expected: package added to `node_modules/@huggingface/transformers`, no peer dependency errors.

- [ ] **Step 2: Write failing store tests**

Create `tests/unit/v2/stores/useTranscriptionStore.test.ts`:

```typescript
import { useTranscriptionStore } from '../../../../src/v2/store/useTranscriptionStore'

beforeEach(() => {
  useTranscriptionStore.setState({ isEnabled: false, isLoading: false, segments: [] })
})

test('default state: isEnabled=false, isLoading=false, segments=[]', () => {
  const s = useTranscriptionStore.getState()
  expect(s.isEnabled).toBe(false)
  expect(s.isLoading).toBe(false)
  expect(s.segments).toEqual([])
})

test('enable sets isEnabled to true', () => {
  useTranscriptionStore.getState().enable()
  expect(useTranscriptionStore.getState().isEnabled).toBe(true)
})

test('disable sets isEnabled to false', () => {
  useTranscriptionStore.setState({ isEnabled: true })
  useTranscriptionStore.getState().disable()
  expect(useTranscriptionStore.getState().isEnabled).toBe(false)
})

test('setLoading(true) sets isLoading to true', () => {
  useTranscriptionStore.getState().setLoading(true)
  expect(useTranscriptionStore.getState().isLoading).toBe(true)
})

test('setLoading(false) sets isLoading to false', () => {
  useTranscriptionStore.setState({ isLoading: true })
  useTranscriptionStore.getState().setLoading(false)
  expect(useTranscriptionStore.getState().isLoading).toBe(false)
})

test('addSegment appends a segment', () => {
  const seg = { speakerId: 's1', userName: 'Alice', text: 'hello', timestamp: 1000 }
  useTranscriptionStore.getState().addSegment(seg)
  expect(useTranscriptionStore.getState().segments).toEqual([seg])
})

test('addSegment appends multiple segments in order', () => {
  const s1 = { speakerId: 's1', userName: 'Alice', text: 'hi', timestamp: 1 }
  const s2 = { speakerId: 's2', userName: 'Bob', text: 'hey', timestamp: 2 }
  useTranscriptionStore.getState().addSegment(s1)
  useTranscriptionStore.getState().addSegment(s2)
  expect(useTranscriptionStore.getState().segments).toEqual([s1, s2])
})

test('clear empties segments', () => {
  useTranscriptionStore.setState({
    segments: [{ speakerId: 's1', userName: 'Alice', text: 'hi', timestamp: 1 }],
  })
  useTranscriptionStore.getState().clear()
  expect(useTranscriptionStore.getState().segments).toEqual([])
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd "/Users/ralphucious/App Builds/decentralized-video-app"
npx jest tests/unit/v2/stores/useTranscriptionStore.test.ts --no-coverage 2>&1 | tail -20
```

Expected: `Cannot find module '../../../../src/v2/store/useTranscriptionStore'`

- [ ] **Step 4: Add TranscriptSegment to types/index.ts**

Open `src/v2/types/index.ts` and append before the closing of the file:

```typescript
export interface TranscriptSegment {
  speakerId: string
  userName: string
  text: string
  timestamp: number
}
```

- [ ] **Step 5: Create useTranscriptionStore.ts**

Create `src/v2/store/useTranscriptionStore.ts`:

```typescript
import { create } from 'zustand'
import type { TranscriptSegment } from '../types'

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

export const useTranscriptionStore = create<TranscriptionStore>((set) => ({
  isEnabled: false,
  isLoading: false,
  segments: [],
  enable: () => set({ isEnabled: true }),
  disable: () => set({ isEnabled: false }),
  setLoading: (value) => set({ isLoading: value }),
  addSegment: (segment) => set((s) => ({ segments: [...s.segments, segment] })),
  clear: () => set({ segments: [] }),
}))
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx jest tests/unit/v2/stores/useTranscriptionStore.test.ts --no-coverage 2>&1 | tail -10
```

Expected: `8 passed`

- [ ] **Step 7: Run full suite to verify no regressions**

```bash
npx jest --no-coverage 2>&1 | tail -5
```

Expected: same pass/fail counts as before (329 passing, 6 pre-existing failures).

- [ ] **Step 8: Commit**

```bash
git add src/v2/types/index.ts src/v2/store/useTranscriptionStore.ts tests/unit/v2/stores/useTranscriptionStore.test.ts package.json package-lock.json
git commit -m "feat(transcription): useTranscriptionStore + TranscriptSegment type"
```

---

## Task 2: TranscriptionWorker + global mock

**Files:**
- Create: `src/v2/audio/TranscriptionWorker.ts`
- Modify: `jest.setup.js`
- Create: `tests/unit/v2/audio/TranscriptionWorker.test.ts`

- [ ] **Step 1: Write failing worker tests**

Create `tests/unit/v2/audio/TranscriptionWorker.test.ts`:

```typescript
jest.mock('@huggingface/transformers', () => ({
  pipeline: jest.fn(),
}))

describe('TranscriptionWorker', () => {
  const mockTranscriber = jest.fn()
  let postMessageSpy: jest.SpyInstance

  beforeAll(() => {
    postMessageSpy = jest.spyOn(self, 'postMessage').mockImplementation(() => {})
    ;(require('@huggingface/transformers').pipeline as jest.Mock).mockResolvedValue(mockTranscriber)
    require('../../../../src/v2/audio/TranscriptionWorker')
  })

  afterAll(() => {
    postMessageSpy.mockRestore()
  })

  afterEach(() => {
    postMessageSpy.mockClear()
    mockTranscriber.mockClear()
  })

  test('posts { type: "ready" } on init success', async () => {
    await (self as any).onmessage({ data: { type: 'init' } } as MessageEvent)
    expect(postMessageSpy).toHaveBeenCalledWith({ type: 'ready' })
  })

  test('posts result with correct shape on transcribe job', async () => {
    mockTranscriber.mockResolvedValue({ text: 'hello world' })
    const audio = new Float32Array(16000)
    await (self as any).onmessage({
      data: { type: 'transcribe', speakerId: 's1', userName: 'Alice', audio },
    } as MessageEvent)
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'result',
        speakerId: 's1',
        userName: 'Alice',
        text: 'hello world',
        timestamp: expect.any(Number),
      })
    )
  })

  test('posts error on inference failure; worker stays alive for next job', async () => {
    mockTranscriber.mockRejectedValue(new Error('inference failed'))
    const audio = new Float32Array(16000)
    await (self as any).onmessage({
      data: { type: 'transcribe', speakerId: 's1', userName: 'Alice', audio },
    } as MessageEvent)
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', speakerId: 's1' })
    )
    // Worker must still be alive — verify it can process another job
    mockTranscriber.mockResolvedValue({ text: 'recovered' })
    postMessageSpy.mockClear()
    await (self as any).onmessage({
      data: { type: 'transcribe', speakerId: 's1', userName: 'Alice', audio },
    } as MessageEvent)
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'result', text: 'recovered' })
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/v2/audio/TranscriptionWorker.test.ts --no-coverage 2>&1 | tail -15
```

Expected: `Cannot find module '../../../../src/v2/audio/TranscriptionWorker'`

- [ ] **Step 3: Create TranscriptionWorker.ts**

Create `src/v2/audio/TranscriptionWorker.ts`:

```typescript
import { pipeline } from '@huggingface/transformers'

type ASRPipeline = Awaited<ReturnType<typeof pipeline<'automatic-speech-recognition'>>>

let transcriber: ASRPipeline | null = null

;(self as any).onmessage = async (e: MessageEvent) => {
  const { type, speakerId, userName, audio } = e.data

  if (type === 'init') {
    try {
      transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny')
      self.postMessage({ type: 'ready' })
    } catch (err) {
      self.postMessage({ type: 'error', speakerId: '', error: String(err) })
    }
    return
  }

  if (type === 'transcribe') {
    try {
      const output = (await transcriber!(audio)) as { text: string }
      self.postMessage({
        type: 'result',
        speakerId,
        userName,
        text: output.text ?? '',
        timestamp: Date.now(),
      })
    } catch (err) {
      self.postMessage({ type: 'error', speakerId, error: String(err) })
    }
  }
}
```

- [ ] **Step 4: Add global @huggingface/transformers mock to jest.setup.js**

Open `jest.setup.js`. After the existing `jest.mock('@jitsi/rnnoise-wasm', ...)` block, append:

```javascript
// @huggingface/transformers uses ESM; mock globally to prevent import errors in jsdom.
// Tests that need specific behaviour (TranscriptionWorker.test.ts) override this mock locally.
jest.mock('@huggingface/transformers', () => ({
  pipeline: jest.fn(),
}))
```

- [ ] **Step 5: Run worker tests to verify they pass**

```bash
npx jest tests/unit/v2/audio/TranscriptionWorker.test.ts --no-coverage 2>&1 | tail -10
```

Expected: `3 passed`

- [ ] **Step 6: Run full suite to verify no regressions**

```bash
npx jest --no-coverage 2>&1 | tail -5
```

Expected: same pass/fail counts as before.

- [ ] **Step 7: Commit**

```bash
git add src/v2/audio/TranscriptionWorker.ts jest.setup.js tests/unit/v2/audio/TranscriptionWorker.test.ts
git commit -m "feat(transcription): TranscriptionWorker — whisper-tiny inference"
```

---

## Task 3: workerFactory + TranscriptionManager

**Files:**
- Create: `src/v2/audio/workerFactory.ts`
- Create: `src/v2/audio/TranscriptionManager.ts`
- Create: `tests/unit/v2/audio/TranscriptionManager.test.ts`

**Context:** `workerFactory.ts` isolates `import.meta.url` in a separate module so Jest can mock it with a factory (preventing Babel from running on that file). `TranscriptionManager` accepts a `Worker` instance in its constructor so tests can inject a mock worker.

- [ ] **Step 1: Write failing manager tests**

Create `tests/unit/v2/audio/TranscriptionManager.test.ts`:

```typescript
import { TranscriptionManager } from '../../../../src/v2/audio/TranscriptionManager'
import type { TranscriptSegment } from '../../../../src/v2/types'

// --- Mock AudioContext ---
const makeScriptNode = () => ({
  onaudioprocess: null as ((e: any) => void) | null,
  connect: jest.fn(),
  disconnect: jest.fn(),
})
const makeSource = () => ({ connect: jest.fn(), disconnect: jest.fn() })
const makeCtx = (scriptNode: ReturnType<typeof makeScriptNode>, source: ReturnType<typeof makeSource>) => ({
  createMediaStreamSource: jest.fn().mockReturnValue(source),
  createScriptProcessor: jest.fn().mockReturnValue(scriptNode),
  destination: {},
  close: jest.fn(),
})

let scriptNodeA: ReturnType<typeof makeScriptNode>
let sourceA: ReturnType<typeof makeSource>

beforeEach(() => {
  scriptNodeA = makeScriptNode()
  sourceA = makeSource()
  ;(global as any).AudioContext = jest.fn().mockImplementation(() =>
    makeCtx(scriptNodeA, sourceA)
  )
})

afterEach(() => {
  delete (global as any).AudioContext
})

// --- Mock Worker ---
const makeMockWorker = () => ({
  onmessage: null as ((e: MessageEvent) => void) | null,
  postMessage: jest.fn(),
  terminate: jest.fn(),
})

const makeMockStream = (hasAudio = true): MediaStream =>
  ({ getAudioTracks: () => (hasAudio ? [{}] : []) } as unknown as MediaStream)

// --- Tests ---

test('constructor sends init to worker', () => {
  const worker = makeMockWorker()
  new TranscriptionManager(worker as unknown as Worker, jest.fn(), jest.fn())
  expect(worker.postMessage).toHaveBeenCalledWith({ type: 'init' })
})

test('onReady callback is called when worker posts ready', () => {
  const onReady = jest.fn()
  const worker = makeMockWorker()
  new TranscriptionManager(worker as unknown as Worker, onReady, jest.fn())
  worker.onmessage!({ data: { type: 'ready' } } as MessageEvent)
  expect(onReady).toHaveBeenCalled()
})

test('onSegment callback is called with result from worker', () => {
  const onSegment = jest.fn()
  const worker = makeMockWorker()
  new TranscriptionManager(worker as unknown as Worker, jest.fn(), onSegment)
  const seg: TranscriptSegment = { speakerId: 's1', userName: 'Alice', text: 'hi', timestamp: 1 }
  worker.onmessage!({ data: { type: 'result', ...seg } } as MessageEvent)
  expect(onSegment).toHaveBeenCalledWith(seg)
})

test('addStream creates one ScriptProcessorNode per stream', () => {
  const worker = makeMockWorker()
  const manager = new TranscriptionManager(worker as unknown as Worker, jest.fn(), jest.fn())
  manager.addStream('s1', 'Alice', makeMockStream())
  expect((global as any).AudioContext).toHaveBeenCalledTimes(1)
})

test('addStream skips stream with no audio track', () => {
  const worker = makeMockWorker()
  const manager = new TranscriptionManager(worker as unknown as Worker, jest.fn(), jest.fn())
  manager.addStream('s1', 'Alice', makeMockStream(false))
  expect((global as any).AudioContext).not.toHaveBeenCalled()
})

test('addStream returns early when AudioContext is unavailable', () => {
  delete (global as any).AudioContext
  const worker = makeMockWorker()
  const manager = new TranscriptionManager(worker as unknown as Worker, jest.fn(), jest.fn())
  expect(() => manager.addStream('s1', 'Alice', makeMockStream())).not.toThrow()
})

test('buffer accumulates across onaudioprocess callbacks until 5s threshold then enqueues', () => {
  const worker = makeMockWorker()
  const manager = new TranscriptionManager(worker as unknown as Worker, jest.fn(), jest.fn())
  manager.addStream('s1', 'Alice', makeMockStream())

  const frame = new Float32Array(4096)
  // 58 * 4096 = 237,568 samples — below 240,000 threshold
  for (let i = 0; i < 58; i++) {
    scriptNodeA.onaudioprocess!({ inputBuffer: { getChannelData: () => frame } })
  }
  // Worker should only have received 'init', not 'transcribe'
  expect(worker.postMessage).toHaveBeenCalledTimes(1)
  expect(worker.postMessage).toHaveBeenCalledWith({ type: 'init' })

  // 59th callback: 59 * 4096 = 241,664 — crosses 240,000 threshold
  scriptNodeA.onaudioprocess!({ inputBuffer: { getChannelData: () => frame } })
  expect(worker.postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'transcribe', speakerId: 's1', userName: 'Alice' }),
    expect.any(Array)
  )
})

test('_downsample averages every 3 samples and returns 1/3 the length', () => {
  const worker = makeMockWorker()
  const manager = new TranscriptionManager(worker as unknown as Worker, jest.fn(), jest.fn())
  const input = new Float32Array([3, 6, 9, 12, 15, 18])
  const output = manager._downsample(input)
  expect(output.length).toBe(2)
  expect(output[0]).toBeCloseTo(6)
  expect(output[1]).toBeCloseTo(15)
})

test('transcribed audio length is 80,000 samples (240,000 downsampled 3:1)', () => {
  const worker = makeMockWorker()
  const manager = new TranscriptionManager(worker as unknown as Worker, jest.fn(), jest.fn())
  manager.addStream('s1', 'Alice', makeMockStream())

  const frame = new Float32Array(4096)
  for (let i = 0; i < 59; i++) {
    scriptNodeA.onaudioprocess!({ inputBuffer: { getChannelData: () => frame } })
  }

  const transcribeCall = worker.postMessage.mock.calls.find(
    (call: any[]) => call[0]?.type === 'transcribe'
  )
  expect(transcribeCall![0].audio.length).toBe(80000)
})

test('removeStream disconnects nodes for that speaker', () => {
  const worker = makeMockWorker()
  const manager = new TranscriptionManager(worker as unknown as Worker, jest.fn(), jest.fn())
  manager.addStream('s1', 'Alice', makeMockStream())
  manager.removeStream('s1')
  expect(sourceA.disconnect).toHaveBeenCalled()
  expect(scriptNodeA.disconnect).toHaveBeenCalled()
})

test('dispose disconnects all nodes and terminates worker', () => {
  const worker = makeMockWorker()
  const manager = new TranscriptionManager(worker as unknown as Worker, jest.fn(), jest.fn())
  manager.addStream('s1', 'Alice', makeMockStream())
  manager.dispose()
  expect(sourceA.disconnect).toHaveBeenCalled()
  expect(scriptNodeA.disconnect).toHaveBeenCalled()
  expect(worker.terminate).toHaveBeenCalled()
})

test('worker inference errors are logged and processing continues for next job', () => {
  const onSegment = jest.fn()
  const worker = makeMockWorker()
  const manager = new TranscriptionManager(worker as unknown as Worker, jest.fn(), onSegment, jest.fn())
  worker.onmessage!({ data: { type: 'error', speakerId: 's1', error: 'boom' } } as MessageEvent)
  // Should not throw and worker remains usable
  expect(onSegment).not.toHaveBeenCalled()
})

test('onInitError callback is called when worker posts init error (speakerId empty)', () => {
  const onInitError = jest.fn()
  const worker = makeMockWorker()
  new TranscriptionManager(worker as unknown as Worker, jest.fn(), jest.fn(), onInitError)
  worker.onmessage!({ data: { type: 'error', speakerId: '', error: 'model failed' } } as MessageEvent)
  expect(onInitError).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/v2/audio/TranscriptionManager.test.ts --no-coverage 2>&1 | tail -15
```

Expected: `Cannot find module '../../../../src/v2/audio/TranscriptionManager'`

- [ ] **Step 3: Create workerFactory.ts**

Create `src/v2/audio/workerFactory.ts`:

```typescript
export function createTranscriptionWorker(): Worker {
  return new Worker(new URL('./TranscriptionWorker.ts', import.meta.url), { type: 'module' })
}
```

- [ ] **Step 4: Create TranscriptionManager.ts**

Create `src/v2/audio/TranscriptionManager.ts`:

```typescript
import type { TranscriptSegment } from '../types'

interface SpeakerEntry {
  ctx: AudioContext
  source: MediaStreamAudioSourceNode
  scriptNode: ScriptProcessorNode
  userName: string
  buffer: Float32Array
}

const THRESHOLD = 48000 * 5  // 240,000 samples — 5 seconds at 48kHz
const DOWNSAMPLE_RATIO = 3   // 48kHz → 16kHz

export class TranscriptionManager {
  private speakers = new Map<string, SpeakerEntry>()
  private _queue: Array<{ speakerId: string; userName: string; audio: Float32Array }> = []
  private _processing = false

  constructor(
    private worker: Worker,
    private onReady: () => void,
    private onSegment: (segment: TranscriptSegment) => void,
    private onInitError?: () => void,
  ) {
    worker.onmessage = (e: MessageEvent) => {
      const { type, speakerId } = e.data
      if (type === 'ready') {
        onReady()
      } else if (type === 'result') {
        const { speakerId: sid, userName, text, timestamp } = e.data
        onSegment({ speakerId: sid, userName, text, timestamp })
        this._processing = false
        this._drain()
      } else if (type === 'error') {
        if (!speakerId) {
          // init error — model failed to load
          onInitError?.()
        } else {
          // inference error — skip segment, stay alive
          console.warn('[TranscriptionManager] inference error', e.data.error)
          this._processing = false
          this._drain()
        }
      }
    }
    worker.postMessage({ type: 'init' })
  }

  addStream(speakerId: string, userName: string, stream: MediaStream): void {
    if (typeof AudioContext === 'undefined') return
    if (stream.getAudioTracks().length === 0) return

    const ctx = new AudioContext({ sampleRate: 48000 })
    const source = ctx.createMediaStreamSource(stream)
    const scriptNode = ctx.createScriptProcessor(4096, 1, 1)
    const entry: SpeakerEntry = { ctx, source, scriptNode, userName, buffer: new Float32Array(0) }
    this.speakers.set(speakerId, entry)

    scriptNode.onaudioprocess = (e: AudioProcessingEvent) => {
      const input = e.inputBuffer.getChannelData(0)
      const combined = new Float32Array(entry.buffer.length + input.length)
      combined.set(entry.buffer)
      combined.set(input, entry.buffer.length)
      entry.buffer = combined

      if (entry.buffer.length >= THRESHOLD) {
        const chunk = entry.buffer.slice(0, THRESHOLD)
        const downsampled = this._downsample(chunk)
        this._enqueue(speakerId, userName, downsampled)
        entry.buffer = entry.buffer.slice(THRESHOLD)
      }
    }

    source.connect(scriptNode)
    scriptNode.connect(ctx.destination)
  }

  removeStream(speakerId: string): void {
    const entry = this.speakers.get(speakerId)
    if (!entry) return
    entry.source.disconnect()
    entry.scriptNode.disconnect()
    entry.ctx.close()
    this.speakers.delete(speakerId)
  }

  dispose(): void {
    for (const id of [...this.speakers.keys()]) {
      this.removeStream(id)
    }
    this.worker.terminate()
    this._queue = []
    this._processing = false
  }

  _downsample(input: Float32Array): Float32Array {
    const outputLength = Math.floor(input.length / DOWNSAMPLE_RATIO)
    const output = new Float32Array(outputLength)
    for (let i = 0; i < outputLength; i++) {
      const base = i * DOWNSAMPLE_RATIO
      output[i] = (input[base] + input[base + 1] + input[base + 2]) / DOWNSAMPLE_RATIO
    }
    return output
  }

  private _enqueue(speakerId: string, userName: string, audio: Float32Array): void {
    this._queue.push({ speakerId, userName, audio })
    this._drain()
  }

  private _drain(): void {
    if (this._processing || this._queue.length === 0) return
    const job = this._queue.shift()!
    this._processing = true
    this.worker.postMessage({ type: 'transcribe', ...job }, [job.audio.buffer])
  }
}
```

- [ ] **Step 5: Run manager tests to verify they pass**

```bash
npx jest tests/unit/v2/audio/TranscriptionManager.test.ts --no-coverage 2>&1 | tail -10
```

Expected: `11 passed`

- [ ] **Step 6: Run full suite to verify no regressions**

```bash
npx jest --no-coverage 2>&1 | tail -5
```

Expected: same pass/fail counts as before.

- [ ] **Step 7: Commit**

```bash
git add src/v2/audio/workerFactory.ts src/v2/audio/TranscriptionManager.ts tests/unit/v2/audio/TranscriptionManager.test.ts
git commit -m "feat(transcription): TranscriptionManager — per-stream audio processing and job queue"
```

---

## Task 4: useUIStore + ControlBar CC button

**Files:**
- Modify: `src/v2/store/useUIStore.ts`
- Modify: `src/v2/call/ControlBar.tsx`
- Modify: `tests/unit/v2/stores/useUIStore.test.ts`
- Modify: `tests/unit/v2/call/ControlBar.test.tsx`

- [ ] **Step 1: Write failing tests for useUIStore**

Open `tests/unit/v2/stores/useUIStore.test.ts`. Add these imports at the top:

```typescript
import { useTranscriptionStore } from '../../../../src/v2/store/useTranscriptionStore'
```

Update the existing `beforeEach` to also reset transcription store and add `isCaptionsOpen`:

```typescript
beforeEach(() => {
  useUIStore.setState({
    isChatOpen: false,
    isParticipantsOpen: false,
    isQAOpen: false,
    isAIOpen: false,
    isCaptionsOpen: false,
    activeModal: null,
    toasts: [],
    layout: 'spotlight',
  })
  useTranscriptionStore.setState({ isEnabled: false, isLoading: false, segments: [] })
})
```

Append these new tests at the end of the file:

```typescript
test('toggleCaptions flips isCaptionsOpen', () => {
  useUIStore.getState().toggleCaptions()
  expect(useUIStore.getState().isCaptionsOpen).toBe(true)
  useUIStore.getState().toggleCaptions()
  expect(useUIStore.getState().isCaptionsOpen).toBe(false)
})

test('toggleCaptions enables transcription store when opening', () => {
  useUIStore.getState().toggleCaptions()
  expect(useTranscriptionStore.getState().isEnabled).toBe(true)
})

test('toggleCaptions disables transcription store when closing', () => {
  useUIStore.setState({ isCaptionsOpen: true })
  useTranscriptionStore.setState({ isEnabled: true })
  useUIStore.getState().toggleCaptions()
  expect(useTranscriptionStore.getState().isEnabled).toBe(false)
})
```

- [ ] **Step 2: Write failing tests for ControlBar CC button**

Open `tests/unit/v2/call/ControlBar.test.tsx`. Add this import at the top:

```typescript
import { useTranscriptionStore } from '../../../../src/v2/store/useTranscriptionStore'
```

Update the existing `beforeEach` to also reset `isCaptionsOpen` and `isLoading`:

```typescript
beforeEach(() => {
  useCallStore.setState({ isMuted: false, isCamOff: false, isNoiseSuppressed: true })
  useUIStore.setState({
    isChatOpen: false,
    isParticipantsOpen: false,
    isQAOpen: false,
    isAIOpen: false,
    isCaptionsOpen: false,
  })
  useTranscriptionStore.setState({ isLoading: false, isEnabled: false, segments: [] })
  jest.useFakeTimers()
})
```

Append these new tests at the end of the file:

```typescript
test('CC button renders in control bar', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-cc')).toBeInTheDocument()
})

test('CC button shows "CC" when captions are off', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-cc')).toHaveTextContent('CC')
})

test('CC button shows "CC ✓" when captions are on', () => {
  useUIStore.setState({ isCaptionsOpen: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-cc')).toHaveTextContent('CC ✓')
})

test('CC button shows "CC …" and is disabled when model is loading', () => {
  useTranscriptionStore.setState({ isLoading: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-cc')).toHaveTextContent('CC …')
  expect(screen.getByTestId('btn-cc')).toBeDisabled()
})

test('clicking CC button calls toggleCaptions', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-cc'))
  expect(useUIStore.getState().isCaptionsOpen).toBe(true)
})

test('CC button renders with primary variant when captions are open', () => {
  useUIStore.setState({ isCaptionsOpen: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-cc').className).toMatch(/bg-\[var\(--text-primary\)\]/)
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx jest tests/unit/v2/stores/useUIStore.test.ts tests/unit/v2/call/ControlBar.test.tsx --no-coverage 2>&1 | tail -20
```

Expected: failures because `isCaptionsOpen` and `toggleCaptions` don't exist yet.

- [ ] **Step 4: Update useUIStore.ts**

Open `src/v2/store/useUIStore.ts`. Replace the entire file with:

```typescript
import { create } from 'zustand'
import type { Toast } from '../types'
import { useTranscriptionStore } from './useTranscriptionStore'

interface UIStore {
  isChatOpen: boolean
  isParticipantsOpen: boolean
  isQAOpen: boolean
  isAIOpen: boolean
  isCaptionsOpen: boolean
  activeModal: string | null
  toasts: Toast[]
  layout: 'spotlight' | 'grid'
  toggleChat: () => void
  toggleParticipants: () => void
  toggleQA: () => void
  toggleAI: () => void
  toggleCaptions: () => void
  setActiveModal: (modal: string | null) => void
  addToast: (toast: Toast) => void
  removeToast: (id: string) => void
  setLayout: (layout: 'spotlight' | 'grid') => void
}

export const useUIStore = create<UIStore>((set) => ({
  isChatOpen: false,
  isParticipantsOpen: false,
  isQAOpen: false,
  isAIOpen: false,
  isCaptionsOpen: false,
  activeModal: null,
  toasts: [],
  layout: 'spotlight',

  // Panels are mutually exclusive: opening any one closes all others.
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen, isParticipantsOpen: false, isQAOpen: false, isAIOpen: false })),
  toggleParticipants: () => set((s) => ({ isParticipantsOpen: !s.isParticipantsOpen, isChatOpen: false, isQAOpen: false, isAIOpen: false })),
  toggleQA: () => set((s) => ({ isQAOpen: !s.isQAOpen, isChatOpen: false, isParticipantsOpen: false, isAIOpen: false })),
  toggleAI: () => set((s) => ({ isAIOpen: !s.isAIOpen, isChatOpen: false, isParticipantsOpen: false, isQAOpen: false })),
  toggleCaptions: () => set((s) => {
    const next = !s.isCaptionsOpen
    if (next) {
      useTranscriptionStore.getState().enable()
    } else {
      useTranscriptionStore.getState().disable()
    }
    return { isCaptionsOpen: next }
  }),

  setActiveModal: (modal) => set({ activeModal: modal }),
  addToast: (toast) => set((s) => ({ toasts: [...s.toasts, toast] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setLayout: (layout) => set({ layout }),
}))
```

- [ ] **Step 5: Update ControlBar.tsx**

Open `src/v2/call/ControlBar.tsx`. Add this import at the top (after the existing imports):

```typescript
import { useTranscriptionStore } from '../store/useTranscriptionStore'
```

Add these selectors inside the `ControlBar` function body, after the existing `toggleNoiseSuppression` lines:

```typescript
const isCaptionsOpen = useUIStore((s) => s.isCaptionsOpen)
const toggleCaptions = useUIStore((s) => s.toggleCaptions)
const isCaptionsLoading = useTranscriptionStore((s) => s.isLoading)
```

Add the CC button in the JSX, between the noise button and the Leave button:

```tsx
<Button
  data-testid="btn-cc"
  variant={isCaptionsOpen ? 'primary' : 'ghost'}
  onClick={toggleCaptions}
  disabled={isCaptionsLoading}
  aria-label="Captions"
>
  {isCaptionsLoading ? 'CC …' : isCaptionsOpen ? 'CC ✓' : 'CC'}
</Button>
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx jest tests/unit/v2/stores/useUIStore.test.ts tests/unit/v2/call/ControlBar.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 7: Run full suite to verify no regressions**

```bash
npx jest --no-coverage 2>&1 | tail -5
```

Expected: same pass/fail counts as before.

- [ ] **Step 8: Commit**

```bash
git add src/v2/store/useUIStore.ts src/v2/call/ControlBar.tsx tests/unit/v2/stores/useUIStore.test.ts tests/unit/v2/call/ControlBar.test.tsx
git commit -m "feat(transcription): isCaptionsOpen + CC button in ControlBar"
```

---

## Task 5: CaptionOverlay

**Files:**
- Create: `src/v2/components/ai/CaptionOverlay.tsx`
- Create: `tests/unit/v2/components/ai/CaptionOverlay.test.tsx`

- [ ] **Step 1: Write failing overlay tests**

Create `tests/unit/v2/components/ai/CaptionOverlay.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { CaptionOverlay } from '../../../../../src/v2/components/ai/CaptionOverlay'
import { useUIStore } from '../../../../../src/v2/store/useUIStore'
import { useTranscriptionStore } from '../../../../../src/v2/store/useTranscriptionStore'
import type { TranscriptSegment } from '../../../../../src/v2/types'

beforeEach(() => {
  useUIStore.setState({ isCaptionsOpen: false })
  useTranscriptionStore.setState({ isEnabled: false, isLoading: false, segments: [] })
})

test('returns null when isCaptionsOpen is false', () => {
  render(<CaptionOverlay />)
  expect(screen.queryByTestId('caption-overlay')).not.toBeInTheDocument()
})

test('shows loading text when isCaptionsOpen=true and isLoading=true', () => {
  useUIStore.setState({ isCaptionsOpen: true })
  useTranscriptionStore.setState({ isLoading: true })
  render(<CaptionOverlay />)
  expect(screen.getByTestId('caption-overlay')).toHaveTextContent('Loading captions model…')
})

test('does not show loading text when isLoading=false', () => {
  useUIStore.setState({ isCaptionsOpen: true })
  useTranscriptionStore.setState({ isLoading: false, segments: [] })
  render(<CaptionOverlay />)
  expect(screen.queryByText(/Loading captions model/)).not.toBeInTheDocument()
})

test('renders [userName]: text format for each segment', () => {
  useUIStore.setState({ isCaptionsOpen: true })
  useTranscriptionStore.setState({
    segments: [{ speakerId: 's1', userName: 'Alice', text: 'Hello world', timestamp: 1 }],
  })
  render(<CaptionOverlay />)
  expect(screen.getByText('[Alice]: Hello world')).toBeInTheDocument()
})

test('renders only the last 3 segments when more than 3 exist', () => {
  const segments: TranscriptSegment[] = [
    { speakerId: 's1', userName: 'Alice', text: 'First', timestamp: 1 },
    { speakerId: 's2', userName: 'Bob', text: 'Second', timestamp: 2 },
    { speakerId: 's1', userName: 'Alice', text: 'Third', timestamp: 3 },
    { speakerId: 's2', userName: 'Bob', text: 'Fourth', timestamp: 4 },
  ]
  useUIStore.setState({ isCaptionsOpen: true })
  useTranscriptionStore.setState({ segments })
  render(<CaptionOverlay />)
  expect(screen.queryByText('[Alice]: First')).not.toBeInTheDocument()
  expect(screen.getByText('[Bob]: Second')).toBeInTheDocument()
  expect(screen.getByText('[Alice]: Third')).toBeInTheDocument()
  expect(screen.getByText('[Bob]: Fourth')).toBeInTheDocument()
})

test('renders all segments when 3 or fewer exist', () => {
  const segments: TranscriptSegment[] = [
    { speakerId: 's1', userName: 'Alice', text: 'Only one', timestamp: 1 },
  ]
  useUIStore.setState({ isCaptionsOpen: true })
  useTranscriptionStore.setState({ segments })
  render(<CaptionOverlay />)
  expect(screen.getByText('[Alice]: Only one')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/v2/components/ai/CaptionOverlay.test.tsx --no-coverage 2>&1 | tail -15
```

Expected: `Cannot find module '../../../../src/v2/components/ai/CaptionOverlay'`

- [ ] **Step 3: Create CaptionOverlay.tsx**

Create `src/v2/components/ai/CaptionOverlay.tsx`:

```tsx
import { useUIStore } from '../../store/useUIStore'
import { useTranscriptionStore } from '../../store/useTranscriptionStore'

export function CaptionOverlay() {
  const isCaptionsOpen = useUIStore((s) => s.isCaptionsOpen)
  const isLoading = useTranscriptionStore((s) => s.isLoading)
  const segments = useTranscriptionStore((s) => s.segments)

  if (!isCaptionsOpen) return null

  if (isLoading) {
    return (
      <div
        data-testid="caption-overlay"
        className="absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none"
      >
        <div className="bg-black/60 text-white text-sm px-4 py-2 rounded-lg">
          Loading captions model…
        </div>
      </div>
    )
  }

  const last3 = segments.slice(-3)

  return (
    <div
      data-testid="caption-overlay"
      className="absolute bottom-20 left-0 right-0 px-4 flex flex-col items-center gap-1 pointer-events-none"
    >
      {last3.map((seg, i) => (
        <div
          key={`${seg.speakerId}-${seg.timestamp}-${i}`}
          className="bg-black/60 text-white text-sm px-4 py-2 rounded-lg max-w-2xl w-full text-center"
        >
          {`[${seg.userName}]: ${seg.text}`}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run overlay tests to verify they pass**

```bash
npx jest tests/unit/v2/components/ai/CaptionOverlay.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: `6 passed`

- [ ] **Step 5: Run full suite to verify no regressions**

```bash
npx jest --no-coverage 2>&1 | tail -5
```

Expected: same pass/fail counts as before.

- [ ] **Step 6: Commit**

```bash
git add src/v2/components/ai/CaptionOverlay.tsx tests/unit/v2/components/ai/CaptionOverlay.test.tsx
git commit -m "feat(transcription): CaptionOverlay — last 3 segments above ControlBar"
```

---

## Task 6: TranscriptionController + RoomV2 wiring

**Files:**
- Create: `src/v2/call/TranscriptionController.tsx`
- Modify: `src/v2/pages/RoomV2.tsx`
- Create: `tests/unit/v2/call/TranscriptionController.test.tsx`

- [ ] **Step 1: Write failing controller tests**

Create `tests/unit/v2/call/TranscriptionController.test.tsx`:

```typescript
import { render, act } from '@testing-library/react'
import { TranscriptionController } from '../../../../src/v2/call/TranscriptionController'
import { useTranscriptionStore } from '../../../../src/v2/store/useTranscriptionStore'
import { useCallStore } from '../../../../src/v2/store/useCallStore'
import { usePeerStore } from '../../../../src/v2/store/usePeerStore'
import type { PeerRecord } from '../../../../src/v2/types'

jest.mock('../../../../src/v2/audio/TranscriptionManager')
jest.mock('../../../../src/v2/audio/workerFactory', () => ({
  createTranscriptionWorker: jest.fn().mockReturnValue({} as Worker),
}))

import { TranscriptionManager } from '../../../../src/v2/audio/TranscriptionManager'
const MockTranscriptionManager = TranscriptionManager as jest.MockedClass<typeof TranscriptionManager>

const mockManager = {
  addStream: jest.fn(),
  removeStream: jest.fn(),
  dispose: jest.fn(),
}

const makePeer = (id: string, name: string, stream: MediaStream | null = null): PeerRecord => ({
  id, name, role: 'guest', stream, isMuted: false, isCamOff: false,
  videoEnabled: true, isScreenSharing: false, connectionState: 'connected',
  networkQuality: 'good', isSpeaking: false, isPinned: false,
  hasRaisedHand: false, handRaisedAt: null, reaction: null, isAway: false, isTyping: false,
})

const makeMockStream = (): MediaStream =>
  ({ getAudioTracks: () => [{}] } as unknown as MediaStream)

beforeEach(() => {
  MockTranscriptionManager.mockImplementation(() => mockManager as any)
  useTranscriptionStore.setState({ isEnabled: false, isLoading: false, segments: [] })
  useCallStore.setState({ localStream: null, userName: '' })
  usePeerStore.setState({ peers: new Map() })
  jest.clearAllMocks()
})

test('renders null (renderless component)', () => {
  const { container } = render(<TranscriptionController />)
  expect(container).toBeEmptyDOMElement()
})

test('creates TranscriptionManager when isEnabled becomes true', async () => {
  render(<TranscriptionController />)
  await act(async () => {
    useTranscriptionStore.setState({ isEnabled: true })
  })
  expect(MockTranscriptionManager).toHaveBeenCalled()
})

test('calls setLoading(true) when manager is created', async () => {
  render(<TranscriptionController />)
  await act(async () => {
    useTranscriptionStore.setState({ isEnabled: true })
  })
  expect(useTranscriptionStore.getState().isLoading).toBe(true)
})

test('sets isLoading=false and shows toast when model init fails', async () => {
  render(<TranscriptionController />)
  await act(async () => {
    useTranscriptionStore.setState({ isEnabled: true, isLoading: true })
  })
  // Simulate init error by calling the onInitError arg passed to TranscriptionManager
  const [, , , onInitError] = MockTranscriptionManager.mock.calls[0]
  act(() => { onInitError?.() })
  expect(useTranscriptionStore.getState().isLoading).toBe(false)
})

test('calls dispose when isEnabled becomes false', async () => {
  useTranscriptionStore.setState({ isEnabled: true })
  render(<TranscriptionController />)
  await act(async () => {
    useTranscriptionStore.setState({ isEnabled: false })
  })
  expect(mockManager.dispose).toHaveBeenCalled()
})

test('calls dispose on unmount', () => {
  useTranscriptionStore.setState({ isEnabled: true })
  const { unmount } = render(<TranscriptionController />)
  unmount()
  expect(mockManager.dispose).toHaveBeenCalled()
})

test('calls addStream for local stream when enabled', async () => {
  const stream = makeMockStream()
  useCallStore.setState({ localStream: stream, userName: 'Me' })
  render(<TranscriptionController />)
  await act(async () => {
    useTranscriptionStore.setState({ isEnabled: true })
  })
  expect(mockManager.addStream).toHaveBeenCalledWith('local', 'Me', stream)
})

test('calls addStream when a peer joins while enabled', async () => {
  useTranscriptionStore.setState({ isEnabled: true })
  render(<TranscriptionController />)
  const stream = makeMockStream()
  await act(async () => {
    usePeerStore.setState({ peers: new Map([['p1', makePeer('p1', 'Alice', stream)]]) })
  })
  expect(mockManager.addStream).toHaveBeenCalledWith('p1', 'Alice', stream)
})

test('does not addStream for peer with no stream', async () => {
  useTranscriptionStore.setState({ isEnabled: true })
  render(<TranscriptionController />)
  await act(async () => {
    usePeerStore.setState({ peers: new Map([['p1', makePeer('p1', 'Alice', null)]]) })
  })
  expect(mockManager.addStream).not.toHaveBeenCalledWith('p1', expect.anything(), expect.anything())
})

test('calls removeStream when a peer leaves', async () => {
  const stream = makeMockStream()
  useTranscriptionStore.setState({ isEnabled: true })
  usePeerStore.setState({ peers: new Map([['p1', makePeer('p1', 'Alice', stream)]]) })
  render(<TranscriptionController />)
  await act(async () => {
    usePeerStore.setState({ peers: new Map() })
  })
  expect(mockManager.removeStream).toHaveBeenCalledWith('p1')
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/v2/call/TranscriptionController.test.tsx --no-coverage 2>&1 | tail -15
```

Expected: `Cannot find module '../../../../src/v2/call/TranscriptionController'`

- [ ] **Step 3: Create TranscriptionController.tsx**

Create `src/v2/call/TranscriptionController.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { useTranscriptionStore } from '../store/useTranscriptionStore'
import { useUIStore } from '../store/useUIStore'
import { useCallStore } from '../store/useCallStore'
import { usePeerStore } from '../store/usePeerStore'
import { TranscriptionManager } from '../audio/TranscriptionManager'
import { createTranscriptionWorker } from '../audio/workerFactory'

export function TranscriptionController() {
  const isEnabled = useTranscriptionStore((s) => s.isEnabled)
  const setLoading = useTranscriptionStore((s) => s.setLoading)
  const addSegment = useTranscriptionStore((s) => s.addSegment)
  const addToast = useUIStore((s) => s.addToast)
  const localStream = useCallStore((s) => s.localStream)
  const localUserName = useCallStore((s) => s.userName)
  const peers = usePeerStore((s) => s.peers)
  const managerRef = useRef<TranscriptionManager | null>(null)
  const attachedPeerIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!isEnabled) {
      managerRef.current?.dispose()
      managerRef.current = null
      attachedPeerIdsRef.current = new Set()
      return
    }
    setLoading(true)
    const worker = createTranscriptionWorker()
    const manager = new TranscriptionManager(
      worker,
      () => setLoading(false),
      addSegment,
      () => {
        setLoading(false)
        addToast({ id: `cc-error-${Date.now()}`, message: 'Captions unavailable — model failed to load', variant: 'warn' })
      },
    )
    managerRef.current = manager

    return () => {
      manager.dispose()
      managerRef.current = null
      attachedPeerIdsRef.current = new Set()
    }
  }, [isEnabled, setLoading, addSegment])

  useEffect(() => {
    const manager = managerRef.current
    if (!manager || !localStream) return
    manager.addStream('local', localUserName || 'You', localStream)
    return () => { manager.removeStream('local') }
  }, [isEnabled, localStream, localUserName])

  useEffect(() => {
    const manager = managerRef.current
    if (!manager) return

    for (const [id, peer] of peers) {
      if (peer.stream && !attachedPeerIdsRef.current.has(id)) {
        manager.addStream(id, peer.name, peer.stream)
        attachedPeerIdsRef.current.add(id)
      }
    }

    for (const id of [...attachedPeerIdsRef.current]) {
      if (!peers.has(id)) {
        manager.removeStream(id)
        attachedPeerIdsRef.current.delete(id)
      }
    }
  }, [peers, isEnabled])

  return null
}
```

- [ ] **Step 4: Run controller tests to verify they pass**

```bash
npx jest tests/unit/v2/call/TranscriptionController.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: `9 passed`

- [ ] **Step 5: Update RoomV2.tsx**

Open `src/v2/pages/RoomV2.tsx`. Add these two imports after the existing imports:

```typescript
import { TranscriptionController } from '../call/TranscriptionController'
import { CaptionOverlay } from '../components/ai/CaptionOverlay'
```

Mount `<TranscriptionController />` alongside `<MediaController />`:

```tsx
<MediaController />
<TranscriptionController />
<PeerManager ref={peerManagerRef} roomId={roomId ?? ''} />
```

Add `<CaptionOverlay />` inside the video column div, directly above `<ControlBar>`:

```tsx
<div className="flex flex-col flex-1 min-w-0 relative">
  <SpotlightView />
  <ThumbnailStrip />
  <PollBanner onVotePoll={(id, idx) => peerManagerRef.current?.votePoll(id, idx)} />
  <CaptionOverlay />
  <ControlBar
    onEndCall={() => { resetCall(); navigate('/') }}
    onSendReaction={(emoji) => peerManagerRef.current?.sendReaction(emoji)}
  />
</div>
```

- [ ] **Step 6: Run full suite**

```bash
npx jest --no-coverage 2>&1 | tail -10
```

Expected: new tests pass, same 6 pre-existing failures, total count increases by the new tests added in this plan.

- [ ] **Step 7: Commit**

```bash
git add src/v2/call/TranscriptionController.tsx src/v2/pages/RoomV2.tsx tests/unit/v2/call/TranscriptionController.test.tsx
git commit -m "feat(transcription): TranscriptionController + RoomV2 wiring — AI captions complete"
```
