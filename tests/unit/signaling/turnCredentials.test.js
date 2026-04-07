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
  const origEnv = { ...process.env }
  beforeEach(() => {
    delete process.env.TURN_SERVER_URL
    delete process.env.TURN_SECRET
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    Object.assign(process.env, origEnv)
    jest.restoreAllMocks()
  })

  test('warns when both vars are missing', () => {
    validateTURNConfig()
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('STUN only'))
  })

  test('warns when URL is set but secret is missing', () => {
    process.env.TURN_SERVER_URL = 'turn.example.com'
    validateTURNConfig()
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('TURN_SECRET is not set'))
  })

  test('warns when secret is set but URL is missing', () => {
    process.env.TURN_SECRET = 'secret'
    validateTURNConfig()
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('TURN_SERVER_URL is not set'))
  })

  test('errors when URL contains invalid characters', () => {
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

  test('logs success when both vars are valid', () => {
    process.env.TURN_SERVER_URL = 'turn.example.com'
    process.env.TURN_SECRET = 'a'.repeat(32)
    validateTURNConfig()
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('turn.example.com'))
  })
})
