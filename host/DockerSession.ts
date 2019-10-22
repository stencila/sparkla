import { StdioClient } from '@stencila/executa'
import { SoftwareSession, environment, Node } from '@stencila/schema'
import { Session } from './Session'

export class DockerSession extends Session {
  client?: StdioClient

  begin(node: SoftwareSession): Promise<SoftwareSession> {
    this.client = new StdioClient(
      `docker run --interactive ${node.environment.name}`
    )
    return Promise.resolve(node)
  }

  execute(node: Node): Promise<Node> {
    if (this.client === undefined)
      throw new Error('Attempting to execute() before begin()?')
    return this.client.execute(node)
  }

  end(node: SoftwareSession): Promise<SoftwareSession> {
    if (this.client !== undefined) this.client.stop()
    return Promise.resolve(node)
  }
}
