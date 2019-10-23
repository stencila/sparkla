import { Manager } from './Manager'
import { DockerSession } from './DockerSession'

beforeAll(() => {
  process.env.JWT_SECRET = 'not-a-secret-at-all'
})

test('can be constructed', () => {
  const manager = new Manager(DockerSession)
  expect(manager instanceof Manager).toBe(true)
})
