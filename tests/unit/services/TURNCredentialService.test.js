import { TURNCredentialService } from '../../../src/services/TURNCredentialService.js'

const ENV = {
  TURN_SERVER_URL: 'turn.example.com',
  TURN_SECRET: 'secret-abc',
}

afterEach(() => {
  delete process.env.TURN_SERVER_URL
  delete process.env.TURN_SECRET
  delete process.env.TURN_SERVER_URL_2
  delete process.env.TURN_SECRET_2
})

test('server objects returned to caller do not contain expires field', async () => {
  Object.assign(process.env, { TURN_SERVER_URL: 'turn.example.com', TURN_SECRET: 'secret' })
  const svc = new TURNCredentialService()
  const config = await svc.getTURNCredentials('alice')
  config.servers.forEach(server => {
    expect(server).not.toHaveProperty('expires')
  })
})

test('cache key incorporates both server URLs when two servers configured', async () => {
  Object.assign(process.env, {
    TURN_SERVER_URL: 'turn1.example.com',
    TURN_SECRET: 'secret-1',
    TURN_SERVER_URL_2: 'turn2.example.com',
    TURN_SECRET_2: 'secret-2',
  })
  const svc = new TURNCredentialService()
  await svc.getTURNCredentials('alice')
  const keys = [...svc.credentialCache.keys()]
  expect(keys[0]).toContain('turn1.example.com')
  expect(keys[0]).toContain('turn2.example.com')
})

test('both servers appear in returned config when two servers configured', async () => {
  Object.assign(process.env, {
    TURN_SERVER_URL: 'turn1.example.com',
    TURN_SECRET: 'secret-1',
    TURN_SERVER_URL_2: 'turn2.example.com',
    TURN_SECRET_2: 'secret-2',
  })
  const svc = new TURNCredentialService()
  const config = await svc.getTURNCredentials('alice')
  expect(config.servers).toHaveLength(2)
  expect(config.servers[0].urls[0]).toContain('turn1.example.com')
  expect(config.servers[1].urls[0]).toContain('turn2.example.com')
  expect(config.servers[0].username).toBeTruthy()
  expect(config.servers[0].credential).toBeTruthy()
  expect(config.servers[1].username).toBeTruthy()
  expect(config.servers[1].credential).toBeTruthy()
})

test('secondary-only config returns one server with URL_2 hostname', async () => {
  Object.assign(process.env, {
    TURN_SERVER_URL_2: 'turn2.example.com',
    TURN_SECRET_2: 'secret-2',
  })
  const svc = new TURNCredentialService()
  const config = await svc.getTURNCredentials('alice')
  expect(config.servers).toHaveLength(1)
  expect(config.servers[0].urls[0]).toContain('turn2.example.com')
  expect(config.servers[0].username).toBeTruthy()
  expect(config.servers[0].credential).toBeTruthy()
  const keys = [...svc.credentialCache.keys()]
  expect(keys[0]).toContain('turn2.example.com')
})

test('returns empty servers array when no env vars set', async () => {
  // No TURN_SERVER_URL or TURN_SERVER_URL_2 set
  const svc = new TURNCredentialService()
  const config = await svc.getTURNCredentials('alice')
  expect(config.servers).toHaveLength(0)
  // Nothing cached — empty servers skip the cache.set() call
  expect(svc.credentialCache.size).toBe(0)
})

test('cache key is based on server URL — two users share one cache entry', async () => {
  Object.assign(process.env, ENV)
  const svc = new TURNCredentialService()
  await svc.getTURNCredentials('alice')
  await svc.getTURNCredentials('bob')
  expect(svc.credentialCache.size).toBe(1)
})

test('second call within TTL returns cached result without regenerating', async () => {
  Object.assign(process.env, ENV)
  const svc = new TURNCredentialService()
  const genSpy = jest.spyOn(svc, 'generateTURNCredentials')
  await svc.getTURNCredentials('alice')
  await svc.getTURNCredentials('alice')
  expect(genSpy).toHaveBeenCalledTimes(1)
})

test('cache miss after manual expiry regenerates credentials', async () => {
  Object.assign(process.env, ENV)
  const svc = new TURNCredentialService()
  await svc.getTURNCredentials('alice')
  const [key, entry] = [...svc.credentialCache.entries()][0]
  svc.credentialCache.set(key, { ...entry, expires: Date.now() - 1000 })
  const genSpy = jest.spyOn(svc, 'generateTURNCredentials')
  await svc.getTURNCredentials('alice')
  expect(genSpy).toHaveBeenCalledTimes(1)
})
