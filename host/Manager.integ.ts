/**
 * Integration tests using Executa clients to connect to
 * a local, or remote, instance of Sparkla `Manager`.
 *
 * To run against a remote instance set the `MANAGER_URL`
 * and `JWT_SECRET` environment variables e.g.
 *
 * ```bash
 * MANAGER_URL=12.34.56.78:9000 JWT_SECRET=not-a-secret npx jest Manager.integ.ts
 * ```
 */

import { WebSocketAddress, WebSocketClient } from '@stencila/executa'
import { Manager } from './Manager'
import { DockerSession } from './DockerSession'
import {
  softwareSession,
  environment,
  codeChunk,
  SoftwareSession,
  CodeChunk
} from '@stencila/schema'
import JWT from 'jsonwebtoken'

let manager: Manager
let client: WebSocketClient

beforeAll(async () => {
  const url = process.env.MANAGER_URL
  let address: WebSocketAddress
  if (url === undefined) {
    // Need to ensure a JWT secret is set
    if (process.env.JWT_SECRET === undefined) {
      process.env.JWT_SECRET = 'not-a-secret'
    }
    // Start a manager locally and get it's
    // address (which contains a JWT)
    manager = new Manager(DockerSession)
    await manager.start()
    address = manager.addresses().ws as WebSocketAddress
  } else {
    // Construct a "empty" JWT using the secret
    const secret = process.env.JWT_SECRET
    if (secret === undefined) {
      throw new Error('Environment variable JWT_SECRET must be set')
    }
    const jwt = JWT.sign({}, secret)
    address = new WebSocketAddress(url, '', jwt)
  }
  console.info(
    `Connecting to manager with address:\n${JSON.stringify(
      address,
      null,
      '  '
    )}`
  )
  client = new WebSocketClient(address)
})

afterAll(async () => {
  if (manager !== undefined) await manager.stop()
  if (client !== undefined) await client.stop()
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
