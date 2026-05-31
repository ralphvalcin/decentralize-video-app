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
