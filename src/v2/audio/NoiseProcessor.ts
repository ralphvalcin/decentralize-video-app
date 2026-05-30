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
  private inputPending = new Float32Array(0)
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

    const combined = new Float32Array(this.inputPending.length + input.length)
    combined.set(this.inputPending)
    combined.set(input, this.inputPending.length)

    const outputChunks: Float32Array[] = []
    let offset = 0
    while (offset + 480 <= combined.length) {
      const frame = combined.slice(offset, offset + 480)
      this.denoiseState.processFrame(frame) // modifies frame in-place
      outputChunks.push(frame)
      offset += 480
    }
    this.inputPending = combined.slice(offset)

    const totalNew = outputChunks.reduce((s, c) => s + c.length, 0)
    const allProcessed = new Float32Array(this.outputPending.length + totalNew)
    allProcessed.set(this.outputPending)
    let pos = this.outputPending.length
    for (const chunk of outputChunks) {
      allProcessed.set(chunk, pos)
      pos += chunk.length
    }

    const toWrite = Math.min(allProcessed.length, output.length)
    output.set(allProcessed.subarray(0, toWrite))
    if (toWrite < output.length) output.fill(0, toWrite)
    this.outputPending = allProcessed.slice(toWrite)
  }
}
