import { getLogger } from '@stencila/logga';
import * as childProcess from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
import * as lps from 'length-prefixed-stream'
import * as path from 'path';
import { promisify } from 'util';

const spawn = childProcess.spawn
const exec = promisify(childProcess.exec)
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
  vmConnect: net.Socket

  vmRequests = {}

  vmRequestCount: number = 0

  vmEncoder: any

  constructor () {
    this.id = crypto.randomBytes(32).toString('hex')
    this.kernel = path.join(__dirname, '..', 'guest', 'kernel', 'default', 'kernel.bin')
    this.rootfs =  path.join(__dirname, '..', 'guest', 'rootfs', 'alpine', 'rootfs.ext4')
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
  get fcSocket(): string {
    return `${this.home}/fc-api.sock`
  }

  /**
   * Path to the microVM's JSON RPC socket file 
   */
  get vmSocket(): string {
    return `${this.home}/vm-rpc.sock`
  }
  
  async start () {
    // Create home dir
    // TODO: When using Jailer this may not be necessary
    fs.mkdirSync(this.home)

    // Create the VM
    this.process = spawn(
      `./firecracker`,
      [
        `--api-sock=${this.fcSocket}`,
        `--id=${this.id}`
      ]
    )
    this.process.stdout.pipe(fs.createWriteStream(`${this.home}/stdout.txt`))
    this.process.stderr.pipe(fs.createWriteStream(`${this.home}/stderr.txt`))
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
    await this.fcPut('/boot-source', {
      kernel_image_path: this.kernel,
      boot_args: this.bootArgs
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
      vsock_id: "1",
      // The VSOCK Context Identifier (CID) on the guest
      // See http://man7.org/linux/man-pages/man7/vsock.7.html
      guest_cid: 3,
      // Path to the UDS on the host
      uds_path: this.vmSocket
    })

    log.debug(`${this.id}:vsock-setup`)

    // Start the instance
    await this.fcPut('/actions', {
      action_type: 'InstanceStart'
    })
    log.info(`${this.id}:started`)

    await new Promise(resolve => setTimeout(resolve, 1000))

    // Create the connection to the VM
    // See https://github.com/firecracker-microvm/firecracker/blob/master/docs/vsock.md#host-initiated-connections
    // for steps required.
    this.vmConnect = net.connect(this.vmSocket)// : net.connect(7300, '127.0.0.1')
    this.vmConnect.on('connect', () => {
      log.debug(`${this.id}:connected`)
      this.vmConnect.write(`CONNECT 7300\n`)
    })
    this.vmConnect.on('error', error => {
      log.error(`${this.id}:${error}`)
    })
    this.vmConnect.on('close', () => {
      // If there is no server listening in the VM then the connection will be closed.
      // > "If no one is listening, Firecracker will terminate the host connection.")
      log.debug(`${this.id}:connection-closed`)
    })

    const decoder = lps.decode()
    this.vmConnect.pipe(decoder)
    decoder.on('data', response => this.receive(response))

    this.vmEncoder = lps.encode()
    this.vmEncoder.pipe(this.vmConnect)
  }

  async info () {
    return await this.fcGet('/')
  }

  async reboot () {
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
  async stop () {
    this.vmConnect.destroy()
    this.process.kill()
    log.info(`${this.id}:stopped`)
  }

  async call (method: string, ...params: any): Promise<any> {
    this.vmRequestCount += 1
    const id = this.vmRequestCount
    
    const promise = new Promise<any>((resolve, reject) => {
      this.vmRequests[id] = (response) => {
        resolve(response.result)
      }
    })
    
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    }
    this.send(request)

    return promise
  }
    
  send (request: object): void {
    const json = JSON.stringify(request)
    log.debug(`${this.id}:send:${json}`)

    this.vmEncoder.write(json)
  }

  receive (json: string): void {
    log.debug(`${this.id}:receive:${json}`)
    
    const response = JSON.parse(json)
    const resolve = this.vmRequests[response.id]
    resolve(response)
    delete this.vmRequests['response.id']
  }

  private async fcRequest (method: 'GET' | 'PUT' | 'PATCH', path: string, body?: object): Promise<object> {
    return new Promise((resolve, reject) => {
      const request = http.request({
        socketPath: this.fcSocket,
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
  
  private async fcGet (path: string): Promise<object> {
    return this.fcRequest('GET', path)
  }

  private async fcPut (path: string, body: object): Promise<object> {
    return this.fcRequest('PUT', path, body)
  }

  private async fcPatch (path: string, body: object): Promise<object> {
    return this.fcRequest('PATCH', path, body)
  }

}
