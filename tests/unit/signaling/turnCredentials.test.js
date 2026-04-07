// Mock heavy server-side dependencies before importing signaling-server
jest.mock('dompurify', () => () => ({ sanitize: (x) => x }));
jest.mock('jsdom', () => ({ JSDOM: jest.fn(() => ({ window: {} })) }));
jest.mock('socket.io', () => ({ Server: jest.fn(() => ({ use: jest.fn(), on: jest.fn() })) }));
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('jsonwebtoken', () => ({ sign: jest.fn(() => 'tok'), verify: jest.fn(() => ({})) }));
jest.mock('../../../src/services/TURNCredentialService.js', () => ({
  TURNCredentialService: jest.fn().mockImplementation(() => ({})),
}));

import { handleTurnCredentialsRequest } from '../../../signaling-server.js'

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
