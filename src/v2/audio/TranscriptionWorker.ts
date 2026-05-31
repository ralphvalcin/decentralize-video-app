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
      self.postMessage({ type: 'error', speakerId: null, error: String(err) })
    }
    return
  }

  if (type === 'transcribe') {
    if (!transcriber) {
      self.postMessage({ type: 'error', speakerId, error: 'Transcriber not initialized' })
      return
    }
    try {
      const output = (await transcriber(audio)) as { text: string }
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
