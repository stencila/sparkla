/**
 * Integration tests using Executa clients to connect to
 * a local, or remote, instance of Sparkla `Manager`.
 *
 * To run against a remote instance set the `MANAGER_URL`
 * env var e.g.
 *
 * ```bash
 * MANAGER_URL=123.3.54.12:9000 jest Manager.integ.ts
 * ```
 */

import { WebSocketClient } from '@stencila/executa'
import { Manager } from './Manager'
import { DockerSession } from './DockerSession'
import { WebSocketAddress } from '@stencila/executa/dist/lib/base/Transports'
import {
  softwareSession,
  environment,
  codeChunk,
  SoftwareSession,
  CodeChunk
} from '@stencila/schema'

let manager: Manager
let client: WebSocketClient

let url = process.env.MANAGER_URL
// TODO: a way of easily setting this per target Manager
const jwt =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1NzE4MDcxMDh9.q181aVgHK9VLzYvVYkCAIZbHuCKDzhndBYr0fYMs_ko'

beforeAll(async () => {
  if (url === undefined) {
    process.env.JWT_SECRET = 'not-a-secret'
    url = '127.0.0.1:9000'

    manager = new Manager(DockerSession)
    await manager.start()
  }
  client = new WebSocketClient(new WebSocketAddress(url, '', jwt))
})

afterAll(async () => {
  if (manager !== undefined) await manager.stop()
  // TODO: In Executa add stop() method to WebSocketClient
  // if (client !== undefined) await client.stop()
})

jest.setTimeout(5 * 60 * 1000)

describe('Manager', () => {
  test('manifest', async () => {
    const manifest = await client.manifest()
    expect(manifest).toHaveProperty('addresses')
    expect(manifest).toHaveProperty('capabilities')
  })

  test('begin', async () => {
    const session = await client.begin(
      softwareSession(environment('stencila/sparkla-alpine'))
    )
    expect(session).toHaveProperty('id')
    expect(session).toHaveProperty('began')
  })

  test('execute', async () => {
    const session = (await client.begin(
      softwareSession(environment('stencila/sparkla-ubuntu'))
    )) as SoftwareSession
    let chunk

    chunk = (await client.execute(
      codeChunk('a = 3', {
        programmingLanguage: 'python'
      }),
      session
    )) as CodeChunk
    expect(chunk).toHaveProperty('outputs')
    expect(chunk.outputs).toEqual([])

    chunk = (await client.execute(
      codeChunk('a * 2', {
        programmingLanguage: 'python'
      }),
      session
    )) as CodeChunk
    expect(chunk).toHaveProperty('outputs')
    expect(chunk.outputs).toEqual([6])
  })
})
