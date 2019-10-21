import { StdioClient } from '@stencila/executa';
import { getLogger } from '@stencila/logga';
import { SoftwareSession } from '@stencila/schema';
import { Session } from './Session';

const log = getLogger('sparkla:docker')

export class DockerSession extends Session {

  client?: StdioClient

  async begin(node: SoftwareSession): Promise<SoftwareSession> {
    this.client = new StdioClient(`docker run --interactive stencila/executa`)
    return node
  }

  async end(node: SoftwareSession): Promise<SoftwareSession> {
    if (this.client) this.client.stop()
    return node
  }
}