import { AggregationType, globalStats, MeasureUnit } from '@opencensus/core'
import {
  BaseExecutor,
  Capabilities,
  User,
  WebSocketClient,
  Manifest,
  WebSocketAddress
} from '@stencila/executa'
import { getLogger } from '@stencila/logga'
import {
  codeError,
  date,
  isA,
  Node,
  softwareEnvironment,
  SoftwareSession,
  softwareSession
} from '@stencila/schema'
import crypto from 'crypto'
// @ts-ignore
import discoveryChannel from 'discovery-channel'
// @ts-ignore
import moniker from 'moniker'
import { performance } from 'perf_hooks'
import { Config } from './Config'
import { DockerSession } from './DockerSession'
import { FirecrackerSession } from './FirecrackerSession'
import { ManagerServer } from './ManagerServer'
import { Session } from './Session'
import { globalIP, localIP, optionalMin } from './util'
import { Peer } from '@stencila/executa/dist/lib/base/BaseExecutor'

const log = getLogger('sparkla:manager')
const statusTagKey = { name: 'status' }

const sessionsMeasure = globalStats.createMeasureInt64(
  'sparkla/sessions_count',
  MeasureUnit.UNIT,
  'The number of sessions running'
)

const sessionsCountView = globalStats.createView(
  'sparkla/view_sessions_count',
  sessionsMeasure,
  AggregationType.COUNT,
  [statusTagKey],
  'The number of sessions running'
)
globalStats.registerView(sessionsCountView)

const executionDurationMeasure = globalStats.createMeasureDouble(
  'sparkla/session_execution_duration',
  MeasureUnit.MS,
  'The time taken to execute a node'
)

const executionDurationView = globalStats.createView(
  'sparkla/view_session_execution_duration',
  executionDurationMeasure,
  AggregationType.LAST_VALUE,
  [statusTagKey],
  'The time taken to execute a node'
)
globalStats.registerView(executionDurationView)

function recordSessionsCount(sessions: object): void {
  globalStats.record([
    { measure: sessionsMeasure, value: Object.keys(sessions).length }
  ])
}

export interface SessionType {
  new (): FirecrackerSession | DockerSession
}

export interface SessionInfo {
  /**
   * The `SoftwareSession` node.
   */
  node: SoftwareSession

  /**
   * The session instance.
   */
  instance: Session

  /**
   * The user that began this session.
   */
  user: User

  /**
   * The clients that have used this session.
   */
  clients: string[]

  /**
   * The start date/time for the session.
   * Same as `node.dateStart` but as a `number`
   * for quicker and easier calculation of session
   * duration.
   */
  dateStart: number

  /**
   * The last date/time that activity was
   * recorded for the session.
   */
  dateLast: number
}

export class Manager extends BaseExecutor {
  /**
   * Configuration options
   */
  public readonly config: Config

  /**
   * Global and local IP addresses used for assigning
   * session URIs.
   */
  private ips: [string, string] = ['0.0.0.0', '127.0.0.1']

  /**
   * The peer discovery channel.
   *
   * @see {@link Manager.discoveryFunction}
   */
  private peerChannel: discoveryChannel.Discovery

  /**
   * The status of peers discovered in channel
   *
   * Used to avoid unnecessarily fetching peer manifest:
   *
   *  - `false` = host+port is not a Sparkla peer
   *  - `true` = host+port has already been added as a peer
   */
  protected peerStatus: { [key: string]: boolean } = {}

  /**
   * The default `SoftwareSession` node.
   *
   * This default is merged with the `session` argument provided to the
   * `begin()` method. So missing properties, will be replaced by these
   * defaults.
   *
   * These defaults are still subject to the session limits
   * specified in the the `limits` argument of the `begin()` method
   * (and usually supplied via a JWT).
   */
  public readonly sessionDefault: SoftwareSession = softwareSession({
    cpuRequest: 1, // 1 CPU
    memoryRequest: 1, // 1 GiB
    durationRequest: 6 * 3600, // 6hr
    timeoutRequest: 1 * 3600, // 1hr
    environment: softwareEnvironment('stencila/sparkla-ubuntu-midi')
  })

  /**
   * Session info mapped to session node id.
   *
   * This allows for fast delegation to the session instance
   * in the `execute()` and `end()` methods.
   */
  public readonly sessions: { [key: string]: SessionInfo } = {}

  constructor(config: Config = new Config()) {
    super(
      // Custom discovery function to discover peer instances
      [() => this.discoveryFunction()],
      // WebSocket client for delegating requests to
      // peers
      [WebSocketClient],
      // WebSocket server for receiving requests
      // from browser based clients (also provides HTTP endpoints)
      [new ManagerServer(config.host, config.port, config.jwtSecret)]
    )

    this.config = config
  }

