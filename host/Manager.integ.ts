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
  softwareEnvironment,
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

// Allow up to 5 minutes for this test
jest.setTimeout(5 * 60 * 1000)

describe('Manager', () => {
  /**
   * Get the manager's manifest, and check it has
   * the expected properties
   */
  test('manifest', async () => {
    const manifest = await client.manifest()
    expect(manifest).toHaveProperty('addresses')
    expect(manifest).toHaveProperty('capabilities')
  })

  /**
   * Begin a session, check it's properties, then end it
   * and check it really is ended using manager's
   */
  test('begin and end: SoftwareSession', async () => {
    let session = await client.begin(
      softwareSession(softwareEnvironment('stencila/sparkla-alpine'))
    )
    expect(session).toHaveProperty('id')
    expect(session).toHaveProperty('began')

    session = await client.end(session)
    expect(session).toHaveProperty('ended')
  })

  /**
   * Begin a session and execute some Python code in it
   */
  test('execute: Python CodeChunk in Ubuntu environment', async () => {
    const session = await client.begin(
      softwareSession({
        environment: softwareEnvironment('stencila/sparkla-ubuntu')
      })
    )
    let chunk

    // TODO: Reinstate when `StreamClient` is working with dockerode

    /* chunk = (await client.execute(
      codeChunk('a = 3', {
        programmingLanguage: 'python'
      })
    )) as CodeChunk
    expect(chunk).toHaveProperty('outputs')
    expect(chunk.outputs).toEqual([])

    chunk = (await client.execute(
      codeChunk('a * 2', {
        programmingLanguage: 'python'
      })
    )) as CodeChunk
    expect(chunk).toHaveProperty('outputs')
    expect(chunk.outputs).toEqual([6])


    await client.end(session) */
  })
})
