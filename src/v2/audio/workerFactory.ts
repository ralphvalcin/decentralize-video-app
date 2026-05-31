/**
 * Thin factory that isolates `import.meta.url` from Jest's Babel/CJS transform.
 *
 * Tests always mock this module:
 *   jest.mock('../../../../src/v2/audio/workerFactory', () => ({
 *     createTranscriptionWorker: jest.fn().mockReturnValue({} as Worker),
 *   }))
 *
 * This prevents Jest from ever parsing the `import.meta.url` expression, which
 * would otherwise cause a parse error under the project's Babel CJS transform.
 */
export function createTranscriptionWorker(): Worker {
  return new Worker(new URL('./TranscriptionWorker.ts', import.meta.url), { type: 'module' })
}
