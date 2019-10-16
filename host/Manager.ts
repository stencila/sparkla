import Machine from './Machine'
import DockerMachine from './DockerMachine'
import FirecrackerMachine from './FirecrackerMachine'
import Machine from './Machine'
import DockerMachine from './DockerMachine'

interface MachineClass {
  new (options?: object): FirecrackerMachine | DockerMachine
}

export default class Manager {
  machines: { [key: string]: Machine } = {}

  machineClass: MachineClass

  machines: {[key: string]: Machine} = {}

  constructor (machineClass: MachineClass) {
    this.machineClass = machineClass
  }

  async start (): Promise<string> {
    const machine = new this.machineClass()
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
