import {
  BaseExecutor,
  TcpClient,
  VsockFirecrackerClient,
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

const log = getLogger('sparkla:manager')

export interface SessionType {
  new (): FirecrackerSession | DockerSession
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
   * Sessions managed by this manager.
   */
  private sessions: { [key: string]: Session } = {}

  constructor(sessionType: SessionType, host = '127.0.0.1', port = 9000) {
    super(
      // No peer discovery functions are required at present. Instead, this
      // class keeps track of `Session`s which it delegate to based on
      // the `session` property of nodes.
      [],
      // Client class used depend upon the machine class
      [sessionType === FirecrackerSession ? VsockFirecrackerClient : TcpClient],
      // Websocket server for receiving requests
      // from browser based clients (also provides HTTP endpoints)
      [new WebSocketServer(new WebSocketAddress({ host, port }))]
    )

    this.SessionType = sessionType
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
      return instance.execute(node) as Promise<NodeType>
    }
    return node
  }

  async begin<NodeType extends Node>(
    node: NodeType,
    limits?: SoftwareSession
  ): Promise<NodeType> {
    if (isA('SoftwareSession', node)) {
      if (node.dateStart !== undefined) {
        // Session has already begun, so just return the session unaltered
        return node
      } else {
        // Session needs to started...
        const instance = new this.SessionType()

        // The requested session overrides the properties of the
        // default session (or, to put it the other way around, the
        // default fills in the missing properties of the requested)
        const sessionRequested = { ...this.sessionDefault, ...node }

        // The `limits` session overrides the properties of the
        // requested session. Usually `cpuLimit` etc are not in a request
        // but in case they are we override them here.
        const sessionPermitted = { ...sessionRequested, ...limits }

        // Assign a unique, difficult to guess, identifier
        // that allows routing back to the `Session` instance
        // in the execute() method
        const id = crypto.randomBytes(32).toString('hex')
        this.sessions[id] = instance

        // Actually start the session and return the updated
        // `SoftwareSession` node.
        const begunSession = await instance.begin({ ...sessionPermitted, id })
        const dateStart = date(new Date().toISOString())
        return softwareSession({ ...begunSession, id, dateStart }) as NodeType
      }
    }
    return node
  }

  async end<NodeType extends Node>(node: NodeType): Promise<NodeType> {
    if (isA('SoftwareSession', node)) {
      const { id } = node
      if (id === undefined) return node

      const instance = this.sessions[id]
      if (instance === undefined) return node

      const endedSession = await instance.end(node)
      const dateEnd = date(new Date().toISOString())
      delete this.sessions[id]

      return softwareSession({ ...endedSession, dateEnd }) as NodeType
    }
    return node
  }
}
