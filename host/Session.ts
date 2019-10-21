import { SoftwareSession } from '@stencila/schema'

export abstract class Session {
  abstract async begin(node: SoftwareSession): Promise<SoftwareSession>

  abstract async end(node: SoftwareSession): Promise<SoftwareSession>
}
