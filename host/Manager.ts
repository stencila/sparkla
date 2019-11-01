import {
  BaseExecutor,
  TcpServerClient,
  User,
  WebSocketAddress,
  WebSocketServer
} from '@stencila/executa'
import { getLogger } from '@stencila/logga'
import {
  date,
  isA,
  Node,
  softwareEnvironment,
  SoftwareSession,
  softwareSession
} from '@stencila/schema'
import crypto from 'crypto'
import { DockerSession } from './DockerSession'
import { FirecrackerSession } from './FirecrackerSession'
import { Session } from './Session'
import { Capabilities } from '@stencila/executa/dist/lib/base/Executor'
import { AggregationType, globalStats, MeasureUnit } from '@opencensus/core'
import { performance } from 'perf_hooks'

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

/**
 * A WebSocket server class which notifies the `Manager`
 * when a client disconnects so that sessions can be
 * ended is necessary.
 */
export class ManagerServer extends WebSocketServer {
  constructor(host = '127.0.0.1', port = 9000) {
    super(new WebSocketAddress({ host, port }))
  }

  /**
   * Handler for client disconnection.
   *
   * Override to end all sessions for the client.
   */
  async onDisconnected(client: TcpServerClient): Promise<void> {
    // Call `WebSockerServer.onDisconnected` to de-register the client
    // as normal
    super.onDisconnected(client)

    // Tell the `Manager` to end all sessions that are linked to
    // the client
    const manager = this.executor as Manager
    if (manager !== undefined) {
      await manager.endAllClient(client.id)
    }
  }
}

