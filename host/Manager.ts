import { Node, isA, SoftwareSession, CodeChunk } from '@stencila/schema'
import {
  Executor,
  VsockFirecrackerClient,
  TcpClient,
  WebSocketServer
} from '@stencila/executa'
import crypto from 'crypto'
import { Session } from './Session'
import { DockerSession } from './DockerSession'
import { FirecrackerSession } from './FirecrackerSession'
import { getLogger } from '@stencila/logga'
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
  public readonly sessionDefault = {
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

  async execute(node: Node): Promise<Node> {
    if (isA('CodeChunk', node)) {
      // @ts-ignore that `session` is not a property of a `CodeChunk` yet
      const session: SoftwareSession | undefined = node.session
      if (session === undefined) {
        // Code chunk does not have a `session` associated with it so
        // begin a default one.
        const session = await this.begin(this.sessionDefault)
        return this.execute({ ...node, session })
      }

      // Code chunk has a session already, make sure it is started.
      // @ts-ignore that `began` is not a property of a `SoftwareSession` yet
      const { id, began } = session
      if (id === undefined || began === undefined) {
        // Start the session...
        const begunSession = await this.begin(session)
        return this.execute({ ...node, session: begunSession })
      }

      // Get the session and get it to execute the node
      const instance = this.sessions[id]
      if (instance === undefined) {
        log.warn(`No instance with id; already deleted, mis-routed?: ${id}`)
        return node
      }

      // TODO: Remove these workarounds pending change to schema
      // The Python executor quite rightly baulks at extra properties
      // so we need to remove it before executing and then put it back in
      // so that the logic of this method still works.
      // @ts-ignore that `session` is not a property of a `CodeChunk` yet
      const { session: sessionToLeaveOut, ...rest } = node
      const executedNode = (await instance.execute(rest)) as CodeChunk
      return { ...executedNode, session: sessionToLeaveOut }
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
        if (Object.keys(this.sessions).length >= 25) {
          throw new Error(`Sessions number limit reached`)
        }

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
