import { BaseExecutor, User } from '@stencila/executa'
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
import { ManagerServer } from './ManagerServer'

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
   * The `SoftwareSession` node when it was began
   */
  node: SoftwareSession

  /**
   * The session instance
   */
  instance: Session

  /**
   * The user that began this session
   */
  user: User

  /**
   * The clients that have used this session
   */
  clients: string[]
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
   * Session info mapped to session node id.
   *
   * This allows for fast delegation to the session instance
   * in the `execute()` and `end()` methods.
   */
  public readonly sessions: { [key: string]: SessionInfo } = {}

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

  public async execute<NodeType extends Node>(
    node: NodeType,
    session?: SoftwareSession
  ): Promise<NodeType> {
    if (isA('CodeChunk', node) || isA('CodeExpression', node)) {
      // Use the default session if none is provided
      if (session === undefined) session = this.sessionDefault

      // Make sure the session is started
      let { id, dateStart } = session
      if (id === undefined || dateStart === undefined) {
        // Start the session...
        ;({ id } = await this.begin(session))
      }
      if (id === undefined) {
        // This should never happen; if it does there is a bug in begin()
        log.error(`No id assigned to session`)
        return node
      }

      // Get the session `instance` and ask it to execute the node
      const sessionInfo = this.sessions[id]
      if (sessionInfo === undefined) {
        // This should never happen; if it does there is a bug in begin() or end()
        log.error(`No instance with id; already deleted, mis-routed?: ${id}`)
        return node
      }
      const { instance } = sessionInfo

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

        // Record the client that started the session
        const clientId = user.client !== undefined ? user.client.id : undefined

        // Actually start the session and return the updated
        // `SoftwareSession` node.
        const dateStart = date(new Date().toISOString())
        const begunSession = await instance.begin({
          ...sessionPermitted,
          id: sessionId,
          dateStart
        })

        // Store and record it's addition
        this.sessions[sessionId] = {
          node: begunSession,
          instance,
          user,
          clients: clientId !== undefined ? [clientId] : []
        }
        recordSessionsCount(this.sessions)

        return begunSession as NodeType
      }
    }
    return node
  }

  /**
   * End a node (usually a `SoftwareSession`)
   *
   * @param node The node to end
   * @param user The user that is ending the node
   * @param notify Notify clients that the session will be ended?
   */
  public async end<NodeType extends Node>(
    node: NodeType,
    user: User = {},
    notify = true
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

      // Notify clients that the session is going to be ended
      if (notify) {
        for (const clientId of clients)
          this.notifyClients('info', `Ending session ${sessionId}`, [clientId])
      }

      // Actually end the session
      const dateEnd = date(new Date().toISOString())
      const endedSession = await instance.end({ ...node, dateEnd })

      // Delete and record it's removal
      delete this.sessions[sessionId]
      recordSessionsCount(this.sessions)

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
      Object.entries(this.sessions).map(([sessionId, { node, clients }]) => {
        if (clients.includes(clientId)) {
          if (clients.length === 1) return this.end(node, undefined, false)
          else
            this.sessions[sessionId].clients = clients.filter(
              id => id !== clientId
            )
        }
        return Promise.resolve(node)
      })
    )
  }

  /**
   * End all sessions.
   *
   * This method should be avoided but may be useful for
   * cleanup when forcing shutdown of a manager.
   */
  public endAll(): Promise<void> {
    if (this.SessionType === DockerSession) return DockerSession.endAll()
    if (this.SessionType === FirecrackerSession)
      return FirecrackerSession.endAll()
    return Promise.resolve()
  }

  /**
   * Notify clients.
   *
   * This is in lieu of such a method being implemented in `BaseExecutor`
   */
  protected notifyClients(
    subject: string,
    message: string,
    clients?: string[]
  ) {
    // @ts-ignore that servers is private to BaseExecutor class
    const server = this.servers[0] as ManagerServer
    server.notify(subject, message, clients)
  }
}
