import * as net from 'net'
import { getLogger } from '@stencila/logga'
import * as lps from 'length-prefixed-stream'

const log = getLogger('sparkla:machine')

interface VmTransport {
  write(s: string)
  pipe(io: any)
}

export default abstract class Machine {
  protected readonly log = log

  readonly engine: string

  /**
   * A unique identifier for this machine
   *
   * Intended to be unguessable so that it may be used
   * as part of a [Capability URL](https://www.w3.org/TR/capability-urls/)
   * for restricting access to the WM (in addition to other
   * security measures e.g. JWT)
   */
  id: string

  /**
   * Socket connection to the VM.
   *
   * Used to pipe request / response data through
   * to the VM.
   */
  vmSocket: net.Socket

  vmRequests = {}

  vmRequestCount: number = 0

  vmTransport: VmTransport

  protected constructor(options) {}

  abstract async start(): Promise<void>

  abstract async stop(): Promise<void>

  async info(): Promise<object> {
    return {}
  }

  protected abstract _connect(): net.Socket

  connect() {
    this.vmSocket = this._connect()
    this.attachTransport()
  }

  async call(method: string, ...params: any): Promise<any> {
    this.vmRequestCount += 1
    const id = this.vmRequestCount

    const promise = new Promise<any>((resolve, reject) => {
      this.vmRequests[id] = response => {
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

  send(request: object): void {
    const json = JSON.stringify(request)
    this.log.debug(`${this.engine}//${this.id}:send:${json}`)

    this.vmTransport.write(json)
  }

  receive(json: string): void {
    this.log.debug(`${this.engine}//${this.id}:receive:${json}`)

    const response = JSON.parse(json)
    const resolve = this.vmRequests[response.id]
    resolve(response)
    delete this.vmRequests[response.id]
  }

  attachTransport(): void {
    const decoder = lps.decode()
    this.vmSocket.pipe(decoder)
    decoder.on('data', response => this.receive(response))

    this.vmTransport = lps.encode()
    this.vmTransport.pipe(this.vmSocket)
  }
}
