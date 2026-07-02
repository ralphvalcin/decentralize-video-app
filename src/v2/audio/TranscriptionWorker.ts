import { env, pipeline } from '@huggingface/transformers'
// Self-host the ONNX runtime WASM: without an explicit wasmPaths,
// transformers.js falls back to cdn.jsdelivr.net, which the production
// CSP (script/connect limited to 'self' + model hosts) blocks.
// Vite's ?url imports emit these as hashed same-origin assets.
// @ts-expect-error Vite ?url asset import (aliased in vite.config.js)
import ortWasmUrl from '@ort-asyncify-wasm?url'
// @ts-expect-error Vite ?url asset import (aliased in vite.config.js)
import ortMjsUrl from '@ort-asyncify-mjs?url'

env.backends.onnx.wasm.wasmPaths = {
  wasm: new URL(ortWasmUrl, self.location.origin).href,
  mjs: new URL(ortMjsUrl, self.location.origin).href,
}
// Run ORT inline in this worker (single-threaded, no proxy) so it does not
// spawn a blob: sub-worker — that sub-worker would otherwise require
// cross-origin isolation (COOP/COEP) and blob: in script-src.
env.backends.onnx.wasm.numThreads = 1
env.backends.onnx.wasm.proxy = false

type ASRPipeline = Awaited<ReturnType<typeof pipeline<'automatic-speech-recognition'>>>

let transcriber: ASRPipeline | null = null

;(self as any).onmessage = async (e: MessageEvent) => {
  const { type, speakerId, userName, audio } = e.data

  if (type === 'init') {
    try {
      // dtype fp32: the default quantized weights use MatMulNBits, which the
      // pinned onnxruntime-web build can't load ('Missing required scale').
      transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
        dtype: 'fp32',
      })
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
