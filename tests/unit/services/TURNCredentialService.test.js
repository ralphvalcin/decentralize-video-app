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

test('returned server objects include numeric expires field', async () => {
  Object.assign(process.env, ENV)
  const svc = new TURNCredentialService()
  const config = await svc.getTURNCredentials('alice')
  expect(typeof config.servers[0].expires).toBe('number')
  expect(config.servers[0].expires).toBeGreaterThan(Date.now())
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
