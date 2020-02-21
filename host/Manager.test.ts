import { Sparkla } from './Manager'

beforeAll(() => {
  process.env.JWT_SECRET = 'not-a-secret-at-all'
})

test('can be constructed', () => {
  const sparkla = new Sparkla()
  expect(sparkla instanceof Sparkla).toBe(true)
})

test('generate unique, route-able, session ids', () => {
  const sparkla = new Sparkla()

  const id = sparkla.generateSessionId()
  const match = /^[a-z]{2,5}:\/\/([^/]+)\/([^/]+)\/([^/]+)/.exec(id)
  expect(match).toBeDefined()
  if (match !== null) {
    expect(match[1]).toBe('0.0.0.0')
    expect(match[2]).toBe('127.0.0.1')
    expect(match[3]).toBe(sparkla.config.port.toString())
  }

  const anotherId = sparkla.generateSessionId()
  expect(anotherId).not.toEqual(id)
})

test('parse session ids so they can be routed to other managers', () => {
  const sparkla = new Sparkla()

  const parts = sparkla.parseSessionId(
    'ws://103.233.21.109/192.168.1.111/9000/bf3e3ea064f1b176ffd099f7442e4b8977003278997f4ee68803ad6e5d0b95f6'
  )
  expect(parts).toBeDefined()
  if (parts !== undefined) {
    const { scheme, globalIP, localIP, port } = parts
    expect(scheme).toBe('ws')
    expect(globalIP).toBe('103.233.21.109')
    expect(localIP).toBe('192.168.1.111')
    expect(port).toBe(9000)
  }
})

test('generate most-of-the-time-unique, human-friendly, session names', () => {
  const sparkla = new Sparkla()

  const name1 = sparkla.generateSessionName()
  const name2 = sparkla.generateSessionName()
  expect(name1).not.toEqual(name2)
})
