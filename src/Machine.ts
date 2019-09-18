import { getLogger } from '@stencila/logga';
import * as childProcess from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import {promisify} from 'util'

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
   * Path to the socket on the host 
   */
  private socket: string

  readonly kernel = './hello-vmlinux.bin'

  readonly bootArgs = 'console=ttyS0 reboot=k panic=1 pci=off'

  readonly rootfs = './hello-rootfs.ext4'

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


  constructor () {
    this.id = crypto.randomBytes(32).toString('hex')
  }
  
  async start () {
    // TODO: Temporary mkdir pending use of Jailer (which should do this for us)
    this.home = `/tmp/vm-${this.id}`
    fs.mkdirSync(this.home)
    this.socket = `${this.home}/socket`

    // Create the VM
    const vm = spawn(
      `./firecracker`,
      [
        `--api-sock=${this.socket}`,
        `--id=${this.id}`
      ]
    )
    vm.stdout.pipe(fs.createWriteStream(`${this.home}/stdout.txt`))
    vm.stderr.pipe(fs.createWriteStream(`${this.home}/stderr.txt`))
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

    // Start the instance
    await this.put('/actions', {
      action_type: 'InstanceStart'
    })
    log.info(`${this.id}:started`)
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
        socketPath: this.socket,
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
          if (response.statusCode > 299) {
            log.error(`request error: ${response.statusCode}`)
            return reject()
          }
          const body = Buffer.concat(parts).toString()
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
