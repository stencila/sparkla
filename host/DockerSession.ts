import crypto from 'crypto'
import { StdioClient } from '@stencila/executa'
import { getLogger } from '@stencila/logga'
import { SoftwareSession } from '@stencila/schema'
import { Session } from './Session'

const log = getLogger('sparkla:docker')

export class DockerSession extends Session {
  client?: StdioClient

  begin(node: SoftwareSession): Promise<SoftwareSession> {
    this.client = new StdioClient(`docker run --interactive stencila/executa`)
    const id = crypto.randomBytes(32).toString('hex')
    return Promise.resolve({ ...node, id })
  }

  end(node: SoftwareSession): Promise<SoftwareSession> {
    if (this.client !== undefined) this.client.stop()
    return Promise.resolve(node)
  }
}
