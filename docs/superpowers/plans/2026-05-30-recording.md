# Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add host-only client-side meeting recording that composites all participant video/audio into a single WebM download with room-wide recording notifications.

**Architecture:** `RecordingManager` (pure TS) composites video onto a hidden canvas at 15fps and mixes audio via Web Audio API, feeding both into `MediaRecorder`. `RecordingController` (renderless React, same pattern as `TranscriptionController`) owns the manager lifecycle by watching `recordingState` in `useSessionStore`. The host socket broadcasts `recording-started`/`recording-stopped`; `PeerManager` relays them to the store for non-host participants.

**Tech Stack:** `MediaRecorder` API, `HTMLCanvasElement.captureStream`, Web Audio API (`AudioContext`, `MediaStreamAudioDestinationNode`), Zustand, Socket.io, React, Jest/jsdom

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/v2/recording/RecordingManager.ts` | Canvas composite + audio mix + MediaRecorder lifecycle |
| Create | `src/v2/call/RecordingController.tsx` | Renderless React controller wiring store → manager |
| Create | `src/v2/components/RecordingIndicator.tsx` | Red dot + elapsed timer UI, visible to all participants |
| Create | `tests/unit/v2/recording/RecordingManager.test.ts` | Unit tests for RecordingManager |
| Create | `tests/unit/v2/call/RecordingController.test.tsx` | Integration tests for RecordingController |
| Create | `tests/unit/v2/components/RecordingIndicator.test.tsx` | Unit tests for RecordingIndicator |
| Modify | `src/v2/store/useCallStore.ts` | Add `isHost: boolean` + `setIsHost()` |
| Modify | `src/v2/call/PeerManager.tsx` | Add `broadcastRecordingStarted/Stopped` to handle; handle `you-are-host` + recording socket events |
| Modify | `src/v2/call/ControlBar.tsx` | Add Record/Stop button (host-only) |
| Modify | `src/v2/pages/RoomV2.tsx` | Mount `RecordingController` + `RecordingIndicator` |
| Modify | `signaling-server.js` | Emit `you-are-host`; broadcast `recording-started`/`recording-stopped` |
| Modify | `tests/unit/v2/stores/useCallStore.test.ts` | Add `isHost` tests |

---

## Task 1: Add `isHost` to `useCallStore`

**Files:**
- Modify: `src/v2/store/useCallStore.ts`
- Modify: `tests/unit/v2/stores/useCallStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `tests/unit/v2/stores/useCallStore.test.ts`:

```typescript
test('isHost defaults to false', () => {
  expect(useCallStore.getState().isHost).toBe(false)
})

test('setIsHost(true) sets isHost to true', () => {
  useCallStore.getState().setIsHost(true)
  expect(useCallStore.getState().isHost).toBe(true)
})

test('setIsHost(false) clears isHost', () => {
  useCallStore.setState({ isHost: true })
  useCallStore.getState().setIsHost(false)
  expect(useCallStore.getState().isHost).toBe(false)
})

test('reset does not clear isHost', () => {
  useCallStore.setState({ isHost: true })
  useCallStore.getState().reset()
  expect(useCallStore.getState().isHost).toBe(true)
})
```

Also update the `beforeEach` block to include `isHost: false`:

```typescript
beforeEach(() => {
  useCallStore.setState({
    localStream: null,
    isMuted: false,
    isCamOff: false,
    isNoiseSuppressed: true,
    userName: '',
    screenSharePeerId: null,
    mediaError: null,
    isHost: false,
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/unit/v2/stores/useCallStore.test.ts --no-coverage
```

Expected: FAIL — `isHost` and `setIsHost` do not exist yet.

- [ ] **Step 3: Implement `isHost` in `useCallStore`**

Replace the full content of `src/v2/store/useCallStore.ts`:

```typescript
import { create } from 'zustand'

interface CallStore {
  localStream: MediaStream | null
  isMuted: boolean
  isCamOff: boolean
  isNoiseSuppressed: boolean
  isHost: boolean
  userName: string
  screenSharePeerId: string | null
  mediaError: string | null
  setLocalStream: (stream: MediaStream | null) => void
  setMuted: (value: boolean) => void
  setCamOff: (value: boolean) => void
  toggleNoiseSuppression: () => void
  setIsHost: (value: boolean) => void
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
  isHost: false,
  userName: '',
  screenSharePeerId: null,
  mediaError: null,
  setLocalStream: (stream) => set({ localStream: stream }),
  setMuted: (value) => set({ isMuted: value }),
  setCamOff: (value) => set({ isCamOff: value }),
  toggleNoiseSuppression: () => set((s) => ({ isNoiseSuppressed: !s.isNoiseSuppressed })),
  setIsHost: (value) => set({ isHost: value }),
  setUserName: (name) => set({ userName: name }),
  setScreenSharePeerId: (id) => set({ screenSharePeerId: id }),
  setMediaError: (err) => set({ mediaError: err }),
  reset: () => set({ isMuted: false, isCamOff: false, mediaError: null, isNoiseSuppressed: true }),
}))
```

- [ ] **Step 4: Run tests — all pass**