export class Manager extends BaseExecutor {
  /**
   * The class of sessions (e.g. `FirecrackerSession`) created.
   */
  public readonly SessionType: SessionType

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
    cpuRequested: 1,
    memoryRequested: 1,
    environment: softwareEnvironment('stencila/sparkla-ubuntu-midi')
  })

  /**
   * Session instances mapped to session node id.
   *
   * This allows for fast delegation to the session instance
   * in the `execute()` and `end()` methods.
   */
  private sessions: { [key: string]: Session } = {}

  /**
   * Session instances for each client id.
   *
   * This allows tracking of the number of sessions per client
   * and for all session instances associated with a client to be ended
   * when the client disconnects.
   */
  private clients: { [key: string]: Session[] } = {}

  constructor(sessionType: SessionType, host = '127.0.0.1', port = 9000) {
    super(
      // No peer discovery functions are required at present. Instead, this
      // class keeps track of `Session`s which it delegate to based on
      // the `session` property of nodes.
      [],
      // No peers at present, so no need for client classe
      [],
      // Websocket server for receiving requests
      // from browser based clients (also provides HTTP endpoints)
      [new ManagerServer(host, port)]
    )

    this.SessionType = sessionType
  }

  /**
   * Declaration of capabilities.
   *
   * At present, just declare that capable of all methods
   * since actual capabilities will be determined by
   * sessions delegated to.
   */
  capabilities(): Promise<Capabilities> {
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

  async execute<NodeType extends Node>(
    node: NodeType,
    session?: SoftwareSession
  ): Promise<NodeType> {
    if (isA('CodeChunk', node) || isA('CodeExpression', node)) {
      // Use the default session if non is provided
      if (session === undefined) session = this.sessionDefault

      // Make sure the session is started
      let { id, dateStart } = session
      if (id === undefined || dateStart === undefined) {
        // Start the session...
        ;({ id } = await this.begin(session))
      }
      if (id === undefined) {
        // This should never happen; if it does there is a bug in begin()
        log.error(`No id assigned to session: ${id}`)
        return node
      }

      // Get the session `instance` and ask it to execute the node
      const instance = this.sessions[id]
      if (instance === undefined) {
        // This should never happen; if it does there is a bug in begin() or end()
        log.error(`No instance with id; already deleted, mis-routed?: ${id}`)
        return node
      }
      const executeBefore = performance.now()

      const processedNode = (await instance.execute(node)) as NodeType

      globalStats.record([
        {
          measure: executionDurationMeasure,
          value: performance.now() - executeBefore
        }
      ])

      return processedNode
    }
    return node
  }

  async begin<NodeType extends Node>(
    node: NodeType,
    user: User = {}
  ): Promise<NodeType> {
    if (isA('SoftwareSession', node)) {
      if (node.dateStart !== undefined) {
        // Session has already begun, so just return the session unaltered
        return node
      } else {
        // Session needs to be started...
        const instance = new this.SessionType()

        // The requested session overrides the properties of the
        // default session (or, to put it the other way around, the
        // default fills in the missing properties of the requested)
        const sessionRequested = { ...this.sessionDefault, ...node }

        // The `user.session` overrides the properties of the
        // requested session. Usually `cpuLimit` etc are not in a request,
        // but in case they are, we override them here.
        const sessionPermitted = { ...sessionRequested, ...user.session }

        // Assign a unique, difficult to guess, identifier
        // that allows routing back to the `Session` instance
        // in the execute() method
        const sessionId = crypto.randomBytes(32).toString('hex')
        this.sessions[sessionId] = instance

        // Register the session instance against the client so that it
        // can be ended when the client disconnects, or the number
        // of session per client can be limited
        const clientId = user.client !== undefined ? user.client.id : undefined
        if (clientId !== undefined) {
          if (this.clients[clientId] === undefined)
            this.clients[clientId] = [instance]
          else this.clients[clientId].push(instance)
        }

        // Actually start the session and return the updated
        // `SoftwareSession` node.
        const begunSession = await instance.begin({
          ...sessionPermitted,
          id: sessionId
        })
        const dateStart = date(new Date().toISOString())
        recordSessionsCount(this.sessions)
        return softwareSession({ ...begunSession, dateStart }) as NodeType
      }
    }
    return node
  }

  async end<NodeType extends Node>(
    node: NodeType,
    user: User = {}
  ): Promise<NodeType> {
    if (isA('SoftwareSession', node)) {
      const { id: sessionId } = node
      if (sessionId === undefined) return node

      const instance = this.sessions[sessionId]
      if (instance === undefined) return node

      const endedSession = await instance.end(node)
      const dateEnd = date(new Date().toISOString())
      delete this.sessions[sessionId]

      // De-register the session instance for the client
      const clientId = user.client !== undefined ? user.client.id : undefined
      if (clientId !== undefined) {
        let instances = this.clients[clientId]
        if (instances !== undefined) {
          instances = instances.splice(instances.indexOf(instance), 1)
        }
        if (instances.length > 0) {
          this.clients[clientId] = instances
        } else {
          delete this.clients[clientId]
        }
      }
      recordSessionsCount(this.sessions)
      return softwareSession({ ...endedSession, dateEnd }) as NodeType
    }
    return node
  }

  /**
   * End all sessions for a client.
   *
   * This method is normally called when a client disconnects.
   * As such it does not call `this.end()` since there is no need
   * to return an updated `SoftwareSession` node. Rather, it just ends
   * the instance directly.
   *
   * In the future, there may be more than one client using a
   * session, in which case this method will need to check
   * for that before ending.
   *
   * @param clientId The id of the client
   */
  async endAllClient(clientId: string): Promise<void> {
    const instances = this.clients[clientId]
    if (instances !== undefined) {
      await Promise.all(instances.map(instance => instance.end()))
      delete this.clients[clientId]
    }
  }

  /**
   * End all sessions.
   *
   * This method should be avoided but may be useful for
   * cleanup when forcing shutdown of a manager.
   */
  endAll(): Promise<void> {
    if (this.SessionType === DockerSession) return DockerSession.endAll()
    if (this.SessionType === FirecrackerSession)
      return FirecrackerSession.endAll()
    return Promise.resolve()
  }
}
