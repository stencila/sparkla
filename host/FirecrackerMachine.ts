import * as childProcess from 'child_process'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as http from 'http'
import * as net from 'net'
import * as path from 'path'
import { promisify } from 'util'
import Machine from './Machine'

const spawn = childProcess.spawn
const exec = promisify(childProcess.exec)

export default class FirecrackerMachine extends Machine {
  engine = 'firecracker'

  /**
   * Path to the kernel file
   */
  readonly kernel: string

  /**
   * Path to the rootfs ext4 file
   */
  readonly rootfs: string

  /**
   * Boot arguments
   */
  readonly bootArgs: string

  /**
   * Number of vCPUs (either 1 or an even number)
   */
  readonly cpus: number = 1

  /**
   * Memory size (Mib)
   */
  readonly memory: number = 512

  /**
   * Flag for enabling/disabling Hyperthreading
   */
  readonly hyperthreading: boolean

  /**
   * Child process of the VM.
   */
  private process: childProcess.ChildProcess

  constructor(options) {
    super(options)
    this.id = crypto.randomBytes(32).toString('hex')
    this.kernel = path.join(
      __dirname,
      '..',
      'guest',
      'kernel',
      'default',
      'kernel.bin'
    )
    this.rootfs = path.join(
      __dirname,
      '..',
      'guest',
      'rootfs',
      'alpine',
      'rootfs.ext4'
    )
    this.bootArgs = 'reboot=k panic=1 pci=off'
  }

  /**
   * Home directory of the VM on the host
   */
  get home(): string {
    // TODO: Temporary location pending use of Jailer (which uses a certain directory)
    return `/tmp/vm-${this.id}`
  }

  /**
   * Path to the Firecracker API socket file
   */
  get fcSocketPath(): string {
    return `${this.home}/fc-api.sock`
  }

  /**
   * Path to the microVM's JSON RPC socket file
   */
  get vmSocketPath(): string {
    return `${this.home}/vm-rpc.sock`
  }

  async start(options: { attach?: boolean } = {}) {
    const { attach = false } = options

    // Create home dir
    // TODO: When using Jailer this may not be necessary
    fs.mkdirSync(this.home)

    // Create the VM
    this.process = spawn(
      `./firecracker`,
      [`--api-sock=${this.fcSocketPath}`, `--id=${this.id}`],
      {
        stdio: attach ? 'inherit' : 'pipe'
      }
    )
    if (!attach) {
      this.process.stdout.pipe(fs.createWriteStream(`${this.home}/stdout.txt`))
      this.process.stderr.pipe(fs.createWriteStream(`${this.home}/stderr.txt`))
    }
    this.process.on('error', error => {
      this.log.error(error)
    })
    this.process.on('exit', (code, signal) => {
      if (signal !== null) this.log.debug(`${this.engine}//${this.id}:exited:${signal}`)
      else if (code !== 0) this.log.error(`${this.engine}//${this.id}:exited:${code}`)
      else this.log.debug(`${this.id}:exited`)
    })
    this.log.debug(`${this.engine}//${this.id}:created`)

    // Define the boot source
    await this.fcPut('/boot-source', {
      kernel_image_path: this.kernel,
      boot_args: (attach ? 'console=ttyS0 ' : '') + this.bootArgs
    })
    this.log.debug(`${this.engine}//${this.id}:boot-defined`)

    // Define the root filesystem
    await this.fcPut('/drives/rootfs', {
      drive_id: 'rootfs',
      path_on_host: this.rootfs,
      is_root_device: true,
      is_read_only: false
    })
    this.log.debug(`${this.engine}//${this.id}:root-defined`)

    // Set up logger
    const logFifo = `${this.home}/log.fifo`
    const metricsFifo = `${this.home}/metrics.fifo`
    await exec(`mkfifo ${logFifo}`)
    await exec(`mkfifo ${metricsFifo}`)
    await this.fcPut('/logger', {
      log_fifo: logFifo,
      metrics_fifo: metricsFifo
    })
    this.log.debug(`${this.engine}//${this.id}:logger-setup`)

    // Add a virtual socket for communicating with VM
    // See https://github.com/firecracker-microvm/firecracker/blob/master/docs/vsock.md
    // Note that this API endpoint will change in >v0.18 to `/vsock` (no id in path)
    // See https://github.com/firecracker-microvm/firecracker/commit/1ca64f5b86b5f83adb1758cb22cf699427d76ebc
    await this.fcPut('/vsocks/1', {
      vsock_id: '1',
      // The VSOCK Context Identifier (CID) on the guest
      // See http://man7.org/linux/man-pages/man7/vsock.7.html
      guest_cid: 3,
      // Path to the UDS on the host
      uds_path: this.vmSocketPath
    })

    this.log.debug(`${this.engine}//${this.id}:vsock-setup`)

    // Start the instance
    await this.fcPut('/actions', {
      action_type: 'InstanceStart'
    })
    this.log.info(`${this.engine}//${this.id}:started`)

    await new Promise(resolve => setTimeout(resolve, 1000))

    this.connect()
  }

