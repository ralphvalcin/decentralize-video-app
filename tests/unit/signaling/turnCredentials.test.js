// Mock heavy server-side dependencies before importing signaling-server
jest.mock('dompurify', () => () => ({ sanitize: (x) => x }));
jest.mock('jsdom', () => ({ JSDOM: jest.fn(() => ({ window: {} })) }));
jest.mock('socket.io', () => ({ Server: jest.fn(() => ({ use: jest.fn(), on: jest.fn() })) }));
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('jsonwebtoken', () => ({ sign: jest.fn(() => 'tok'), verify: jest.fn(() => ({})) }));
jest.mock('../../../src/services/TURNCredentialService.js', () => ({
  TURNCredentialService: jest.fn().mockImplementation(() => ({})),
}));

import { handleTurnCredentialsRequest, validateTURNConfig } from '../../../signaling-server.js'

function makeSocket(id = 'socket-1') {
  return {
    id,
    emit: jest.fn(),
    handshake: { headers: { 'user-agent': 'jest' }, address: '127.0.0.1' },
  }
}

const deps = {
  users: {},
  rateLimiter: { checkLimit: jest.fn(() => true) },
  turnCredentialService: {
    getTURNCredentials: jest.fn(async () => ({
      servers: [{ urls: ['turn:example.com:3478'], username: 'u', credential: 'p' }],
    })),
  },
  performanceMonitor: { recordError: jest.fn(), recordMessage: jest.fn() },
  logSecurityEvent: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  deps.users = {}
  deps.rateLimiter.checkLimit.mockReturnValue(true)
})

test('emits AUTH_REQUIRED when socket has not joined', async () => {
  const socket = makeSocket()
  await handleTurnCredentialsRequest(socket, deps)
  expect(socket.emit).toHaveBeenCalledWith('turn-credentials-error', expect.objectContaining({ code: 'AUTH_REQUIRED' }))
  expect(deps.rateLimiter.checkLimit).not.toHaveBeenCalled()
})

test('emits RATE_LIMIT_EXCEEDED when joined but over limit', async () => {
  const socket = makeSocket()
  deps.users['socket-1'] = { id: 'user-1' }
  deps.rateLimiter.checkLimit.mockReturnValue(false)
  await handleTurnCredentialsRequest(socket, deps)
  expect(socket.emit).toHaveBeenCalledWith('turn-credentials-error', expect.objectContaining({ code: 'RATE_LIMIT_EXCEEDED' }))
})

test('emits turn-credentials when joined and within rate limit', async () => {
  const socket = makeSocket()
  deps.users['socket-1'] = { id: 'user-1' }
  await handleTurnCredentialsRequest(socket, deps)
  expect(socket.emit).toHaveBeenCalledWith('turn-credentials', expect.objectContaining({ servers: expect.any(Array) }))
})

test('emits NO_TURN_SERVERS when service returns empty servers array', async () => {
  const socket = makeSocket()
  deps.users['socket-1'] = { id: 'user-1' }
  deps.turnCredentialService.getTURNCredentials.mockResolvedValueOnce({ servers: [] })
  await handleTurnCredentialsRequest(socket, deps)
  expect(socket.emit).toHaveBeenCalledWith('turn-credentials-error', expect.objectContaining({ code: 'NO_TURN_SERVERS' }))
})

describe('validateTURNConfig', () => {
  beforeEach(() => {
    delete process.env.TURN_SERVER_URL
    delete process.env.TURN_SECRET
    delete process.env.TURN_SERVER_URL_2
    delete process.env.TURN_SECRET_2
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => { jest.restoreAllMocks() })

  test('warns STUN only when no vars set', () => {
    validateTURNConfig()
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('STUN only'))
  })

  test('warns when primary URL is set but secret is missing', () => {
    process.env.TURN_SERVER_URL = 'turn.example.com'
    validateTURNConfig()
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('secret is missing'))
  })

  test('warns when primary secret is set but URL is missing', () => {
    process.env.TURN_SECRET = 'secret'
    validateTURNConfig()
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('URL'))
  })

  test('errors when primary URL contains invalid characters', () => {
    process.env.TURN_SERVER_URL = 'turn://bad url!'
    process.env.TURN_SECRET = 'a'.repeat(32)
    validateTURNConfig()
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('does not look like a valid hostname'))
  })

  test('warns when secret is shorter than 16 chars', () => {
    process.env.TURN_SERVER_URL = 'turn.example.com'
    process.env.TURN_SECRET = 'short'
    validateTURNConfig()
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('only 5 chars'))
  })

  test('logs success for primary server when valid', () => {
    process.env.TURN_SERVER_URL = 'turn.example.com'
    process.env.TURN_SECRET = 'a'.repeat(32)
    validateTURNConfig()
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('turn.example.com'))
  })

  test('logs success for secondary-only config without warning STUN only', () => {
    process.env.TURN_SERVER_URL_2 = 'turn2.example.com'
    process.env.TURN_SECRET_2 = 'a'.repeat(32)
    validateTURNConfig()
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('turn2.example.com'))
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('STUN only'))
  })

  test('logs success for both servers when both valid', () => {
    process.env.TURN_SERVER_URL = 'turn1.example.com'
    process.env.TURN_SECRET = 'a'.repeat(32)
    process.env.TURN_SERVER_URL_2 = 'turn2.example.com'
    process.env.TURN_SECRET_2 = 'b'.repeat(32)
    validateTURNConfig()
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('turn1.example.com'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('turn2.example.com'))
  })
})