```bash
npx jest tests/unit/v2/stores/useCallStore.test.ts --no-coverage
```

Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add src/v2/store/useCallStore.ts tests/unit/v2/stores/useCallStore.test.ts
git commit -m "feat(recording): add isHost to useCallStore"
```

---

## Task 2: Signaling server — host detection + recording broadcast

**Files:**
- Modify: `signaling-server.js`

No automated tests for the signaling server. Changes verified by manual smoke test in Task 10.

- [ ] **Step 1: Emit `you-are-host` to the first user in an empty room**

In `signaling-server.js`, find the block starting with `socket.emit('all-users', otherUsers)` (around line 1008). Add the host check immediately before it:

```javascript
      // Assign host role to the first user who enters an empty room
      if (otherUsers.length === 0) {
        socket.emit('you-are-host')
      }

      socket.emit('all-users', otherUsers);
```

- [ ] **Step 2: Add `recording-started` broadcast handler**

Find the section with other socket event handlers (after the `join-room` handler, near other `socket.on` calls). Add:

```javascript
  socket.on('recording-started', () => {
    try {
      const roomId = users[socket.id]?.roomId
      if (roomId) {
        socket.broadcast.to(roomId).emit('recording-started')
      }
    } catch (error) {
      console.error('Error in recording-started:', error)
    }
  })

  socket.on('recording-stopped', () => {
    try {
      const roomId = users[socket.id]?.roomId
      if (roomId) {
        socket.broadcast.to(roomId).emit('recording-stopped')
      }
    } catch (error) {
      console.error('Error in recording-stopped:', error)
    }
  })
```

- [ ] **Step 3: Verify server starts without errors**

```bash
node signaling-server.js &
sleep 2
kill %1
```

Expected: Server starts and exits cleanly (no syntax errors).

- [ ] **Step 4: Commit**

```bash
git add signaling-server.js
git commit -m "feat(recording): server emits you-are-host and broadcasts recording events"
```

---

## Task 3: `PeerManager` — host detection + broadcast methods

**Files:**
- Modify: `src/v2/call/PeerManager.tsx`

- [ ] **Step 1: Add `broadcastRecordingStarted` and `broadcastRecordingStopped` to `PeerManagerHandle`**

In `src/v2/call/PeerManager.tsx`, replace the `PeerManagerHandle` interface (lines 18–26):

```typescript
export interface PeerManagerHandle {
  sendMessage: (text: string) => void
  sendReaction: (emoji: string) => void
  votePoll: (pollId: string, optionIndex: number) => void
  submitQuestion: (text: string) => void
  voteQuestion: (questionId: string) => void
  answerQuestion: (questionId: string, answer: string) => void
  getPeerConnections: () => Map<string, RTCPeerConnection>
  broadcastRecordingStarted: () => void
  broadcastRecordingStopped: () => void
}
```

- [ ] **Step 2: Add `setIsHost` to the store subscriptions**

In the store reads block (around lines 49–58), add:

```typescript
  const setIsHost = useCallStore((s) => s.setIsHost)
```

Also add the session store reads needed for recording toast:

```typescript
  const setRecordingState = useSessionStore((s) => s.setRecordingState)
  const addToast = useUIStore((s) => s.addToast)
```

Add the `useUIStore` import at the top of the file:

```typescript
import { useUIStore } from '../store/useUIStore'
```

- [ ] **Step 3: Implement the two new `useImperativeHandle` methods**

Inside `useImperativeHandle(ref, () => ({ ... }), [])`, add after `getPeerConnections`:

```typescript
    broadcastRecordingStarted: () => {
      socketRef.current?.emit('recording-started')
    },
    broadcastRecordingStopped: () => {
      socketRef.current?.emit('recording-stopped')
    },
```

- [ ] **Step 4: Add socket event handlers for `you-are-host`, `recording-started`, `recording-stopped`**

Inside the main `useEffect` (the one containing `socket.on('connect', ...)`, after the `socket.on('error', ...)` handler), add:

```typescript
    socket.on('you-are-host', () => {
      setIsHost(true)
    })

    socket.on('recording-started', () => {
      setRecordingState('recording')
      addToast({ id: `rec-start-${Date.now()}`, message: 'Recording has started', variant: 'info' })
    })

    socket.on('recording-stopped', () => {
      setRecordingState('idle')
      addToast({ id: `rec-stop-${Date.now()}`, message: 'Recording ended', variant: 'info' })
    })
```

- [ ] **Step 5: Add cleanup in the `return () => { ... }` block**

Add these three lines to the cleanup return function (after `socket.off('turn-credentials-error')`):

```typescript
      socketRef.current?.off('you-are-host')
      socketRef.current?.off('recording-started')
      socketRef.current?.off('recording-stopped')
```

- [ ] **Step 6: Update the `useEffect` dependency array**

The dependency array on line 310 needs the new actions. Replace it with:

```typescript
  }, [roomId, userName, setPeer, removePeer, patchPeer, addMessage, setActivePoll, addQuestion, updateQuestion, setQuestionsHistory, setIsHost, setRecordingState, addToast])
```

- [ ] **Step 7: Run existing PeerManager tests**

```bash
npx jest tests/unit/v2/call/PeerManager.test.tsx --no-coverage
```

Expected: PASS (no regressions).

- [ ] **Step 8: Commit**

```bash
git add src/v2/call/PeerManager.tsx
git commit -m "feat(recording): PeerManager handles you-are-host and recording broadcast"
```

---

## Task 4: `calcGrid` — pure function + unit tests

**Files:**
- Create: `src/v2/recording/RecordingManager.ts` (export `calcGrid` only in this task)
- Create: `tests/unit/v2/recording/RecordingManager.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/v2/recording/RecordingManager.test.ts`:

```typescript
import { calcGrid } from '../../../../src/v2/recording/RecordingManager'

