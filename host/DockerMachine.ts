import * as childProcess from 'child_process'
import { promisify } from 'util'
import * as net from 'net'
import Machine from './Machine'

const exec = promisify(childProcess.exec)

const INTERNAL_PORT = 7300

export default class DockerMachine extends Machine {
  engine = 'docker'

  readonly image: string
  private port: number

  constructor(options: any) {
    super(options)
    this.image = options.image
  }

  async start(): Promise<void> {
    const { stdout, stderr } = await exec(
      [
        'docker',
        'run',
        '-d',
        '-p',
        `${INTERNAL_PORT}`,
        this.image,
        '/usr/bin/node',
        '/usr/bin/execution-server',
        '-t',
        `${INTERNAL_PORT}`
      ].join(' ')
    )

    this.id = stdout.trim()

    this.log.debug(`${this.engine}//${this.id}:created`)

    const portOutput = await exec(['docker', 'port', this.id].join(' '))

    this.port = parseInt(portOutput.stdout.trim().split(':')[1])

    this.log.debug(`${this.engine}//${this.id}:listening on TCP ${this.port}`)

    await new Promise(resolve => setTimeout(resolve, 1000))

    this.connect()
  }

  protected _connect(): net.Socket {
    const socket = net.connect(this.port, '127.0.0.1')

    socket.on('connect', () => {
      this.log.debug(`${this.engine}//${this.id}:connected`)
    })
    socket.on('error', error => {
      this.log.error(`${this.engine}//${this.id}:${error}`)
    })
    socket.on('close', () => {
      this.stop()
      this.log.debug(`${this.engine}//${this.id}:connection-closed`)
    })

    return socket
  }

  async stop() {
    this.log.debug(`${this.engine}//${this.id}:awaiting stop`)
    await exec(`docker stop ${this.id}`)
  }

  async info(): Promise<object> {
    return {
      id: this.id
    }
  }
}
