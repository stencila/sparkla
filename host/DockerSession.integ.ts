import { DockerSession } from './DockerSession'
import {
  softwareSession,
  volumeMount,
  codeChunk,
  codeExpression
} from '@stencila/schema'

// Allow up to 5 minutes for this test
jest.setTimeout(5 * 60 * 1000)

// End all sessions before and after tests
// just in case they were not stopped by calling end()
beforeAll(async () => {
  await DockerSession.endAll()
})
afterAll(async () => {
  await DockerSession.endAll()
})

const sessionCount = async (): Promise<number> =>
  (await DockerSession.list()).length

describe('begin + end', () => {
  test('defaults', async () => {
    const instance = new DockerSession()
    const session = softwareSession()
    await instance.begin(session)
    expect(await sessionCount()).toBe(1)
    await instance.end(session)
    expect(await sessionCount()).toBe(0)
  })

  test('volumeMount', async () => {
    const instance = new DockerSession()
    const session = softwareSession({
      volumeMounts: [
        volumeMount('/mount/dir', {
          mountSource: '/tmp'
        })
      ]
    })
    await instance.begin(session)

    const sessions = await DockerSession.list()
    expect(sessions.length).toBe(1)
    const mounts = sessions[0].volumeMounts
    expect(mounts).toEqual(session.volumeMounts)

    await instance.end(session)
  })
})

describe('execute', () => {
  test('defaults', async () => {
    const instance = new DockerSession()
    const session = softwareSession()
    await instance.begin(session)

    const expr = await instance.execute(
      codeExpression('6 * 7', { programmingLanguage: 'python' })
    )
    expect(expr).toEqual({
      type: 'CodeExpression',
      programmingLanguage: 'python',
      text: '6 * 7',
      output: 42
    })

    await instance.end(session)
  })
})