describe('calcGrid', () => {
  test('1 stream: single full-size cell', () => {
    const g = calcGrid(1, 1280, 720)
    expect(g.cols).toBe(1)
    expect(g.rows).toBe(1)
    expect(g.cellW).toBe(1280)
    expect(g.cellH).toBe(720)
  })

  test('2 streams: 2 columns, 1 row', () => {
    const g = calcGrid(2, 1280, 720)
    expect(g.cols).toBe(2)
    expect(g.rows).toBe(1)
    expect(g.cellW).toBe(640)
    expect(g.cellH).toBe(720)
  })

  test('4 streams: 2x2 grid', () => {
    const g = calcGrid(4, 1280, 720)
    expect(g.cols).toBe(2)
    expect(g.rows).toBe(2)
    expect(g.cellW).toBe(640)
    expect(g.cellH).toBe(360)
  })

  test('6 streams: 3 columns, 2 rows', () => {
    const g = calcGrid(6, 1280, 720)
    expect(g.cols).toBe(3)
    expect(g.rows).toBe(2)
    expect(g.cellW).toBe(426)
    expect(g.cellH).toBe(360)
  })

  test('3 streams: 2 columns, 2 rows (odd n)', () => {
    const g = calcGrid(3, 1280, 720)
    expect(g.cols).toBe(2)
    expect(g.rows).toBe(2)
    expect(g.cellW).toBe(640)
    expect(g.cellH).toBe(360)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/unit/v2/recording/RecordingManager.test.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/v2/recording/RecordingManager.ts` with `calcGrid` only**

```typescript
export function calcGrid(
  n: number,
  w: number,
  h: number,
): { cols: number; rows: number; cellW: number; cellH: number } {
  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  return { cols, rows, cellW: Math.floor(w / cols), cellH: Math.floor(h / rows) }
}
```

- [ ] **Step 4: Run tests — all pass**

```bash
npx jest tests/unit/v2/recording/RecordingManager.test.ts --no-coverage
```

Expected: PASS (5 tests green).

- [ ] **Step 5: Commit**

```bash
git add src/v2/recording/RecordingManager.ts tests/unit/v2/recording/RecordingManager.test.ts
git commit -m "feat(recording): calcGrid pure function + unit tests"
```

---

## Task 5: `RecordingManager` — full implementation + tests

**Files:**
- Modify: `src/v2/recording/RecordingManager.ts`
- Modify: `tests/unit/v2/recording/RecordingManager.test.ts`

- [ ] **Step 1: Write the failing manager tests**

Append to `tests/unit/v2/recording/RecordingManager.test.ts`:

```typescript
// --- Browser API mocks ---

const makeAudioSource = () => ({ connect: jest.fn(), disconnect: jest.fn() })
const makeAudioDest = (stream: MediaStream) => ({ stream })
const makeAudioCtx = () => {
  const source = makeAudioSource()
  const destStream = makeMockStream()
  const dest = makeAudioDest(destStream)
  return {
    ctx: {
      createMediaStreamSource: jest.fn().mockReturnValue(source),
      createMediaStreamDestination: jest.fn().mockReturnValue(dest),
      close: jest.fn(),
    },
    source,
    dest,
  }
}

const makeRecorder = () => {
  const rec = {
    start: jest.fn(),
    stop: jest.fn(),
    ondataavailable: null as ((e: { data: Blob }) => void) | null,
    onstop: null as (() => void) | null,
  }
  return rec
}

const makeMockStream = (): MediaStream =>
  ({
    id: Math.random().toString(36).slice(2),
    getAudioTracks: () => [{}],
    getVideoTracks: () => [{}],
  } as unknown as MediaStream)

const makeCanvasStream = (audioTrack: object) => ({
  addTrack: jest.fn(),
  getAudioTracks: jest.fn().mockReturnValue([audioTrack]),
})

let mockAudio: ReturnType<typeof makeAudioCtx>
let mockRecorder: ReturnType<typeof makeRecorder>
let mockCanvasStream: ReturnType<typeof makeCanvasStream>
let captureStreamMock: jest.Mock
let createElementMock: jest.SpyInstance
let createObjectURLMock: jest.Mock
let revokeObjectURLMock: jest.Mock

beforeEach(() => {
  mockAudio = makeAudioCtx()
  mockRecorder = makeRecorder()
  mockCanvasStream = makeCanvasStream({})

  ;(global as any).AudioContext = jest.fn().mockReturnValue(mockAudio.ctx)
  ;(global as any).MediaRecorder = jest.fn().mockImplementation(() => mockRecorder)
  ;(global as any).MediaRecorder.isTypeSupported = jest.fn().mockReturnValue(true)

  captureStreamMock = jest.fn().mockReturnValue(mockCanvasStream)

  const realCreateElement = document.createElement.bind(document)
  createElementMock = jest
    .spyOn(document, 'createElement')
    .mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const canvas = realCreateElement('canvas') as HTMLCanvasElement
        canvas.captureStream = captureStreamMock
        canvas.getContext = jest.fn().mockReturnValue({
          fillStyle: '',
          fillRect: jest.fn(),
          drawImage: jest.fn(),
        })
        return canvas
      }
      if (tag === 'video') {
        const video = realCreateElement('video') as HTMLVideoElement
        Object.defineProperty(video, 'srcObject', { writable: true, value: null })
        video.play = jest.fn().mockResolvedValue(undefined)
        return video
      }
      if (tag === 'a') {
        const a = realCreateElement('a') as HTMLAnchorElement
        a.click = jest.fn()
        return a
      }
      return realCreateElement(tag)
    })

  createObjectURLMock = jest.fn().mockReturnValue('blob:fake-url')
  revokeObjectURLMock = jest.fn()
  ;(global as any).URL.createObjectURL = createObjectURLMock
  ;(global as any).URL.revokeObjectURL = revokeObjectURLMock

  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
    // Do not auto-invoke — tests call drawFrame manually via start()
    return 0
  })
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {})
})

