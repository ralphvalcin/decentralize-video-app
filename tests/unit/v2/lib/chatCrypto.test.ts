import { deriveKey, encryptMessage, decryptMessage } from '../../../../src/v2/lib/chatCrypto'

describe('chatCrypto', () => {
  let key: CryptoKey

  beforeAll(async () => {
    key = await deriveKey('test-room', 'test-secret')
  })

  test('round-trip: encrypt then decrypt returns original text', async () => {
    const ciphertext = await encryptMessage('Hello, world!', key)
    const plaintext = await decryptMessage(ciphertext, key)
    expect(plaintext).toBe('Hello, world!')
  })

  test('round-trip: empty string', async () => {
    const ciphertext = await encryptMessage('', key)
    const plaintext = await decryptMessage(ciphertext, key)
    expect(plaintext).toBe('')
  })

  test('encryptMessage returns a non-empty base64 string different from plaintext', async () => {
    const ciphertext = await encryptMessage('secret', key)
    expect(ciphertext).toBeTruthy()
    expect(ciphertext).not.toBe('secret')
    expect(ciphertext).toMatch(/^[A-Za-z0-9+/=]+$/)
  })

  test('wrong key: decrypting with a different derived key throws', async () => {
    const otherKey = await deriveKey('different-room', 'different-secret')
    const ciphertext = await encryptMessage('Hello', key)
    await expect(decryptMessage(ciphertext, otherKey)).rejects.toThrow()
  })

  test('deterministic derivation: same inputs produce keys that interoperate', async () => {
    const keyA = await deriveKey('room-xyz', 'secret-abc')
    const keyB = await deriveKey('room-xyz', 'secret-abc')
    const ciphertext = await encryptMessage('test', keyA)
    const plaintext = await decryptMessage(ciphertext, keyB)
    expect(plaintext).toBe('test')
  })

  test('decryptMessage throws on corrupted base64 ciphertext', async () => {
    await expect(decryptMessage('not-valid-base64!!', key)).rejects.toThrow()
  })

  test('decryptMessage throws on truncated input (IV only, no ciphertext)', async () => {
    // 12 bytes of IV only, base64-encoded — no ciphertext or GCM tag
    const ivOnly = btoa(String.fromCharCode(...new Uint8Array(12)))
    await expect(decryptMessage(ivOnly, key)).rejects.toThrow()
  })
})
