import { SoftwareSession, Node } from '@stencila/schema'

export abstract class Session {
  /**
   * Get a representation of the session
   *
   * This method is used for displaying the session in the
   * admin page and should be implemented to return useful information
   * on the session without too much noise.
   */
  abstract repr(): any

  abstract begin(node: SoftwareSession): Promise<SoftwareSession>

  abstract execute(node: Node): Promise<Node>

  abstract end(node?: SoftwareSession): Promise<SoftwareSession>
}