afterEach(() => {
  createElementMock.mockRestore()
  jest.restoreAllMocks()
  delete (global as any).AudioContext
  delete (global as any).MediaRecorder
})

describe('RecordingManager', () => {
  test('start() creates AudioContext and MediaRecorder', () => {
    const manager = new RecordingManager('room-1')
    const local = makeMockStream()
    manager.start(local, [])
    expect((global as any).AudioContext).toHaveBeenCalledTimes(1)
    expect((global as any).MediaRecorder).toHaveBeenCalledTimes(1)
  })

  test('start() calls MediaRecorder.start(1000)', () => {
    const manager = new RecordingManager('room-1')
    manager.start(makeMockStream(), [])
    expect(mockRecorder.start).toHaveBeenCalledWith(1000)
  })

  test('start() creates one video element per stream', () => {
    const manager = new RecordingManager('room-1')
    const remote1 = makeMockStream()
    const remote2 = makeMockStream()
    manager.start(makeMockStream(), [
      { id: 'r1', stream: remote1 },
      { id: 'r2', stream: remote2 },
    ])
    // local + 2 remotes = 3 video elements created
    const videoCalls = createElementMock.mock.calls.filter(([tag]) => tag === 'video')
    expect(videoCalls).toHaveLength(3)
  })

  test('stop() calls MediaRecorder.stop()', () => {
    const manager = new RecordingManager('room-1')
    manager.start(makeMockStream(), [])
    manager.stop()
    expect(mockRecorder.stop).toHaveBeenCalled()
  })

  test('stop() triggers download when onstop fires', () => {
    const manager = new RecordingManager('room-1')
    manager.start(makeMockStream(), [])

    // Simulate data arriving
    mockRecorder.ondataavailable?.({ data: new Blob(['chunk'], { type: 'video/webm' }) })
    // Simulate recorder stopping
    mockRecorder.onstop?.()

    expect(createObjectURLMock).toHaveBeenCalled()
    const aCalls = createElementMock.mock.calls.filter(([tag]) => tag === 'a')
    expect(aCalls).toHaveLength(1)
  })

  test('download filename contains roomId', () => {
    const manager = new RecordingManager('my-room')
    manager.start(makeMockStream(), [])
    mockRecorder.ondataavailable?.({ data: new Blob(['x'], { type: 'video/webm' }) })
    mockRecorder.onstop?.()

    const aMock = createElementMock.mock.results
      .filter((r, i) => createElementMock.mock.calls[i]?.[0] === 'a')
      .map((r) => r.value)[0]
    expect(aMock.download).toContain('my-room')
  })

  test('removeStream disconnects audio source', () => {
    const manager = new RecordingManager('room-1')
    const remote = makeMockStream()
    manager.start(makeMockStream(), [{ id: 'peer-1', stream: remote }])
    manager.removeStream('peer-1')
    expect(mockAudio.source.disconnect).toHaveBeenCalled()
  })

  test('falls back to video/webm when vp8+opus not supported', () => {
    ;(global as any).MediaRecorder.isTypeSupported = jest.fn().mockReturnValue(false)
    const manager = new RecordingManager('room-1')
    manager.start(makeMockStream(), [])
    expect((global as any).MediaRecorder).toHaveBeenCalledWith(
      expect.anything(),
      { mimeType: 'video/webm' },
    )
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/unit/v2/recording/RecordingManager.test.ts --no-coverage
```

Expected: FAIL — `RecordingManager` class not defined.

- [ ] **Step 3: Implement the full `RecordingManager`**

Replace `src/v2/recording/RecordingManager.ts` with:

```typescript
export function calcGrid(
  n: number,
  w: number,
  h: number,
): { cols: number; rows: number; cellW: number; cellH: number } {
  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  return { cols, rows, cellW: Math.floor(w / cols), cellH: Math.floor(h / rows) }
}

interface StreamEntry {
  stream: MediaStream
  videoEl: HTMLVideoElement
  audioSource: MediaStreamAudioSourceNode
}

export class RecordingManager {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private audioCtx: AudioContext | null = null
  private audioDest: MediaStreamAudioDestinationNode | null = null
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private rafId: number | null = null
  private streams = new Map<string, StreamEntry>()

  constructor(private roomId: string) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = 1280
    this.canvas.height = 720
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D
  }

  start(
    localStream: MediaStream,
    remoteStreams: Array<{ id: string; stream: MediaStream }>,
  ): void {
    const mimeType =
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm'

    this.audioCtx = new AudioContext()
    this.audioDest = this.audioCtx.createMediaStreamDestination()

    this.attachStream('local', localStream)
    for (const { id, stream } of remoteStreams) {
      this.attachStream(id, stream)
    }

    const canvasStream = this.canvas.captureStream(15)
    const audioTracks = this.audioDest.stream.getAudioTracks()
    if (audioTracks.length > 0) canvasStream.addTrack(audioTracks[0])

    this.recorder = new MediaRecorder(canvasStream, { mimeType })
    this.recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
    this.recorder.onstop = () => this.triggerDownload()
    this.recorder.start(1000)

    this.scheduleFrame()
  }

  removeStream(id: string): void {
    const entry = this.streams.get(id)
    if (!entry) return
    entry.audioSource.disconnect()
    entry.videoEl.srcObject = null
    this.streams.delete(id)
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.recorder?.stop()
    for (const id of [...this.streams.keys()]) {
      this.removeStream(id)
    }
    this.audioCtx?.close()
  }

  private attachStream(id: string, stream: MediaStream): void {
    if (!this.audioCtx || !this.audioDest) return
    const videoEl = document.createElement('video') as HTMLVideoElement
    videoEl.srcObject = stream
    videoEl.muted = true
    videoEl.play().catch(() => {})
    const audioSource = this.audioCtx.createMediaStreamSource(stream)
    audioSource.connect(this.audioDest)
    this.streams.set(id, { stream, videoEl, audioSource })
  }

  private scheduleFrame(): void {
    this.drawFrame()
    this.rafId = requestAnimationFrame(() => this.scheduleFrame())
  }

  private drawFrame(): void {
    const entries = [...this.streams.values()]
    const n = entries.length
    if (n === 0) return
    const { cols, cellW, cellH } = calcGrid(n, this.canvas.width, this.canvas.height)
    this.ctx.fillStyle = '#000'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    entries.forEach(({ videoEl }, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      this.ctx.drawImage(videoEl, col * cellW, row * cellH, cellW, cellH)
    })
  }

  private triggerDownload(): void {
    const blob = new Blob(this.chunks, { type: 'video/webm' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a') as HTMLAnchorElement
    a.href = url
    a.download = `recording-${this.roomId}-${Date.now()}.webm`
    a.click()
    URL.revokeObjectURL(url)
  }
}
```

- [ ] **Step 4: Run all recording tests**

```bash
npx jest tests/unit/v2/recording/RecordingManager.test.ts --no-coverage
```

Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add src/v2/recording/RecordingManager.ts tests/unit/v2/recording/RecordingManager.test.ts
git commit -m "feat(recording): RecordingManager — canvas composite + audio mix + download"
```

---

## Task 6: `RecordingController`

**Files:**
- Create: `src/v2/call/RecordingController.tsx`
- Create: `tests/unit/v2/call/RecordingController.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/v2/call/RecordingController.test.tsx`:

```typescript
import { render, act } from '@testing-library/react'
import { createRef } from 'react'
import { useCallStore } from '../../../../src/v2/store/useCallStore'
import { useSessionStore } from '../../../../src/v2/store/useSessionStore'
import { usePeerStore } from '../../../../src/v2/store/usePeerStore'
import { useUIStore } from '../../../../src/v2/store/useUIStore'
import type { PeerRecord } from '../../../../src/v2/types'

jest.mock('../../../../src/v2/recording/RecordingManager')
import { RecordingManager } from '../../../../src/v2/recording/RecordingManager'
const MockRecordingManager = RecordingManager as jest.MockedClass<typeof RecordingManager>

const mockManager = {
  start: jest.fn(),
  removeStream: jest.fn(),
  stop: jest.fn(),
}

const makePeer = (id: string, stream: MediaStream | null = null): PeerRecord => ({
  id, name: 'Peer', role: 'guest', stream, isMuted: false, isCamOff: false,
  videoEnabled: true, isScreenSharing: false, connectionState: 'connected',
  networkQuality: 'good', isSpeaking: false, isPinned: false,
  hasRaisedHand: false, handRaisedAt: null, reaction: null, isAway: false, isTyping: false,
})

const makeMockStream = (): MediaStream =>
  ({ id: 'stream-1', getAudioTracks: () => [{}] } as unknown as MediaStream)

beforeEach(() => {
  MockRecordingManager.mockImplementation(() => mockManager as any)
  useCallStore.setState({ localStream: null, isHost: false, userName: 'Host' })
  useSessionStore.setState({ recordingState: 'idle' })
  usePeerStore.setState({ peers: new Map() })
  jest.clearAllMocks()
})

// Import after mocks
let RecordingController: typeof import('../../../../src/v2/call/RecordingController').RecordingController
beforeAll(async () => {
  RecordingController = (await import('../../../../src/v2/call/RecordingController')).RecordingController
})

test('renders null (renderless component)', () => {
  const { container } = render(<RecordingController roomId="room-1" />)
  expect(container).toBeEmptyDOMElement()
})

test('does NOT start recording when isHost is false even if recordingState is recording', async () => {
  useCallStore.setState({ isHost: false, localStream: makeMockStream() })
  render(<RecordingController roomId="room-1" />)
  await act(async () => {
    useSessionStore.setState({ recordingState: 'recording' })
  })
  expect(MockRecordingManager).not.toHaveBeenCalled()
})

test('creates RecordingManager and calls start() when host starts recording', async () => {
  const localStream = makeMockStream()
  useCallStore.setState({ isHost: true, localStream })
  render(<RecordingController roomId="room-1" />)
  await act(async () => {
    useSessionStore.setState({ recordingState: 'recording' })
  })
  expect(MockRecordingManager).toHaveBeenCalledWith('room-1')
  expect(mockManager.start).toHaveBeenCalledWith(localStream, [])
})

test('passes remote streams to start()', async () => {
  const localStream = makeMockStream()
  const remoteStream = makeMockStream()
  useCallStore.setState({ isHost: true, localStream })
  usePeerStore.setState({ peers: new Map([['peer-1', makePeer('peer-1', remoteStream)]]) })
  render(<RecordingController roomId="room-1" />)
  await act(async () => {
    useSessionStore.setState({ recordingState: 'recording' })
  })
  expect(mockManager.start).toHaveBeenCalledWith(localStream, [{ id: 'peer-1', stream: remoteStream }])
})

test('calls manager.stop() when recordingState returns to idle', async () => {
  useCallStore.setState({ isHost: true, localStream: makeMockStream() })
  render(<RecordingController roomId="room-1" />)
  await act(async () => {
    useSessionStore.setState({ recordingState: 'recording' })
  })
  await act(async () => {
    useSessionStore.setState({ recordingState: 'idle' })
  })
  expect(mockManager.stop).toHaveBeenCalled()
})

test('shows unsupported toast and resets state when MediaRecorder absent', async () => {
  const original = (global as any).MediaRecorder
  delete (global as any).MediaRecorder
  useCallStore.setState({ isHost: true, localStream: makeMockStream() })
  render(<RecordingController roomId="room-1" />)
  await act(async () => {
    useSessionStore.setState({ recordingState: 'recording' })
  })
  expect(useSessionStore.getState().recordingState).toBe('idle')
  expect(useUIStore.getState().toasts.some((t) => t.message.includes('supported'))).toBe(true)
  ;(global as any).MediaRecorder = original
})

test('calls manager.removeStream() when a peer with stream leaves', async () => {
  const localStream = makeMockStream()
  const remoteStream = makeMockStream()
  useCallStore.setState({ isHost: true, localStream })
  usePeerStore.setState({ peers: new Map([['peer-1', makePeer('peer-1', remoteStream)]]) })
  render(<RecordingController roomId="room-1" />)
  await act(async () => {
    useSessionStore.setState({ recordingState: 'recording' })
  })
  await act(async () => {
    usePeerStore.setState({ peers: new Map() })
  })
  expect(mockManager.removeStream).toHaveBeenCalledWith('peer-1')
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/unit/v2/call/RecordingController.test.tsx --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `RecordingController`**

Create `src/v2/call/RecordingController.tsx`:

```typescript
import { useEffect, useRef } from 'react'
import { useCallStore } from '../store/useCallStore'
import { usePeerStore } from '../store/usePeerStore'
import { useSessionStore } from '../store/useSessionStore'
import { useUIStore } from '../store/useUIStore'
import { RecordingManager } from '../recording/RecordingManager'

interface RecordingControllerProps {
  roomId: string
}

export function RecordingController({ roomId }: RecordingControllerProps) {
  const isHost = useCallStore((s) => s.isHost)
  const localStream = useCallStore((s) => s.localStream)
  const recordingState = useSessionStore((s) => s.recordingState)
  const setRecordingState = useSessionStore((s) => s.setRecordingState)
  const peers = usePeerStore((s) => s.peers)
  const addToast = useUIStore((s) => s.addToast)

  const managerRef = useRef<RecordingManager | null>(null)
  const attachedPeerIdsRef = useRef<Set<string>>(new Set())

  // Manager lifecycle: create/destroy based on host recording state
  useEffect(() => {
    if (!isHost || recordingState !== 'recording' || !localStream) return

    if (typeof MediaRecorder === 'undefined') {
      addToast({
        id: `rec-unsupported-${Date.now()}`,
        message: "Recording isn't supported in this browser",
        variant: 'warn',
      })
      setRecordingState('idle')
      return
    }

    const remoteStreams = [...peers.values()]
      .filter((p) => p.stream !== null)
      .map((p) => ({ id: p.id, stream: p.stream! }))

    attachedPeerIdsRef.current = new Set(remoteStreams.map((r) => r.id))

    const manager = new RecordingManager(roomId)
    managerRef.current = manager
    manager.start(localStream, remoteStreams)

    return () => {
      manager.stop()
      managerRef.current = null
      attachedPeerIdsRef.current = new Set()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, recordingState, localStream, roomId])

  // Track peer stream departures during recording
  useEffect(() => {
    const manager = managerRef.current
    if (!manager) return
    for (const id of [...attachedPeerIdsRef.current]) {
      if (!peers.has(id)) {
        manager.removeStream(id)
        attachedPeerIdsRef.current.delete(id)
      }
    }
  }, [peers])

  // Warn before unload while recording
  useEffect(() => {
    if (recordingState !== 'recording') return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [recordingState])

  return null
}
```

- [ ] **Step 4: Run tests — all pass**

```bash
npx jest tests/unit/v2/call/RecordingController.test.tsx --no-coverage
```

Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add src/v2/call/RecordingController.tsx tests/unit/v2/call/RecordingController.test.tsx
git commit -m "feat(recording): RecordingController — store wiring and manager lifecycle"
```

---

## Task 7: `RecordingIndicator`

**Files:**
- Create: `src/v2/components/RecordingIndicator.tsx`
- Create: `tests/unit/v2/components/RecordingIndicator.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/v2/components/RecordingIndicator.test.tsx`:

```typescript
import { render, screen, act } from '@testing-library/react'
import { useSessionStore } from '../../../../src/v2/store/useSessionStore'

let RecordingIndicator: typeof import('../../../../src/v2/components/RecordingIndicator').RecordingIndicator

beforeAll(async () => {
  RecordingIndicator = (await import('../../../../src/v2/components/RecordingIndicator')).RecordingIndicator
})

beforeEach(() => {
  useSessionStore.setState({ recordingState: 'idle' })
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

test('renders nothing when recordingState is idle', () => {
  const { container } = render(<RecordingIndicator />)
  expect(container).toBeEmptyDOMElement()
})

test('renders REC indicator when recordingState is recording', async () => {
  render(<RecordingIndicator />)
  await act(async () => {
    useSessionStore.setState({ recordingState: 'recording' })
  })
  expect(screen.getByTestId('recording-indicator')).toBeInTheDocument()
  expect(screen.getByText(/REC/)).toBeInTheDocument()
})

test('shows elapsed time ticking up', async () => {
  render(<RecordingIndicator />)
  await act(async () => {
    useSessionStore.setState({ recordingState: 'recording' })
  })
  act(() => { jest.advanceTimersByTime(61000) })
  expect(screen.getByText(/01:01/)).toBeInTheDocument()
})

test('disappears when recordingState returns to idle', async () => {
  render(<RecordingIndicator />)
  await act(async () => {
    useSessionStore.setState({ recordingState: 'recording' })
  })
  await act(async () => {
    useSessionStore.setState({ recordingState: 'idle' })
  })
  expect(screen.queryByTestId('recording-indicator')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/unit/v2/components/RecordingIndicator.test.tsx --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `RecordingIndicator`**

Create `src/v2/components/RecordingIndicator.tsx`:

```typescript
import { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../store/useSessionStore'

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function RecordingIndicator() {
  const recordingState = useSessionStore((s) => s.recordingState)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (recordingState !== 'recording') {
      setElapsed(0)
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    setElapsed(0)
    intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [recordingState])

  if (recordingState !== 'recording') return null

  return (
    <div
      data-testid="recording-indicator"
      className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-600/90 text-white text-xs font-semibold"
    >
      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
      REC {formatElapsed(elapsed)}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — all pass**

```bash
npx jest tests/unit/v2/components/RecordingIndicator.test.tsx --no-coverage
```

Expected: PASS (4 tests green).

- [ ] **Step 5: Commit**

```bash
git add src/v2/components/RecordingIndicator.tsx tests/unit/v2/components/RecordingIndicator.test.tsx
git commit -m "feat(recording): RecordingIndicator — red dot + elapsed timer"
```

---

## Task 8: `ControlBar` — Record/Stop button

**Files:**
- Modify: `src/v2/call/ControlBar.tsx`
- Modify: `tests/unit/v2/call/ControlBar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Open `tests/unit/v2/call/ControlBar.test.tsx`. Add these tests at the bottom:

```typescript
import { useCallStore } from '../../../../src/v2/store/useCallStore'
import { useSessionStore } from '../../../../src/v2/store/useSessionStore'

// Add to beforeEach: reset recording state
// (Add these lines inside the existing beforeEach or create a new one)
beforeEach(() => {
  useCallStore.setState({ isHost: false })
  useSessionStore.setState({ recordingState: 'idle' })
})

test('Record button is hidden when isHost is false', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.queryByTestId('btn-record')).not.toBeInTheDocument()
})

test('Record button is visible when isHost is true', () => {
  useCallStore.setState({ isHost: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-record')).toBeInTheDocument()
})

test('clicking Record calls onStartRecording and shows Stop button', () => {
  const onStartRecording = jest.fn()
  useCallStore.setState({ isHost: true })
  render(<ControlBar onEndCall={jest.fn()} onStartRecording={onStartRecording} />)
  fireEvent.click(screen.getByTestId('btn-record'))
  expect(onStartRecording).toHaveBeenCalled()
})

test('Stop button visible when recordingState is recording (host)', () => {
  useCallStore.setState({ isHost: true })
  useSessionStore.setState({ recordingState: 'recording' })
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-stop-record')).toBeInTheDocument()
  expect(screen.queryByTestId('btn-record')).not.toBeInTheDocument()
})

test('clicking Stop calls onStopRecording', () => {
  const onStopRecording = jest.fn()
  useCallStore.setState({ isHost: true })
  useSessionStore.setState({ recordingState: 'recording' })
  render(<ControlBar onEndCall={jest.fn()} onStopRecording={onStopRecording} />)
  fireEvent.click(screen.getByTestId('btn-stop-record'))
  expect(onStopRecording).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/unit/v2/call/ControlBar.test.tsx --no-coverage
```

Expected: FAIL — `btn-record` not found, `onStartRecording` prop not recognized.

- [ ] **Step 3: Update `ControlBar`**

In `src/v2/call/ControlBar.tsx`:

**Add imports at the top:**
```typescript
import { useCallStore } from '../store/useCallStore'
import { useSessionStore } from '../store/useSessionStore'
```
(Note: `useCallStore` is already imported — only add `useSessionStore`.)

**Update the props interface:**
```typescript
interface ControlBarProps {
  onEndCall: () => void
  onSendReaction?: (emoji: string) => void
  onStartRecording?: () => void
  onStopRecording?: () => void
}
```

**Add store reads inside the component** (after the existing reads):
```typescript
  const isHost = useCallStore((s) => s.isHost)
  const recordingState = useSessionStore((s) => s.recordingState)
```

**Update the function signature** to destructure new props:
```typescript
export function ControlBar({ onEndCall, onSendReaction, onStartRecording, onStopRecording }: ControlBarProps) {
```

**Add the Record/Stop button** inside the `<motion.div>`, just before the Leave button:

```typescript
          {isHost && recordingState !== 'recording' && (
            <Button
              data-testid="btn-record"
              variant="ghost"
              onClick={onStartRecording}
              aria-label="Start Recording"
            >
              ⏺ Rec
            </Button>
          )}

          {isHost && recordingState === 'recording' && (
            <Button
              data-testid="btn-stop-record"
              variant="danger"
              onClick={onStopRecording}
              aria-label="Stop Recording"
            >
              ⏹ Stop Rec
            </Button>
          )}
```

- [ ] **Step 4: Run tests — all pass**

```bash
npx jest tests/unit/v2/call/ControlBar.test.tsx --no-coverage
```

Expected: PASS (all tests green including new ones).

- [ ] **Step 5: Commit**

```bash
git add src/v2/call/ControlBar.tsx tests/unit/v2/call/ControlBar.test.tsx
git commit -m "feat(recording): ControlBar Record/Stop button (host-only)"
```

---

## Task 9: Wire `RoomV2`

**Files:**
- Modify: `src/v2/pages/RoomV2.tsx`

No new tests — covered by existing integration. Manual verification in Task 10.

- [ ] **Step 1: Add imports**

In `src/v2/pages/RoomV2.tsx`, add these imports after the existing ones:

```typescript
import { RecordingController } from '../call/RecordingController'
import { RecordingIndicator } from '../components/RecordingIndicator'
import { useSessionStore } from '../store/useSessionStore'
```

- [ ] **Step 2: Add store reads for recording callbacks**

Inside the `RoomV2` function, after the existing store reads, add:

```typescript
  const setRecordingState = useSessionStore((s) => s.setRecordingState)
```

- [ ] **Step 3: Mount `RecordingController` alongside `TranscriptionController`**

Find the `<TranscriptionController />` line and add `RecordingController` below it:

```typescript
      <MediaController />
      <TranscriptionController />
      <RecordingController roomId={roomId ?? ''} />
      <PeerManager ref={peerManagerRef} roomId={roomId ?? ''} />
```

- [ ] **Step 4: Mount `RecordingIndicator` in the video area**

Find the `<CaptionOverlay />` line and add `RecordingIndicator` next to it (in the top-right of the video area). Replace:

```typescript
          <SpotlightView />
          <ThumbnailStrip />
          <PollBanner onVotePoll={(id, idx) => peerManagerRef.current?.votePoll(id, idx)} />
          <CaptionOverlay />
          <ControlBar
```

With:

```typescript
          <SpotlightView />
          <ThumbnailStrip />
          <PollBanner onVotePoll={(id, idx) => peerManagerRef.current?.votePoll(id, idx)} />
          <CaptionOverlay />
          <div className="absolute top-4 right-4 z-10">
            <RecordingIndicator />
          </div>
          <ControlBar
```

- [ ] **Step 5: Pass recording callbacks to `ControlBar`**

Find the existing `<ControlBar ... />` usage and add the new props:

```typescript
          <ControlBar
            onEndCall={() => { resetCall(); navigate('/') }}
            onSendReaction={(emoji) => peerManagerRef.current?.sendReaction(emoji)}
            onStartRecording={() => {
              setRecordingState('recording')
              peerManagerRef.current?.broadcastRecordingStarted()
            }}
            onStopRecording={() => {
              setRecordingState('idle')
              peerManagerRef.current?.broadcastRecordingStopped()
            }}
          />
```

- [ ] **Step 6: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: All tests pass. Fix any regressions before committing.

- [ ] **Step 7: Commit**

```bash
git add src/v2/pages/RoomV2.tsx
git commit -m "feat(recording): wire RecordingController + RecordingIndicator into RoomV2"
```

---

## Task 10: Manual smoke test

Start both servers and verify end-to-end behavior in Chrome.

- [ ] **Step 1: Start servers**

```bash
npm run dx:dev
```

Open two browser tabs to `http://localhost:5173`.

- [ ] **Step 2: Verify host detection**

In Tab A: enter a name and create a room. Open browser console.
Expected: No errors. The user in Tab A should be the host (check: Record button should appear in ControlBar after opening a room — note: Tab A is the first to join).

In Tab B: join the same room.
Expected: Tab B has no Record button (guest). Tab A still has Record button.

- [ ] **Step 3: Verify recording starts**

In Tab A: click ⏺ Rec.
Expected in Tab A: button changes to ⏹ Stop Rec. Red `RecordingIndicator` appears top-right.
Expected in Tab B: toast "Recording has started". Red `RecordingIndicator` appears.

- [ ] **Step 4: Verify recording stops and file downloads**

In Tab A: click ⏹ Stop Rec.
Expected: Browser download dialog (or auto-download) for `recording-<roomId>-<timestamp>.webm`. RecordingIndicator disappears in both tabs. Tab B sees toast "Recording ended".

- [ ] **Step 5: Verify auto-stop on leave**

Start a new recording in Tab A. Then click Leave (or close Tab A).
Expected: File downloads before navigation. Tab B sees "Recording ended" toast.

- [ ] **Step 6: Play the downloaded file**

Open the `.webm` file in a media player or VLC.
Expected: Video shows both participants. Audio from both participants is present.

- [ ] **Step 7: Final commit if any fixes were needed**

```bash
npx jest --no-coverage
git add -p
git commit -m "fix(recording): smoke test fixes"
```
