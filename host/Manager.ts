import {
  Manager,
  Capabilities,
  Manifest,
  Method,
  uid,
  Claims,
  WebSocketClient
} from '@stencila/executa'
import { Peer } from '@stencila/executa/dist/lib/base/Delegator'
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
// @ts-ignore
import discoveryChannel from 'discovery-channel'
import { JSONSchema7Definition } from 'json-schema'
// @ts-ignore
import moniker from 'moniker'
import osu from 'node-os-utils'
import { performance } from 'perf_hooks'
import { Config } from './config'
import { DockerSession } from './DockerSession'
import { FirecrackerSession } from './FirecrackerSession'
import { ManagerServer } from './ManagerServer'
import { Session } from './Session'
import pkg from './pkg'
import * as stats from './stats'
import { globalIP, localIP, optionalMin } from './util'

const log = getLogger('sparkla:manager')

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
  instance?: Session

  /**
   * Claims used to begin the session.
   */
  claims: Claims

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

export class Sparkla extends Manager {
  /**
   * Configuration options
   */
  public readonly config: Config

  /**
   * Global IP address.
   */
  private globalIP = '0.0.0.0'

  /**
   * Local IP address.
   */
  private localIP = '127.0.0.1'

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
    environment: softwareEnvironment({ name: 'stencila/sparkla-ubuntu' })
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
      // WebSocket server for receiving requests
      // from browser based clients (also provides HTTP endpoints)
      [new ManagerServer(config.host, config.port, config.jwtSecret)]
    )

    this.config = config
  }

  get port(): number {
    return this.config.port
  }

  /**
   * Calculate the amount of compute resource that
   * can be allocated to new sessions.
   */
  public async allocatableResources(): Promise<{
    cpu: number
    memory: number
  }> {
    // Get the total resources available
    let { cpuTotal, memoryTotal } = this.config
    if (cpuTotal === null) {
      cpuTotal = osu.cpu.count()
    }
    if (memoryTotal === null) {
      const memInfo = await osu.mem.info()
      memoryTotal = memInfo.totalMemMb / 1024
    }

    // Minus resources already allocated to sessions
    // that are still running
    for (const sessionInfo of Object.values(this.sessions)) {
      const { node } = sessionInfo
      if (!(node.status === 'starting' || node.status === 'started')) continue

      const { cpuRequest, cpuLimit } = node
      const cpu = optionalMin(cpuRequest, cpuLimit)
      if (cpu !== undefined) {
        cpuTotal -= cpu
      }

      const { memoryRequest, memoryLimit } = node
      const memory = optionalMin(memoryRequest, memoryLimit)
      if (memory !== undefined) {
        memoryTotal -= memory
      }
    }
    return {
      cpu: cpuTotal,
      memory: memoryTotal
    }
  }

  /**
   * Are there enough allocatable resources to start a session?
   *
   * @param session
   */
  public async enoughResources(session: SoftwareSession): Promise<boolean> {
    const { cpuRequest, cpuLimit, memoryRequest, memoryLimit } = session
    const allocatable = await this.allocatableResources()

    const cpu = optionalMin(cpuRequest, cpuLimit)
    if (cpu !== undefined && cpu > allocatable.cpu) {
      return false
    }

    const memory = optionalMin(memoryRequest, memoryLimit)
    if (memory !== undefined && memory > allocatable.memory) {
      return false
    }

    return true
  }

  /**
   * @override Override of {@link Executor.capabilities} to
   * be able to dynamically declare capabilities based
   * on resources available.
   */
  public async capabilities(): Promise<Capabilities> {
    // Get the allocatable resources
    const { cpu, memory } = await this.allocatableResources()

    // Create a schema definition with those resources
    // as maximum
    const begin: JSONSchema7Definition = {
      properties: {
        node: {
          properties: {
            type: {
              const: 'SoftwareSession'
            },
            cpuRequest: {
              type: 'number',
              maximum: cpu
            },
            memoryRequest: {
              type: 'number',
              maximum: memory
            }
          }
        }
      },
      required: ['node']
    }

    return Promise.resolve({
      decode: true,
      encode: true,
      compile: true,
      build: true,
      execute: true,
      begin,
      end: true
    })
  }

  /**
   * @override Override of {@link Executor.manifest} to
   * add package version information
   */
  async manifest(): Promise<Manifest> {
    const { name, version } = pkg
    return {
      version: 1,
      id: this.id,
      capabilities: await this.capabilities(),
      addresses: await this.addresses(),
      package: { name, version }
    }
  }

  /**
   * Generate a unique URI for a session that still allows for
   * routing back to this manager instance.
   */
  public generateSessionId(): string {
    const rand = uid.generate('se')
    return `ws://${this.globalIP}/${this.localIP}/${this.port}/${rand}`
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

  public async begin<NodeType extends Node>(
    node: NodeType,
    claims: Claims = {}
  ): Promise<NodeType> {
    if (isA('SoftwareSession', node)) {
      if (node.dateStart !== undefined) {
        // Session has already begun, so just return the session unaltered
        return node
      }

      // Session needs to be started...

      // The requested session overrides the properties of the
      // default session (or, to put it the other way around, the
      // default fills in the missing properties of the requested)
      // @ts-ignore TS2698: Spread types may only be created from object types
      const sessionRequested = { ...this.sessionDefault, ...node }

      // The `claims.session` overrides the properties of the
      // requested session. Usually `cpuLimit` etc are not in a request,
      // but in case they are, we override them here.
      const sessionPermitted = { ...sessionRequested, ...claims.session }

      let { id, name } = sessionPermitted

      // Assign a identifier and name if necessary
      if (id === undefined) id = this.generateSessionId()
      if (name === undefined) name = this.generateSessionName()

      const sessionToBegin = { ...sessionPermitted, id, name }

      // Record the client that started the session
      const clientId =
        claims.client !== undefined ? claims.client.id : undefined
      const clients = clientId !== undefined ? [clientId] : []

      // If this instance does not have enough resources to begin the
      // session then delegate it to peers
      if (!(await this.enoughResources(sessionToBegin))) {
        const sessionRejected: SoftwareSession = {
          ...sessionToBegin,
          status: 'failed',
          description: 'Insufficient resources available to begin session'
        }
        const sessionInfo: SessionInfo = {
          node: sessionRejected,
          claims: claims,
          clients,
          dateStart: -1,
          dateLast: Date.now()
        }
        // @ts-ignore TS does not know that id is now defined
        this.sessions[id] = sessionInfo
        stats.recordSession(sessionRejected, this.config.sessionType)
        return Promise.resolve(sessionRejected as NodeType)
      }

      const instance =
        this.config.sessionType === 'docker'
          ? new DockerSession()
          : new FirecrackerSession()

      const sessionBegun = {
        ...sessionToBegin,
        dateStart: date({ value: new Date().toISOString() }),
        status: 'started'
      }

      // If the session fails (i.e. exits prematurely) then notify
      // clients and restart it
      const onFail = () => {
        log.warn(`Session failed and will be restarted: ${id}`)
        this.notify(
          'warn',
          'Session failed and will be restarted',
          sessionBegun,
          clients
        ).catch(error => log.error(error))
        instance.begin(sessionBegun, onFail).catch(error => log.error(error))
        stats.recordSessionRestart(sessionBegun, this.config.sessionType)
      }

      // Actually start the session using the instance
      const before = performance.now()
      await instance.begin(sessionBegun, onFail)
      stats.recordSessionBeginDuration(
        performance.now() - before,
        sessionBegun,
        this.config.sessionType
      )

      // Store and record it's addition
      const now = Date.now()
      const sessionInfo: SessionInfo = {
        node: sessionBegun,
        instance,
        claims: claims,
        clients,
        dateStart: now,
        dateLast: now
      }
      this.sessions[id] = sessionInfo
      stats.recordSession(sessionBegun, this.config.sessionType)
      return sessionBegun as NodeType
    }
    return node
  }

  public async execute<NodeType extends Node>(
    node: NodeType,
    session?: SoftwareSession,
    claims: Claims = {}
  ): Promise<NodeType> {
    if (isA('CodeChunk', node) || isA('CodeExpression', node)) {
      // Use the default session if none is provided
      if (session === undefined) session = this.sessionDefault

      // Make sure the session is started
      let { id } = session
      if (id === undefined && session.status === undefined) {
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
        // TODO: Factor this out as a `passThrough(id, method, args)`
        // method so that it can also be used in end()

        // Client is requesting a session that does not exist on this manager
        // (it may have been removed), or it may be on another instance.
        const location = this.parseSessionId(id)
        if (location === undefined) {
          return {
            // @ts-ignore TS2698: Spread types may only be created from object types
            ...node,
            errors: [
              codeError('error', {
                message: `Session id is invalid: ${id}`
              })
            ]
          }
        }
        const { globalIP, localIP, port } = location
        if (
          globalIP === this.globalIP &&
          localIP === this.localIP &&
          port === this.port
        ) {
          // Attempting to access an old session
          return {
            // @ts-ignore TS2698: Spread types may only be created from object types
            ...node,
            errors: [
              codeError('error', {
                message: 'Session is no longer available.'
              })
            ]
          }
        }
        // Proxy request to the other manager instance. Note that it may not
        // be in the peer list.
        // TODO: pass claims info as JWT to other instance
        // TODO: use a LRU cache or similar to avoid recreating WebSocketClients
        const client = new WebSocketClient({ host: localIP, port })
        return client.execute(node, session)
      }

      const {
        node: { status, description, clientsRequest },
        instance,
        clients
      } = sessionInfo

      if (
        instance === undefined ||
        status === 'failed' ||
        status === 'stopped'
      ) {
        let message = 'Session is inactive.'
        if (typeof description === 'string') message += ' ' + description
        // @ts-ignore TS2698: Spread types may only be created from object types
        return { ...node, errors: [codeError('error', { message })] }
      }

      // Check that the maximum number of concurrent clients has not yet been reached
      const clientId =
        claims.client !== undefined ? claims.client.id : undefined
      if (clientId !== undefined && !clients.includes(clientId)) {
        const sessionPermitted: SoftwareSession = {
          type: 'SoftwareSession',
          ...claims.session
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
      const before = performance.now()
      const processedNode = (await instance.execute(node)) as NodeType
      stats.recordExecuteDuration(
        performance.now() - before,
        this.config.sessionType
      )

      // Record the activity
      sessionInfo.dateLast = Date.now()

      return processedNode
    }
    return node
  }

  /**
   * End a node (usually a `SoftwareSession`)
   *
   * @param node The node to end
   * @param claims The claims that is ending the node
   * @param notify Notify clients that the session will be ended?
   * @param reason The reason for ending the session
   */

  // eslint-disable-next-line @typescript-eslint/require-await
  public async end<NodeType extends Node>(
    node: NodeType,
    claims: Claims = {},
    notify = true,
    reason?: string
  ): Promise<NodeType> {
    if (isA('SoftwareSession', node)) {
      const { id: sessionId, status } = node

      if (!(status === 'starting' || status === 'started')) return node

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
      if (instance === undefined) {
        // If this happens, it's probably due to a bug in `begin()`
        log.error(`When ending session, session with no instance: ${sessionId}`)
        return node
      }

      // Notify clients that the session has ended and
      if (notify !== false) {
        let message = `Ending session "${node.name}".`
        if (typeof reason === 'string') message += ' ' + reason
        await this.notify('info', message, node, clients)
      }

      // End the session node and store it
      const endedSession = softwareSession({
        // @ts-ignore TS2698: Spread types may only be created from object types
        ...node,
        dateEnd: date({ value: new Date().toISOString() }),
        status: 'stopped',
        description: reason
      })
      sessionInfo.node = endedSession

      // Stop the session instance without awaiting
      const before = performance.now()
      instance
        .end(endedSession)
        .then(() =>
          stats.recordSessionEndDuration(
            performance.now() - before,
            endedSession,
            this.config.sessionType
          )
        )
        .catch(error => log.error(error))

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
        ([sessionId, { node, claims, clients }]) => {
          if (clients.includes(clientId)) {
            if (clients.length === 1) {
              // Only end session if it was not started by admin
              // @ts-ignore that admin is not a property of claims
              if (claims.admin !== true) return this.end(node, undefined, false)
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
      async ([sessionId, { node, dateStart, dateLast, clients }]) => {
        const {
          status,
          durationRequest,
          durationLimit,
          timeoutRequest,
          timeoutLimit
        } = node

        // If the session is not active, then don't do any of this
        if (!(status === 'starting' || status === 'started')) return

        const now = Date.now()

        const maxDuration = optionalMin(durationRequest, durationLimit)
        if (maxDuration !== undefined) {
          const duration = (now - dateStart) / 1000
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
            await this.notify(
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
          const timeout = (now - dateLast) / 1000
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
            await this.notify(
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
  public async endAll(): Promise<void> {
    log.info('Ending all sessions')

    // End each session so that claimss get notifications
    await Promise.all(
      Object.values(this.sessions).map(session =>
        this.end(
          session,
          undefined,
          true,
          `Manager is ending all sessions`
        ).catch(error => log.error(error))
      )
    )

    // As an extra step, run session type specific `endAll`
    const {
      config: { sessionType }
    } = this
    if (sessionType === 'docker') return DockerSession.endAll()
    if (sessionType === 'firecracker') return FirecrackerSession.endAll()
  }

  /**
   * Remove stale sessions.
   *
   * This frees memory, and reduces size of sessions list,
   * by removing sessions that have been failed or stopped
   * for a long time (they are retained for `stalePeriod`
   * so that the reason for closing can be reported to claims).
   */
  protected removeStale(): void {
    const {
      sessions,
      config: { stalePeriod }
    } = this
    const now = Date.now()
    Object.entries(sessions).map(
      ([
        sessionId,
        {
          node: { status, dateEnd },
          dateLast
        }
      ]) => {
        let stale = 0
        if (dateEnd !== undefined) {
          const date = new Date(isA('Date', dateEnd) ? dateEnd.value : dateEnd)
          stale = (now - date.valueOf()) / 1000
        } else if (status === 'failed') {
          stale = (now - dateLast) / 1000
        }
        if (stale > stalePeriod) delete sessions[sessionId]
      }
    )
  }

  /**
   * Generate info to be displayed on admin page.
   */
  public async info(): Promise<any> {
    const { sessions, delegator } = this
    const sessionReprs = Object.entries(sessions).reduce(
      (prev, [sessionId, sessionInfo]) => {
        const {
          node,
          claims,
          clients,
          instance,
          dateStart,
          dateLast
        } = sessionInfo
        return {
          ...prev,
          ...{
            [sessionId]: {
              node,
              claims,
              clients,
              dateStart,
              dateLast,
              instance: instance !== undefined ? instance.repr() : null
            }
          }
        }
      },
      {}
    )
    return {
      manifest: await this.manifest(),
      sessions: sessionReprs,
      delegator
    }
  }

  /**
   * @override Override of {@link Manager.start} to
   * configure, begin intervals, etc
   */
  public async start(): Promise<void> {
    const {
      host,
      expiryInterval,
      staleInterval,
      statsInterval,
      statsPrometheus
    } = this.config

    // Get IP addresses
    this.globalIP = await globalIP()
    this.localIP = localIP()

    // Start collecting stats
    stats.start(statsInterval, statsPrometheus)

    // Begin checking for expired and stale sessions
    setInterval(() => this.endExpired(), expiryInterval * 1000)
    setInterval(() => this.removeStale(), staleInterval * 1000)

    return super.start()
  }

  /**
   * @override Override of {@link Manager.stop} to
   * leave stop all sessions (in addition to stopping server).
   */
  public async stop(): Promise<void> {
    await this.endAll()
    return super.stop()
  }
}