  _connect(): net.Socket {
    // Create the connection to the VM
    // See https://github.com/firecracker-microvm/firecracker/blob/master/docs/vsock.md#host-initiated-connections
    // for steps required.
    const socket = net.connect(this.vmSocketPath)
    socket.on('connect', () => {
      this.log.debug(`${this.engine}//${this.id}:connected`)
      socket.write(`CONNECT 7300\n`)
    })
    socket.on('error', error => {
      this.log.error(`${this.engine}//${this.id}:${error}`)
    })
    socket.on('close', () => {
      // If there is no server listening in the VM then the connection will be closed.
      // > "If no one is listening, Firecracker will terminate the host connection.")
      this.log.debug(`${this.engine}//${this.id}:connection-closed`)
    })
    return socket
  }

  async info() {
    return await this.fcGet('/')
  }

  async reboot() {
    await this.fcPut('/actions', {
      action_type: 'SendCtrlAltDel'
    })
    this.log.info(`${this.engine}//${this.id}:rebooted`)
  }

  /**
   * Stop the VM.
   *
   * Currently there is no way to gracefully shutdown the Firecracker VM.
   * See https://github.com/firecracker-microvm/firecracker/blob/master/FAQ.md#how-can-i-gracefully-reboot-the-guest-how-can-i-gracefully-poweroff-the-guest
   */
  async stop() {
    this.vmSocket.destroy()
    this.process.kill()
    this.log.info(`${this.engine}//${this.id}:stopped`)
  }

  private async fcRequest(
    method: 'GET' | 'PUT' | 'PATCH',
    path: string,
    body?: object
  ): Promise<object> {
    return new Promise((resolve, reject) => {
      const request = http.request(
        {
          socketPath: this.fcSocketPath,
          method,
          path,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          }
        },
        response => {
          const parts = []
          response.on('data', data => parts.push(data))
          response.on('error', reject)
          response.on('end', () => {
            const { statusCode } = response
            const body = Buffer.concat(parts).toString()
            if (statusCode > 299) {
              let message
              try {
                message = JSON.parse(body).fault_message
              } catch {
                message = ''
              }
              this.log.error(`request error: ${statusCode} ${message}`)
              return reject()
            }
            if (body.length > 0) resolve(JSON.parse(body))
            else resolve()
          })
        }
      )
      request.on('error', reject)
      if (body !== undefined) {
        const json = Buffer.from(JSON.stringify(body))
        request.setHeader('Content-Length', json.length)
        request.end(json)
      } else {
        request.end()
      }
    })
  }

  private async fcGet(path: string): Promise<object> {
    return this.fcRequest('GET', path)
  }

  private async fcPut(path: string, body: object): Promise<object> {
    return this.fcRequest('PUT', path, body)
  }

  private async fcPatch(path: string, body: object): Promise<object> {
    return this.fcRequest('PATCH', path, body)
  }
}
