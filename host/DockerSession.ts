import { StreamClient } from '@stencila/executa';
import { getLogger } from '@stencila/logga';
import { Node, SoftwareSession } from '@stencila/schema';
import Docker, { ContainerCreateOptions } from 'dockerode';
import { Session } from './Session';

const CPU_PERIOD = 1000

const log = getLogger('sparkla:docker')

export class DockerSession extends Session {
  /**
   * The Docker container for this session.
   */
  container?: Docker.Container

  /**
   * The client used to connect to the Docker
   * container and make execution requests.
   */
  client?: StreamClient

  /**
   * Begin a session.
   *
   * @param session
   */
  async begin(session: SoftwareSession): Promise<SoftwareSession> {
    let image = 'stencila/sparkla-ubuntu'
    if (session.environment !== undefined) {
      image = session.environment.name
    } else {
      // Normally, the `environment` will be requested, or defined in `Manager.sessionDefault`.
      // So, if it has not been set yet, issue a warning
      log.warn(`Session environment was not set so defaulting to: ${image}`)
    }

    // Create and start the container
    // See options at https://docs.docker.com/engine/api/v1.40/#operation/ContainerCreate
    const docker = new Docker()

    const containerOptions: ContainerCreateOptions = {
      Image: image,
      OpenStdin: true,
      AttachStdin: true,
      HostConfig: {}
    }

    if (containerOptions.HostConfig !== undefined) {
      // typescript being stupid
      if (session.memoryLimit !== undefined) {
        containerOptions.HostConfig.Memory =
          session.memoryLimit * 1024 * 1024 * 1024
      }

      if (session.cpuLimit !== undefined) {
        containerOptions.HostConfig.CpuPeriod = CPU_PERIOD
        containerOptions.HostConfig.CpuQuota = session.cpuLimit
      }
    }

    if (session.volumeMounts !== undefined) {
      const volumes: { [key: string]: any } = {}
      const binds: string[] = []

      session.volumeMounts.forEach(vm => {
        volumes[vm.mountDestination] = {}
        const source = vm.mountSource === undefined ? '' : `${vm.mountSource}:`
        const options =
          vm.mountOptions === undefined ? '' : ':' + vm.mountOptions.join(',')
        binds.push(`${source}${vm.mountDestination}${options}`)
      })

      containerOptions.Volumes = volumes
      if (containerOptions.HostConfig !== undefined)
        // TypeScript doesn't know I set this above
        containerOptions.HostConfig.Binds = binds
    }

    const container = (this.container = await docker.createContainer(
      containerOptions
    ))

    // Attach to the container. Use "HTTP hijacking" for
    // separate `stdin` and `stdout`
    const stream = await container.attach({
      stream: true,
      hijack: true,
      stdin: true,
      stdout: true,
      stderr: false
    })

    await container.start()

    // @ts-ignore
    this.client = new StreamClient(stream, stream)

    return session
  }

  execute(node: Node): Promise<Node> {
    const { client } = this
    if (client === undefined)
      throw new Error('Attempting to execute() before begin()?')
    return client.execute(node)
  }

  async end(node: SoftwareSession): Promise<SoftwareSession> {
    const { container, client } = this
    if (container !== undefined) {
      await container.stop()
      await container.remove()
    }
    if (client !== undefined) {
      await client.stop()
    }
    return node
  }
}
