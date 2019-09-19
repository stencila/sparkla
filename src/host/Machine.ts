import { getLogger } from '@stencila/logga';
import * as childProcess from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
import * as path from 'path';
import { promisify } from 'util';

const spawn = childProcess.spawn
const exec = promisify(childProcess.exec)
const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)

const log = getLogger('sparkla:machine')

export default class Machine {

  /**
   * A unique identifier for this machine
   * 
   * Intended to be unguessable so that it may be used
   * as part of a [Capability URL](https://www.w3.org/TR/capability-urls/)
   * for restricting access to the WM (in addition to other
   * security measures e.g. JWT)
   */
  readonly id: string

  /**
   * Handling of standard I/O
   * 
   * pipe: pipe stdout and stderr to files in the VM's home
   * inherit: pass through stdout and stderr to/from the parent
   * 
   * See https://nodejs.org/api/child_process.html#child_process_options_stdio
   */
  private stdio: 'pipe' | 'inherit' = 'pipe'

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

  /**
   * Socket connection to the VM.
   * 
   * Used to pipe request / response data through
   * to the VM.
   */
  private connection: net.Socket


  constructor (options: {
    stdio?: 'pipe' | 'inherit'
  } = {}) {
    const {stdio = 'pipe'} = options

    this.id = crypto.randomBytes(32).toString('hex')
    this.stdio = stdio

    this.kernel = path.join(__dirname, '..', 'guest', 'hello-vmlinux.bin')

    this.rootfs =  path.join(__dirname, '..', 'guest', 'hello-rootfs.ext4')
    this.bootArgs = 'console=ttyS0 reboot=k panic=1 pci=off'
  
    //this.rootfs = path.join(__dirname, '..', 'rootfs.ext4')
    //this.bootArgs = 'console=ttyS1 reboot=k panic=1 pci=off'
  }

  /**
   * Home directory of the VM on the host
   */
  get home() : string {
    // TODO: Temporary location pending use of Jailer (which uses a certain directory)
    return `/tmp/vm-${this.id}`
  }

  /**
   * Path to the Firecracker API socket file
   */
  get apiSocket() : string {
    return `${this.home}/api.sock`
  }
  
  async start () {
    // Create home dir
    // TODO: When using Jailer this may not be necessary
    fs.mkdirSync(this.home)

    // Create the VM
    this.process = spawn(
      `./firecracker`,
      [
        `--api-sock=${this.apiSocket}`,
        `--id=${this.id}`
      ], {
        stdio: this.stdio
      }
    )
    if (this.stdio === 'pipe') {
      this.process.stdout.pipe(fs.createWriteStream(`${this.home}/stdout.txt`))
      this.process.stderr.pipe(fs.createWriteStream(`${this.home}/stderr.txt`))
    }
    this.process.on('error', error => {
      log.error(error)
    })
    this.process.on('exit', (code, signal) => {
      if (signal !== null) log.debug(`${this.id}:exited:${signal}`)
      else if (code !== 0) log.error(`${this.id}:exited:${code}`)
      else log.debug(`${this.id}:exited`)
    })
    log.debug(`${this.id}:created`)

    // Define the boot source
    await this.put('/boot-source', {
      kernel_image_path: this.kernel,
      boot_args: this.bootArgs
    })
    log.debug(`${this.id}:boot-defined`)

    // Define the root filesystem
    await this.put('/drives/rootfs', {
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
    await this.put('/logger', {
      log_fifo: logFifo,
      metrics_fifo: metricsFifo
    })
    log.debug(`${this.id}:logger-setup`)

    // Add a virtual socket for communicating with VM
    // See https://github.com/firecracker-microvm/firecracker/blob/master/docs/vsock.md
    // Note that this API endpoint will change in >v0.18 to `/vsock` (no id in path)
    // See https://github.com/firecracker-microvm/firecracker/commit/1ca64f5b86b5f83adb1758cb22cf699427d76ebc
    const connectionSocket = `${this.home}/virtual.socket`
    await this.put('/vsocks/1', {
      vsock_id: "1",
      // The VSOCK Content Identifier (CID) on the guest
      // See http://man7.org/linux/man-pages/man7/vsock.7.html
      // According to that, CID -1 to 2 are special and the Firecracker examples use CID 3.
      //So that's what we use here....
      guest_cid: 3,
      // Path to the UDS on the host
      uds_path: connectionSocket
    })

    log.debug(`${this.id}:vsock-setup`)

    // Start the instance
    await this.put('/actions', {
      action_type: 'InstanceStart'
    })
    log.info(`${this.id}:started`)

    // Create the connection to the VM
    // See https://github.com/firecracker-microvm/firecracker/blob/master/docs/vsock.md#host-initiated-connections
    // for steps required.
    this.connection = net.connect(connectionSocket)
    this.connection.on('connect', () => {
      log.debug(`${this.id}:connected`)
      this.connection.write(`CONNECT 80\n`)
    })
    this.connection.on('error', error => {
      log.error(error)
    })
    this.connection.on('close', () => {
      // If there is no server listening in the VM then the connection will be closed.
      // > "If no one is listening, Firecracker will terminate the host connection.")
      log.debug(`${this.id}:connection-closed`)
    })
  }

  async info () {
    return await this.get('/')
  }

  async reboot () {
    await this.put('/actions', {
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
  async stop () {
    this.connection.destroy()
    this.process.kill()
    log.info(`${this.id}:stopped`)
  }

  private async request (method: 'GET' | 'PUT' | 'PATCH', path: string, body?: object): Promise<object> {
    return new Promise((resolve, reject) => {
      const request = http.request({
        socketPath: this.apiSocket,
        method,
        path,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }, response => {
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
            log.error(`request error: ${statusCode} ${message}`)
            return reject()
          }
          if (body.length > 0) resolve(JSON.parse(body))
          else resolve()
        })
      })
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
  
  private async get (path: string): Promise<object> {
    return this.request('GET', path)
  }

  private async put (path: string, body: object): Promise<object> {
    return this.request('PUT', path, body)
  }

  private async patch (path: string, body: object): Promise<object> {
    return this.request('PATCH', path, body)
  }

}
