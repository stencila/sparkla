import {
  Executor,
  TcpClient,
  VsockFirecrackerClient,
  WebSocketServer
} from '@stencila/executa'
import { getLogger } from '@stencila/logga'
import { CodeChunk, isA, Node, SoftwareSession } from '@stencila/schema'
import crypto from 'crypto'
import { DockerSession } from './DockerSession'
import { FirecrackerSession } from './FirecrackerSession'
import { Session } from './Session'
import { WebSocketAddress } from '@stencila/executa/dist/lib/base/Transports'

const log = getLogger('sparkla:manager')
export interface SessionType {
  new (): FirecrackerSession | DockerSession
}

export class Manager extends Executor {
  /**
   * The class of sessions (e.g. `FirecrackerSession`) created.
   */
  public readonly SessionType: SessionType

  /**
   * The default `SoftwareSession` node to be created if not specified.
   */
  public readonly sessionDefault: SoftwareSession = {
    type: 'SoftwareSession',
    environment: { type: 'Environment', name: 'stencila/sparkla-ubuntu' }
  }

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

  async execute(node: Node, session?: SoftwareSession): Promise<Node> {
    if (isA('CodeChunk', node)) {
      // No session provided, so use the default
      if (session === undefined) session = this.sessionDefault

      // Make sure the session is started
      // @ts-ignore that `began` is not a property of a `SoftwareSession` yet
      let { id, began } = session
      if (id === undefined || began === undefined) {
        // Start the session...
        ;({ id } = (await this.begin(session)) as SoftwareSession)
      }
      if (id === undefined) {
        log.warn(`No id assigned to session: ${id}`)
        return node
      }

      // Get the session `instance` and ask it to execute the node
      const instance = this.sessions[id]
      if (instance === undefined) {
        log.warn(`No instance with id; already deleted, mis-routed?: ${id}`)
        return node
      }
      return instance.execute(node)
    }
    return node
  }

  async begin(node: Node): Promise<Node> {
    if (isA('SoftwareSession', node)) {
      // @ts-ignore that `began` is not a property of a `SoftwareSession` yet
      if (node.began !== undefined) {
        // Session has already begun, so just return
        return node
      } else {
        // Session needs to begin...
        const instance = new this.SessionType()

        // Assign a unique, difficult to guess, identifier
        // that still allows routing back to this `Manager` instance
        // TODO: make this a URI that allows for routing back to the manager
        const id = crypto.randomBytes(32).toString('hex')
        this.sessions[id] = instance

        // Actually start the session and return the updated
        // `SoftwareSession` node.
        const begunSession = await instance.begin(node)
        const began = Date.now()
        return { ...begunSession, id, began }
      }
    }
    return node
  }

  async end(node: Node): Promise<Node> {
    if (isA('SoftwareSession', node)) {
      const { id } = node
      if (id === undefined) return node

      const instance = this.sessions[id]
      if (instance === undefined) return node

      const endedSession = await instance.end(node)
      const ended = Date.now()
      delete this.sessions[id]

      return { ...endedSession, ended }
    }
    return node
  }
}
