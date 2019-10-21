import { Node, isA } from '@stencila/schema'
import {
  Executor,
  VsockFirecrackerClient,
  TcpClient,
  WebSocketServer
} from '@stencila/executa'
import { Session } from './Session'
import { DockerSession } from './DockerSession'
import { FirecrackerSession } from './FirecrackerSession'

export interface SessionType {
  new (): FirecrackerSession | DockerSession
}

export class Manager extends Executor {
  /**
   * The class of machines used by this executor.
   */
  public readonly SessionType: SessionType

  /**
   * A dictionary of machines to which
   * execution will be delegated.
   */
  private sessions: { [key: string]: Session } = {}

  constructor(sessionType: SessionType) {
    super(
      // No peer discovery functions are required because instead this
      // class keeps track of `Session`s which it delegate to based on
      // the `session` property of nodes.
      [],
      // Client class used depend upon the machine class
      [sessionType === FirecrackerSession ? VsockFirecrackerClient : TcpClient],
      // Websocket server for receiving requests
      // from browser based clients (also provides HTTP endpoints)
      [new WebSocketServer()]
    )

    this.SessionType = sessionType
  }

  async execute(node: Node): Promise<Node> {
    if (isA('CodeChunk', node)) {
      // @ts-ignore that session is not a property at present
      if (node.session === undefined) {
        const session = await this.begin({
          type: 'SoftwareSession'
        })
        return this.execute({ ...node, session })
      }
    }
    return node
  }

  async begin(node: Node): Promise<Node> {
    if (isA('SoftwareSession', node)) {
      if (node.id !== undefined) return node
      else {
        const session = new this.SessionType()
        const begun = await session.begin(node)
        if (begun.id === undefined) return begun
        this.sessions[begun.id] = session
        return begun
      }
    }
    return node
  }

  async end(node: Node): Promise<Node> {
    if (isA('SoftwareSession', node)) {
      if (node.id === undefined) return node
      const session = this.sessions[node.id]
      if (session !== undefined) {
        const ended = await session.end(node)
        if (ended.id === undefined) return ended
        delete this.sessions[ended.id]
        return ended
      }
    }
    return node
  }
}