  /**
   * Declaration of capabilities.
   *
   * At present, just declare that capable of all methods
   * since actual capabilities will be determined by
   * sessions delegated to.
   */
  public capabilities(): Promise<Capabilities> {
    return Promise.resolve({
      decode: true,
      encode: true,
      compile: true,
      build: true,
      execute: true,
      begin: true,
      end: true
    })
  }

  /**
   * @override Override of {@link BaseExecutor.start} to
   * configure,  startup intervals, etc
   */
  public async start(): Promise<void> {
    const { host, expiryInterval, staleInterval } = this.config

    // Get IP addresses
    this.ips = [await globalIP(), localIP()]

    // Start peer discovery if not listening on local loopback
    if (host !== '127.0.0.1') await this.discover()

    // Begin checking for expired and stale sessions
    setInterval(() => this.endExpired(), expiryInterval * 1000)
    setInterval(() => this.removeStale(), staleInterval * 1000)

    return super.start()
  }

  /**
   * @override Override of {@link BaseExecutor.stop} to
   * leave the discovery channel (in addition to stopping server).
   */
  public async stop(): Promise<void> {
    if (this.peerChannel !== undefined)
      await new Promise(resolve => this.peerChannel.destroy(resolve))
    return super.stop()
  }

  /**
   * Generate a unique URI for a session that allows for
   * routing back to this manager instance.
   */
  public generateSessionId(): string {
    const [globalIP, localIP] = this.ips
    const port = this.config.port
    const rand = crypto.randomBytes(32).toString('hex')
    return `ws://${globalIP}/${localIP}/${port}/${rand}`
  }

  /**
   * Parse a session id to extract the IP addresses of the
   * host manager (so that connections can be routed through to it).
   */
  public parseSessionId(
    id: string
  ): {
    scheme: string
    globalIP: string
    localIP: string
    port: number
  } | void {
    const match = /^([a-z]{2,5}):\/\/([^/]+)\/([^/]+)\/([^/]+)/.exec(id)
    if (match !== null) {
      const [_, scheme, globalIP, localIP, port] = match
      return { scheme, globalIP, localIP, port: parseInt(port) }
    }
  }

  /**
   * Generate a human-friendly name for a session.
   */
  public generateSessionName(): string {
    return moniker.choose()
  }

  /**
   * A custom discovery function that sets up
   * `peerChannel` and adds peers when they are discovered.
   *
   * This function does not actually return any manifests,
   * instead, as peers are discovered, their manifests are fetched
   * and added to `this.peers`.
   */
  protected discoveryFunction(): Promise<Manifest[]> {
    const { port, peerSwarm } = this.config
    if (peerSwarm === null) return Promise.resolve([])

    const channel = (this.peerChannel = discoveryChannel())
    channel.join(peerSwarm, port)
    channel.on(
      'peer',
      async (
        channelId: Buffer,
        peer: { host: string; port: number },
        type: 'dns' | 'dht'
      ) => {
        const { host, port } = peer
        const url = `ws://${host}:${port}`

        // Skip if already passed / failed this peer
        if (this.peerStatus[url] !== undefined) return

        // Do not connect to self
        if (this.ips.includes(host)) {
          const thisPort = new WebSocketAddress(this.addresses().ws).port
          if (port === thisPort) {
            this.peerStatus[url] = false
            return
          }
        }

        // Only add a peer if able to connect to it and get its manifest
        // necessary to get its id. Client settings that avoid noisy logs
        // and that fail quickly
        const client = new WebSocketClient(url, undefined, {
          logging: false,
          timeout: 10,
          retries: 0
        })
        let manifest
        try {
          manifest = await client.manifest()
        } catch (error) {
          log.warn(`Failed to get peer manifest: ${url}:  ${error.message}`)
          this.peerStatus[url] = false
          return
        }

        // Check that the peer is not already added (the 'peer' event can emit duplicates
        // for the same peer, and a peer can have events for both it's local and global IPs
        // e.g. 192.168.1.111 from multicast DNS, 103.233.21.109 from DHT)
        const { id } = manifest
        let add = id !== this.id // not self check again
        if (add) {
          for (const peer of this.peers) {
            if (peer.manifest.id === id) {
              add = false
              break
            }
          }
        }
        if (add) {
          log.info(`Peer discovered: ${type} ${host}:${port}`)
          this.peers.push(new Peer(manifest, []))
          this.peerStatus[url] = true
        }
      }
    )
    return Promise.resolve([])
  }

