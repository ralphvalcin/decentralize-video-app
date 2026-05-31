import { calcGrid, RecordingManager } from '../../../../src/v2/recording/RecordingManager'

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

  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(() => 0)
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

    mockRecorder.ondataavailable?.({ data: new Blob(['chunk'], { type: 'video/webm' }) })
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
