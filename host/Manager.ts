import FirecrackerMachine from './FirecrackerMachine'
import Machine from './Machine'
import DockerMachine from './DockerMachine'

interface MachineStartArgs {
  engine: string
  options: any
}

export default class Manager {
  machines: { [key: string]: Machine } = {}

  async start(args: MachineStartArgs): Promise<string> {
    let machine

    if (args.engine === 'firecracker')
      machine = new FirecrackerMachine(args.options)
    else if (args.engine === 'docker') machine = new DockerMachine(args.options)
    else throw new Error(`Unknown engine ${args.engine}`)
    await machine.start()
    this.machines[machine.id] = machine
    return machine.id
  }

  async info(id: string): Promise<object> {
    const machine = this.machines[id]
    return machine.info()
  }

  async stop(id: string): Promise<void> {
    const machine = this.machines[id]
    await machine.stop()
    delete this.machines[id]
  }

  async stopAll(): Promise<void> {
    for(let machineId in this.machines) {
      await this.stop(machineId)
    }
  }
}
