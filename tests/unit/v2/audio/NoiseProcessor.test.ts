import { NoiseProcessor } from '../../../../src/v2/audio/NoiseProcessor'

const mockProcessFrame = jest.fn((frame: Float32Array) => {
  frame.fill(0) // simulate in-place denoising
  return 0.9   // VAD score
})
const mockDenoiseState = { processFrame: mockProcessFrame, destroy: jest.fn() }
const mockRnnoiseModule = { newState: jest.fn(() => mockDenoiseState) }

jest.mock('@jitsi/rnnoise-wasm', () => jest.fn())

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
  const createRnnoise = require('@jitsi/rnnoise-wasm') as jest.Mock
  createRnnoise.mockResolvedValue(mockRnnoiseModule)
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
