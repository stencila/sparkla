import { getLogger } from '@stencila/logga';
import * as childProcess from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
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
   * for restricting access to the machine (in addition to other
   * security measures e.g. JWT)
   */
  readonly id: string

  /**
   * Home directory for the VM on the host
   */
  private home: string

  /**
   * Handling of standard I/O
   * 
   * pipe: pipe stdout and stderr to files in the VM's home
   * inherit: pass throught stdout and stderr to/from the parent
   * 
   * See https://nodejs.org/api/child_process.html#child_process_options_stdio
   */
  private stdio: 'pipe' | 'inherit' = 'pipe'
  
  /**
   * Path to the Firecracker API socket on the host 
   */
  private apiSocket: string


  private connection: net.Socket


  readonly kernel = './hello-vmlinux.bin'

  readonly rootfs =  './hello-rootfs.ext4'
  readonly bootArgs = 'console=ttyS0 reboot=k panic=1 pci=off'

  //readonly rootfs = './src/guest/rootfs.ext4'
  //readonly bootArgs = 'console=ttyS1 reboot=k panic=1 pci=off'

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


  constructor (options: {
    stdio?: 'pipe' | 'inherit'
  } = {}) {
    const {stdio = 'pipe'} = options

    this.id = crypto.randomBytes(32).toString('hex')
    this.stdio = stdio
  }
  
  async start () {
    // TODO: Temporary mkdir pending use of Jailer (which should do this for us)
    this.home = `/tmp/vm-${this.id}`
    fs.mkdirSync(this.home)
    this.apiSocket = `${this.home}/api.socket`

    // Create the VM
    const vm = spawn(
      `./firecracker`,
      [
        `--api-sock=${this.apiSocket}`,
        `--id=${this.id}`
      ], {
        stdio: this.stdio
      }
    )
    if (this.stdio === 'pipe') {
      vm.stdout.pipe(fs.createWriteStream(`${this.home}/stdout.txt`))
      vm.stderr.pipe(fs.createWriteStream(`${this.home}/stderr.txt`))
    }
    vm.on('error', error => {
      log.error(error)
    })
    vm.on('exit', code => {
      if (code !== 0) log.error(`${this.id}:exited with code ${code}`)
      else log.debug(`${this.id}:exited normally`)
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

    this.connection.on('close', () => {
      // If there is no server listening in the VM then the connection will be closed.
      // > "If no one is listening, Firecracker will terminate the host connection.")
      log.debug(`${this.id}:connection-closed`)
    })
  }

  async info () {
    return await this.get('/')
  }

  async stop () {
    await this.put('/actions', {
      action_type: 'SendCtrlAltDel'
    })
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
