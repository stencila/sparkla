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
import {
  codeChunk,
  codeExpression,
  softwareEnvironment,
  softwareSession
} from '@stencila/schema'
import JWT from 'jsonwebtoken'
import { Manager } from './Manager'

let manager: Manager
let client: WebSocketClient
let address: WebSocketAddress

beforeAll(async () => {
  const url = process.env.MANAGER_URL
  if (url === undefined) {
    // Need to ensure a JWT secret is set
    if (process.env.JWT_SECRET === undefined) {
      process.env.JWT_SECRET = 'not-a-secret'
    }
    // Start a manager locally and get it's
    // address (which contains a JWT)
    manager = new Manager()
    await manager.start()
    address = manager.addresses().ws as WebSocketAddress
  } else {
    // Construct a "empty" JWT using the secret
    const secret = process.env.JWT_SECRET
    if (secret === undefined) {
      throw new Error('Environment variable JWT_SECRET must be set')
    }
    address = new WebSocketAddress({
      ...new WebSocketAddress(url),
      jwt: JWT.sign({}, secret)
    })
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
  if (client !== undefined) await client.stop()
  if (manager !== undefined) await manager.stop()
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
   * Begin a session, check it's properties, then
   * explicity end it before disconnecting
   */
  test('begin, end, disconnect', async () => {
    const client = new WebSocketClient(address)
    let session = await client.begin(softwareSession())
    expect(session).toHaveProperty('id')
    expect(session).toHaveProperty('dateStart')

    session = await client.end(session)
    expect(session).toHaveProperty('dateEnd')

    await client.stop()
  })

  /**
   * Begin a session and then disconnect without
   * explicitly ending it.
   */
  test('begin and disconnect', async () => {
    const client = new WebSocketClient(address)
    const session = await client.begin(softwareSession())
    expect(session).toHaveProperty('dateStart')

    await client.stop()
  })

  /**
   * Execute code expression with an implicitly created session
   */
  test('execute: Python CodeExpression with implicit session', async () => {
    const expr = await client.execute(
      codeExpression('7 * 6 + 32', {
        programmingLanguage: 'python'
      })
    )
    expect(expr).toHaveProperty('output')
    expect(expr.output).toEqual(74)
  })

  /**
   * Begin a session and execute some Python code in it
   */
  test('execute: Python CodeChunk within a session', async () => {
    const session = await client.begin(
      softwareSession({
        environment: softwareEnvironment('stencila/sparkla-ubuntu')
      })
    )
    let chunk

    chunk = await client.execute(
      codeChunk('a = 3', {
        programmingLanguage: 'python'
      }),
      session
    )
    expect(chunk).toHaveProperty('outputs')
    expect(chunk.outputs).toEqual([])

    chunk = await client.execute(
      codeChunk('a * 2', {
        programmingLanguage: 'python'
      }),
      session
    )
    expect(chunk).toHaveProperty('outputs')
    expect(chunk.outputs).toEqual([6])

    await client.end(session)
  })
})
