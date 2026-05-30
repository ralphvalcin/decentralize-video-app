import type { TranscriptSegment } from '../types'

/** Internal state held for each active speaker stream. */
interface SpeakerEntry {
  ctx: AudioContext
  source: MediaStreamAudioSourceNode
  scriptNode: ScriptProcessorNode
  userName: string
  buffer: Float32Array
}

/** 5 seconds of audio at 48 kHz — the minimum chunk size sent for transcription. */
const THRESHOLD = 48000 * 5 // 240,000 samples

/** Ratio used to downsample 48 kHz → 16 kHz (Whisper's expected sample rate). */
const DOWNSAMPLE_RATIO = 3

/**
 * Manages per-stream audio capture and feeds a serial job queue to a
 * TranscriptionWorker.
 *
 * @example
 * ```ts
 * const worker = createTranscriptionWorker()
 * const manager = new TranscriptionManager(
 *   worker,
 *   () => console.log('worker ready'),
 *   (seg) => console.log(seg.text),
 *   () => console.error('model failed to load'),
 * )
 * manager.addStream(peerId, userName, mediaStream)
 * ```
 */
export class TranscriptionManager {
  private speakers = new Map<string, SpeakerEntry>()
  private _queue: Array<{ speakerId: string; userName: string; audio: Float32Array }> = []
  private _processing = false

  /**
   * @param worker      - The TranscriptionWorker instance (or mock in tests).
   * @param onReady     - Called once when the worker signals it has loaded the model.
   * @param onSegment   - Called for each transcribed segment returned by the worker.
   * @param onInitError - Called if the worker fails to initialise (model load error).
   */
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
          // speakerId is null/'' → init error, model failed to load
          onInitError?.()
        } else {
          // speakerId is truthy → inference error for a specific segment; skip and continue
          console.warn('[TranscriptionManager] inference error for speaker', speakerId, e.data.error)
          this._processing = false
          this._drain()
        }
      }
    }

    worker.postMessage({ type: 'init' })
  }

  /**
   * Begins capturing audio from `stream` for the given speaker.
   * No-ops if the stream has no audio tracks or if AudioContext is unavailable
   * (e.g. in a non-browser environment).
   *
   * @param speakerId - Unique identifier for the speaker/peer.
   * @param userName  - Human-readable display name for the speaker.
   * @param stream    - The MediaStream to capture audio from.
   */
  addStream(speakerId: string, userName: string, stream: MediaStream): void {
    if (typeof AudioContext === 'undefined') return
    if (stream.getAudioTracks().length === 0) return

    const ctx = new AudioContext({ sampleRate: 48000 })
    const source = ctx.createMediaStreamSource(stream)
    const scriptNode = ctx.createScriptProcessor(4096, 1, 1)
    const entry: SpeakerEntry = {
      ctx,
      source,
      scriptNode,
      userName,
      buffer: new Float32Array(0),
    }
    this.speakers.set(speakerId, entry)

    scriptNode.onaudioprocess = (e: AudioProcessingEvent) => {
      const input = e.inputBuffer.getChannelData(0)

      // Grow the buffer by appending the new frame
      const combined = new Float32Array(entry.buffer.length + input.length)
      combined.set(entry.buffer)
      combined.set(input, entry.buffer.length)
      entry.buffer = combined

      if (entry.buffer.length >= THRESHOLD) {
        const chunk = entry.buffer.slice(0, THRESHOLD)
        const downsampled = this._downsample(chunk)
        this._enqueue(speakerId, userName, downsampled)
        // Retain any samples beyond the threshold for the next chunk
        entry.buffer = entry.buffer.slice(THRESHOLD)
      }
    }

    source.connect(scriptNode)
    scriptNode.connect(ctx.destination)
  }

  /**
   * Stops capturing audio for the given speaker and releases Web Audio resources.
   *
   * @param speakerId - The speaker ID passed to `addStream`.
   */
  removeStream(speakerId: string): void {
    const entry = this.speakers.get(speakerId)
    if (!entry) return
    entry.source.disconnect()
    entry.scriptNode.disconnect()
    entry.ctx.close()
    this.speakers.delete(speakerId)
  }

  /**
   * Removes all streams, clears the job queue, and terminates the worker.
   * The instance must not be used after calling `dispose`.
   */
  dispose(): void {
    for (const id of [...this.speakers.keys()]) {
      this.removeStream(id)
    }
    this.worker.terminate()
    this._queue = []
    this._processing = false
  }

  /**
   * Downsamples a Float32Array by averaging every `DOWNSAMPLE_RATIO` samples.
   * Exposed as a non-private method to allow direct unit testing.
   *
   * @param input - PCM samples at 48 kHz.
   * @returns     PCM samples at 16 kHz (1/3 the length).
   */
  _downsample(input: Float32Array): Float32Array {
    const outputLength = Math.floor(input.length / DOWNSAMPLE_RATIO)
    const output = new Float32Array(outputLength)
    for (let i = 0; i < outputLength; i++) {
      const base = i * DOWNSAMPLE_RATIO
      output[i] = (input[base] + input[base + 1] + input[base + 2]) / DOWNSAMPLE_RATIO
    }
    return output
  }

  /** Adds a job to the queue and attempts to drain it. */
  private _enqueue(speakerId: string, userName: string, audio: Float32Array): void {
    this._queue.push({ speakerId, userName, audio })
    this._drain()
  }

  /**
   * Sends the next queued job to the worker if one is not already in-flight.
   * The ArrayBuffer is transferred (zero-copy) to the worker via the transferable list.
   */
  private _drain(): void {
    if (this._processing || this._queue.length === 0) return
    const job = this._queue.shift()!
    this._processing = true
    this.worker.postMessage({ type: 'transcribe', ...job }, [job.audio.buffer])
  }
}
