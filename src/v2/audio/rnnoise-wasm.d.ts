declare module '@jitsi/rnnoise-wasm' {
  interface RnnoiseState {
    /** Denoises the 480-sample frame in-place. Returns VAD probability (0–1). */
    processFrame(frame: Float32Array): number
    destroy(): void
  }
  interface RnnoiseProcessor {
    newState(): RnnoiseState
  }
  function createRnnoiseProcessor(): Promise<RnnoiseProcessor>
  export default createRnnoiseProcessor
}