  public async begin<NodeType extends Node>(
    node: NodeType,
    user: User = {}
  ): Promise<NodeType> {
    if (isA('SoftwareSession', node)) {
      if (node.dateStart !== undefined) {
        // Session has already begun, so just return the session unaltered
        return node
      } else {
        // Session needs to be started...

        // The requested session overrides the properties of the
        // default session (or, to put it the other way around, the
        // default fills in the missing properties of the requested)
        // @ts-ignore TS2698: Spread types may only be created from object types
        const sessionRequested = { ...this.sessionDefault, ...node }

        // The `user.session` overrides the properties of the
        // requested session. Usually `cpuLimit` etc are not in a request,
        // but in case they are, we override them here.
        const sessionPermitted = { ...sessionRequested, ...user.session }

        let { id, name } = sessionPermitted

        // Assign a identifier and name if necessary
        if (id === undefined) id = this.generateSessionId()
        if (name === undefined) name = this.generateSessionName()

        // Record the client that started the session
        const clientId = user.client !== undefined ? user.client.id : undefined

        // Actually start the session and return the updated
        // `SoftwareSession` node.
        const instance =
          this.config.sessionType === 'docker'
            ? new DockerSession()
            : new FirecrackerSession()
        const dateStart = date(new Date().toISOString())
        const begunSession = await instance.begin({
          ...sessionPermitted,
          id,
          name,
          dateStart,
          status: 'started'
        })

        // Store and record it's addition
        const now = Date.now() / 1000
        this.sessions[id] = {
          node: begunSession,
          instance,
          user,
          clients: clientId !== undefined ? [clientId] : [],
          dateStart: now,
          dateLast: now
        }
        recordSessionsCount(this.sessions)

        return begunSession as NodeType
      }
    }
    return node
  }

  public async execute<NodeType extends Node>(
    node: NodeType,
    session?: SoftwareSession,
    user: User = {}
  ): Promise<NodeType> {
    if (isA('CodeChunk', node) || isA('CodeExpression', node)) {
      // Use the default session if none is provided
      if (session === undefined) session = this.sessionDefault

      // Make sure the session is started
      let { id } = session
      if (id === undefined) {
        // Start the session...
        ;({ id } = await this.begin(session))
      }
      if (id === undefined) {
        // This should never happen; if it does there is a bug in begin()
        log.error(`No id assigned to session`)
        return node
      }

      const sessionInfo = this.sessions[id]
      if (sessionInfo === undefined) {
        // Client is requesting a session that has already ended
        // and been removed
        return {
          // @ts-ignore TS2698: Spread types may only be created from object types
          ...node,
          errors: [
            codeError('error', {
              message: 'Session has ended'
            })
          ]
        }
      }

      const {
        node: { status, description, clientsRequest },
        instance,
        clients
      } = sessionInfo

      if (status === 'stopped') {
        let message = 'Session has ended.'
        if (typeof description === 'string') message += ' ' + description
        // @ts-ignore TS2698: Spread types may only be created from object types
        return { ...node, errors: [codeError('error', { message })] }
      }

      // Check that the maximum number of concurrent clients has not yet been reached
      const clientId = user.client !== undefined ? user.client.id : undefined
      if (clientId !== undefined && !clients.includes(clientId)) {
        const sessionPermitted: SoftwareSession = {
          type: 'SoftwareSession',
          ...user.session
        }
        const maxClients = optionalMin(
          clientsRequest,
          sessionPermitted.clientsLimit
        )
        if (maxClients !== undefined && clients.length >= maxClients) {
          return {
            // @ts-ignore TS2698: Spread types may only be created from object types
            ...node,
            errors: [
              codeError('error', {
                message: 'Maximum number of clients already using this session'
              })
            ]
          }
        } else {
          clients.push(clientId)
        }
      }

      // Execute the node in the session
      const executeBefore = performance.now()
      const processedNode = (await instance.execute(node)) as NodeType
      globalStats.record([
        {
          measure: executionDurationMeasure,
          value: performance.now() - executeBefore
        }
      ])

      // Record the activity
      sessionInfo.dateLast = Date.now() / 1000

      return processedNode
    }
    return node
  }

  /**
   * End a node (usually a `SoftwareSession`)
   *
   * @param node The node to end
   * @param user The user that is ending the node
   * @param notify Notify clients that the session will be ended?
   * @param reason The reason for ending the session
   */

