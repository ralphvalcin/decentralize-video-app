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
  expect(onSegment).not.toHaveBeenCalled()
})

test('onInitError callback is called when worker posts init error (speakerId null)', () => {
  const onInitError = jest.fn()
  const worker = makeMockWorker()
  new TranscriptionManager(worker as unknown as Worker, jest.fn(), jest.fn(), onInitError)
  worker.onmessage!({ data: { type: 'error', speakerId: null, error: 'model failed' } } as MessageEvent)
  expect(onInitError).toHaveBeenCalled()
})

test('addStream with duplicate speakerId cleans up the previous entry first', () => {
  const worker = makeMockWorker()
  const manager = new TranscriptionManager(worker as unknown as Worker, jest.fn(), jest.fn())
  manager.addStream('s1', 'Alice', makeMockStream())
  const firstSource = sourceA

  // Set up a second AudioContext for the second addStream call
  const scriptNodeB = makeScriptNode()
  const sourceB = makeSource()
  ;(global as any).AudioContext = jest.fn().mockImplementation(() =>
    makeCtx(scriptNodeB, sourceB)
  )

  manager.addStream('s1', 'Bob', makeMockStream())
  expect(firstSource.disconnect).toHaveBeenCalled()
})
