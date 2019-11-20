import { StreamClient } from '@stencila/executa'
import { getLogger } from '@stencila/logga'
import {
  Node,
  SoftwareSession,
  softwareSession,
  VolumeMount,
  volumeMount
} from '@stencila/schema'
import Docker, { Container, MountSettings } from 'dockerode'
import { Session } from './Session'
import { optionalMin } from './util'
import { PassThrough, Duplex } from 'stream'

const BYTES_PER_GIB = 1024 * 1024 * 1024

// Length of CPU period in microseconds
// Should be greater than 1000
const CPU_PERIOD = 1000 * 1000

const log = getLogger('sparkla:docker')

const docker = new Docker()

export class DockerSession implements Session {
  /**
   * The Docker container for this session.
   */
  container?: Docker.Container

  /**
   * The stream used to communicate with
   * the session.
   */
  stream?: Duplex

  /**
   * The client used to connect to the Docker
   * container and make execution requests.
   */
  client?: StreamClient

  constructor(container?: Docker.Container) {
    this.container = container
  }

  repr(): any {
    const container =
      this.container !== undefined
        ? {
            id: this.container.id
          }
        : undefined
    return {
      container
    }
  }

  /**
   * @implements Implements {@link Session.begin} by beginning
   * a session using a Docker container.
   */
  async begin(
    session: SoftwareSession,
    onFail?: () => void
  ): Promise<SoftwareSession> {
    const {
      id = '',
      environment,
      memoryRequest,
      memoryLimit,
      cpuRequest,
      cpuLimit,
      networkTransferRequest,
      networkTransferLimit,
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

    // Set memory, CPU etc as minimum of requests and limits
    const memory = optionalMin(memoryRequest, memoryLimit)
    const cpuQuota = optionalMin(cpuRequest, cpuLimit)
    const networkTransfer = optionalMin(
      networkTransferRequest,
      networkTransferLimit
    )

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
    const container = (this.container = await docker.createContainer({
      Image: image,
      // Open a stdin stream to the container for stdio transport
      OpenStdin: true,
      // Reduce the shutdown timeout. Another alternative is
      // to set StopSignal to 'SIGKILL' to stop the process immediately
      // (the default is SIGTERM).
      // But this approach allows for some gracefulness in shutdown.
      // @ts-ignore that StopTimeout is not a defined option
      StopTimeout: 5,
      // Add Sparkla labels to be able to filter these easily
      Labels: {
        sparklaId: id
      },
      // Disable network if allowed network transfer is zero or less
      NetworkDisabled: networkTransfer !== undefined && networkTransfer <= 0,
      HostConfig: {
        // Memory limit in bytes. Default 0
        Memory: memory !== undefined ? memory * BYTES_PER_GIB : undefined,
        // The length of a CPU period in microseconds.
        CpuPeriod: CPU_PERIOD,
        // Microseconds of CPU time that the container can get in a CPU period.
        // Will error if less than 1000.
        CpuQuota:
          cpuQuota !== undefined
            ? Math.max(1000, cpuQuota * CPU_PERIOD)
            : undefined,
        // Specification for mounts to be added to the container.
        Mounts: mounts
      }
    }))

    await container.start()

    // Attach to the container. Use "HTTP hijacking" for
    // separate `stdin` and `stdout`
    const stream = (this.stream = await container.attach({
      stream: true,
      hijack: true,
      stdin: true,
      stdout: true,
      stderr: false
    }))

    // De-multiplex the stream to split stdout from stderr
    const stdout = new PassThrough()
    docker.modem.demuxStream(stream, stdout, process.stderr)

    // @ts-ignore that 'ReadWriteStream' is not assignable to parameter of type 'Writable'
    this.client = new StreamClient(stream, stdout)

    // Register `close` event handler
    if (onFail !== undefined) stream.on('close', onFail)

    return session
  }

  execute(node: Node): Promise<Node> {
    const { client } = this
    if (client === undefined)
      throw new Error('Attempting to execute() before begin()?')
    return client.execute(node)
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
   * End a session being managed by this class.
   */
  async end(node: SoftwareSession): Promise<SoftwareSession> {
    const { container, stream, client } = this
    if (client !== undefined) await client.stop()
    if (stream !== undefined) {
      // Avoid unnecessary log errors and attempts to restart container
      // by removing listeners on stream close
      stream.removeAllListeners('close')
      stream.destroy()
    }
    if (container !== undefined) {
      try {
        await container.stop()
        await container.remove()
      } catch (error) {
        // The session may have been removed already, in which case,
        // ignore that error
        const message = error.message as string
        if (
          !(
            message.includes('No such container') ||
            message.includes('already in progress')
          )
        )
          throw error
      }
    }
    return node
  }

  /**
   * End all sessions being managed by this class.
   */
  static async endAll(): Promise<void> {
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
        if (info.State === 'running') {
          const session = new DockerSession(container)
          await session.end(softwareSession())
        }
      })
    )
  }
}
