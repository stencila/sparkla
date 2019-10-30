import { SoftwareSession, Node } from '@stencila/schema'

export abstract class Session {
  abstract begin(node: SoftwareSession): Promise<SoftwareSession>

  abstract execute(node: Node): Promise<Node>

  abstract end(node?: SoftwareSession): Promise<SoftwareSession>
}
