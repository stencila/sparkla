import * as childProcess from 'child_process'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'
import { promisify } from 'util'
import { Session } from './Session'
import { getLogger } from '@stencila/logga'
import { SoftwareSession } from '@stencila/schema'

const spawn = childProcess.spawn
const exec = promisify(childProcess.exec)

const log = getLogger('sparkla:firecracker')

export class FirecrackerSession extends Session {
  id: string

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
   * Child process of the VM.
   */
  private process?: childProcess.ChildProcess

  constructor(options: any = {}) {
    super()
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

  /* eslint-disable @typescript-eslint/camelcase */

  async begin(
    node: SoftwareSession,
    options: { attach?: boolean } = {}
  ): Promise<SoftwareSession> {
    const { attach = false } = options

    // Create home dir
    // TODO: When using Jailer this may not be necessary
    fs.mkdirSync(this.home)

    // Create the VM
    const process = (this.process = spawn(
      `./firecracker`,
      [`--api-sock=${this.fcSocketPath}`, `--id=${this.id}`],
      {
        stdio: attach ? 'inherit' : 'pipe'
      }
    ))
    if (process.stdout === null || process.stderr === null) {
      throw new Error()
    }
    if (!attach) {
      process.stdout.pipe(fs.createWriteStream(`${this.home}/stdout.txt`))
      process.stderr.pipe(fs.createWriteStream(`${this.home}/stderr.txt`))
    }
    process.on('error', error => {
      log.error(error)
    })
    process.on('exit', (code, signal) => {
      if (signal !== null) log.debug(`${this.id}:exited:${signal}`)
      else if (code !== 0) log.error(`${this.id}:exited:${code}`)
      else log.debug(`${this.id}:exited`)
    })
    log.debug(`${this.id}:created`)

    // Define the boot source
    await this.fcPut('/boot-source', {
      kernel_image_path: this.kernel,
      boot_args: (attach ? 'console=ttyS0 ' : '') + this.bootArgs
    })
    log.debug(`${this.id}:boot-defined`)

    // Define the root filesystem
    await this.fcPut('/drives/rootfs', {
      drive_id: 'rootfs',
      path_on_host: this.rootfs,
      is_root_device: true,
      is_read_only: false
    })
    log.debug(`${this.id}:root-defined`)

    // Set up logger
    const logFifo = `${this.home}/log.fifo`
    const metricsFifo = `${this.home}/metrics.fifo`
    await exec(`mkfifo ${logFifo}`)
    await exec(`mkfifo ${metricsFifo}`)
    await this.fcPut('/logger', {
      log_fifo: logFifo,
      metrics_fifo: metricsFifo
    })
    log.debug(`${this.id}:logger-setup`)

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

    log.debug(`${this.id}:vsock-setup`)

    // Start the instance
    await this.fcPut('/actions', {
      action_type: 'InstanceStart'
    })
    log.info(`${this.id}:started`)

    await new Promise(resolve => setTimeout(resolve, 1000))

    return node
  }

  info(): Promise<object> {
    return this.fcGet('/')
  }

  async reboot() {
    await this.fcPut('/actions', {
      action_type: 'SendCtrlAltDel'
    })
    log.info(`${this.id}:rebooted`)
  }

  /**
   * Stop the VM.
   *
   * Currently there is no way to gracefully shutdown the Firecracker VM.
   * See https://github.com/firecracker-microvm/firecracker/blob/master/FAQ.md#how-can-i-gracefully-reboot-the-guest-how-can-i-gracefully-poweroff-the-guest
   */
  end(node: SoftwareSession): Promise<SoftwareSession> {
    if (this.process !== undefined) {
      // this.vmSocket.destroy()
      this.process.kill()
      log.info(`${this.id}:stopped`)
    }
    return Promise.resolve(node)
  }

  /* eslint-enable @typescript-eslint/camelcase */

  private fcRequest(
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
          const parts: any[] = []
          response.on('data', data => parts.push(data))
          response.on('error', reject)
          response.on('end', () => {
            const { statusCode = 200 } = response
            const body = Buffer.concat(parts).toString()
            if (statusCode > 299) {
              let message
              try {
                message = JSON.parse(body).fault_message
              } catch {
                message = ''
              }
              log.error(`request error: ${statusCode} ${message}`)
              return reject(new Error(message))
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
