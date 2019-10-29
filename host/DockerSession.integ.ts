import { DockerSession } from './DockerSession'
import { softwareSession, volumeMount } from '@stencila/schema'

// Allow up to 5 minutes for this test
jest.setTimeout(5 * 60 * 1000)

// Stop all sessions before and after tests
// just in case they were not stopped by calling end()
beforeAll(async () => {
  await DockerSession.stop()
})
afterAll(async () => {
  await DockerSession.stop()
})

const sessionCount = async (): Promise<number> =>
  (await DockerSession.list()).length

describe('begin + end', () => {
  const instance = new DockerSession()

  test('defaults', async () => {
    const session = softwareSession()
    await instance.begin(session)
    expect(await sessionCount()).toBe(1)
    await instance.end(session)
    expect(await sessionCount()).toBe(0)
  })

  test('volumeMount', async () => {
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
