import { Manager } from './Manager'

beforeAll(() => {
  process.env.JWT_SECRET = 'not-a-secret-at-all'
})

test('can be constructed', () => {
  const manager = new Manager()
  expect(manager instanceof Manager).toBe(true)
})
