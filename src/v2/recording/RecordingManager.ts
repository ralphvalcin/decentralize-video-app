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
