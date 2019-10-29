import { StreamClient } from '@stencila/executa'
import { getLogger } from '@stencila/logga'
import {
  Node,
  SoftwareSession,
  softwareSession,
  VolumeMount,
  volumeMount
} from '@stencila/schema'
import Docker, { MountSettings } from 'dockerode'
import { Session } from './Session'
import { optionalMin } from './util'

const BYTES_PER_GIB = 1024 * 1024 * 1024

// Length of CPU period in microseconds
const CPU_PERIOD = 1000

const log = getLogger('sparkla:docker')

const docker = new Docker()

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
    const {
      id = '',
      environment,
      memoryRequested,
      memoryLimit,
      cpuRequested,
      cpuLimit,
      volumeMounts = []
    } = session

    // Get the Docker image name
    let image = 'stencila/sparkla-ubuntu'
    if (environment !== undefined) {
      image = environment.name
    } else {
      // Normally, the `environment` will be requested, or defined in `Manager.sessionDefault`.
      // So, if it has not been set yet, issue a warning
      log.warn(`Session environment was not set so defaulting to: ${image}`)
    }

    // Set memory and CPU as minimum of requests and limits
    const memory = optionalMin(memoryRequested, memoryLimit)
    const cpuQuota = optionalMin(cpuRequested, cpuLimit)

    // Create volume mounts
    const mounts = volumeMounts
      .map((mount): MountSettings | void => {
        const {
          mountSource: source,
          mountDestination: target,
          mountOptions: options = []
        } = mount
        if (source === undefined)
          return log.error(`VolumeMount.mountSource must be defined`)
        if (target === undefined)
          return log.error(`VolumeMount.mountDestination must be defined`)
        return {
          Type: 'bind',
          Source: source,
          Target: target,
          ReadOnly: options.includes('ro')
        }
      })
      .reduce(
        (prev: MountSettings[], curr) =>
          curr !== undefined ? [...prev, curr] : prev,
        []
      )

    // Create and start the container
    // See options at https://docs.docker.com/engine/api/v1.40/#operation/ContainerCreate
    // Following comments form that documentation
    const container = (this.container = await docker.createContainer({
      Image: image,
      OpenStdin: true,
      AttachStdin: true,
      Labels: {
        sparklaId: id
      },
      HostConfig: {
        // Memory limit in bytes. Default 0
        Memory: memory !== undefined ? memory * BYTES_PER_GIB : undefined,
        // The length of a CPU period in microseconds.
        CpuPeriod: CPU_PERIOD,
        // Microseconds of CPU time that the container can get in a CPU period.
        CpuQuota: cpuQuota !== undefined ? cpuQuota * CPU_PERIOD : undefined,
        // Specification for mounts to be added to the container.
        Mounts: mounts
      }
    }))

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

  /**
   * Get a list of active `SoftwareSession`s being managed by
   * this class.
   *
   * This method creates a list of sessions based on the current
   * Docker containers running on the host. It is mainly used
   * for testing that sessions created by `begin()` have the
   * redirected properties e.g. mounts, memory etc
   */
  static async list(): Promise<SoftwareSession[]> {
    const containers = await docker.listContainers({
      filters: {
        label: ['sparklaId']
      }
    })
    const sessions = containers.map(container => {
      const { Mounts: mounts } = container
      console.log(container)

      const volumeMounts = mounts.map(
        (mount): VolumeMount => {
          const { Source: mountSource, Destination: mountDestination } = mount
          return volumeMount(mountDestination, {
            mountSource
          })
        }
      )
      return softwareSession({
        volumeMounts
      })
    })
    return sessions
  }

  /**
   * End all sessions being managed by this class.
   */
  static async stop(): Promise<void> {
    const containers = await docker.listContainers({
      all: true,
      filters: {
        status: [
          'created',
          'restarting',
          'running',
          'paused',
          'exited',
          'dead'
        ],
        label: ['sparklaId']
      }
    })
    await Promise.all(
      containers.map(async info => {
        const container = docker.getContainer(info.Id)
        if (info.State === 'running') await container.stop()
        await container.remove()
      })
    )
  }
}