  // eslint-disable-next-line @typescript-eslint/require-await
  public async end<NodeType extends Node>(
    node: NodeType,
    user: User = {},
    notify = true,
    reason?: string
  ): Promise<NodeType> {
    if (isA('SoftwareSession', node)) {
      const { id: sessionId } = node
      if (sessionId === undefined) {
        // If this happens, it's probably due to a bug in the client
        log.warn('When ending session, no session id provided')
        return node
      }

      const sessionInfo = this.sessions[sessionId]
      if (sessionInfo === undefined) {
        // If this happens, it's probably due to a bug in the client
        log.warn(`When ending session, session with id not found: ${sessionId}`)
        return node
      }
      const { instance, clients } = sessionInfo

      // Notify clients that the session has ended and
      if (notify !== false) {
        let message = `Ending session "${node.name}".`
        if (typeof reason === 'string') message += ' ' + reason
        this.notify('info', message, node, clients)
      }

      // End the session node and store it
      const endedSession = softwareSession({
        // @ts-ignore TS2698: Spread types may only be created from object types
        ...node,
        dateEnd: date(new Date().toISOString()),
        status: 'stopped',
        description: reason
      })
      sessionInfo.node = endedSession

      // Stop the session instance without awating
      instance.end(endedSession).catch(error => log.error(error))

      return endedSession as NodeType
    }
    return node
  }

  /**
   * Remove a client from sessions and end each one if there are
   * no other clients using it.
   *
   * In the future we will record all clients using a session
   * (i.e. calling `execute`) so that a session is ended when all
   * clients disconnect.
   *
   * @param clientId The id of the client
   */
  public endClient(clientId: string): Promise<SoftwareSession[]> {
    return Promise.all(
      Object.entries(this.sessions).map(
        ([sessionId, { node, user, clients }]) => {
          if (clients.includes(clientId)) {
            if (clients.length === 1) {
              // Only end session if it was not started by admin
              // @ts-ignore that admin is not a property of user
              if (user.admin !== true) return this.end(node, undefined, false)
            } else
              this.sessions[sessionId].clients = clients.filter(
                id => id !== clientId
              )
          }
          return Promise.resolve(node)
        }
      )
    )
  }

  /**
   * End expired sessions that have either:
   *
   *  - exceeded their maximum duration
   *  - exceeded their inactivity timeout
   *
   * It will also send a warning to clients if approaching
   * either of these.
   */
  protected endExpired(): void {
    const {
      sessions,
      config: { durationWarning, timeoutWarning }
    } = this
    Object.entries(sessions).map(
      ([sessionId, { node, dateStart, dateLast, clients }]) => {
        const {
          status,
          durationRequest,
          durationLimit,
          timeoutRequest,
          timeoutLimit
        } = node
        if (status === 'stopped') return

        const now = Date.now() / 1000

        const maxDuration = optionalMin(durationRequest, durationLimit)
        if (maxDuration !== undefined) {
          const duration = now - dateStart
          if (duration > maxDuration) {
            this.end(
              node,
              undefined,
              true,
              `Reached maximum duration of ${maxDuration} seconds`
            ).catch(error => log.error(error))
            return
          }
          if (duration > maxDuration - durationWarning)
            this.notify(
              'warn',
              `Session will reach maximum duration in ${Math.round(
                (maxDuration - duration) / 6
              ) / 10} minutes`,
              node,
              clients
            )
        }

        const maxTimeout = optionalMin(timeoutRequest, timeoutLimit)
        if (maxTimeout !== undefined) {
          const timeout = now - dateLast
          if (timeout > maxTimeout) {
            this.end(
              node,
              undefined,
              true,
              `No activity over ${maxTimeout} seconds`
            ).catch(error => log.error(error))
            return
          }
          if (timeout > maxTimeout - timeoutWarning)
            this.notify(
              'warn',
              `Session will end due to inactivity in ${Math.round(
                (maxTimeout - timeout) / 6
              ) / 10} minutes`,
              node,
              clients
            )
        }
      }
    )
  }

  /**
   * End all sessions.
   *
   * This method should be avoided but may be useful for
   * cleanup when forcing shutdown of a manager.
   */
  public endAll(): Promise<void> {
    const {
      config: { sessionType }
    } = this
    if (sessionType === 'docker') return DockerSession.endAll()
    if (sessionType === 'firecracker') return FirecrackerSession.endAll()
    return Promise.resolve()
  }

  /**
   * Remove stale sessions.
   *
   * This frees memory by removing sessions that have been
   * stopped for a long time (they are retained for `stalePeriod`
   * so that the reason for closing can be reported to user).
   */
  protected removeStale(): void {
    const {
      sessions,
      config: { stalePeriod }
    } = this
    Object.entries(sessions).map(([sessionId, { node: { dateEnd } }]) => {
      if (dateEnd !== undefined) {
        const now = Date.now()
        const date = new Date(isA('Date', dateEnd) ? dateEnd.value : dateEnd)
        const stale = (now - date.valueOf()) / 1000
        if (stale > stalePeriod) {
          // Delete and record it's removal
          delete sessions[sessionId]
          recordSessionsCount(sessions)
        }
      }
    })
  }
}
