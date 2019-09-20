import Machine from './Machine'

export default class Manager {

  machines: {[key: string]: Machine} = {}

  async start (): Promise<string> {
    const machine = new Machine()
    await machine.start()
    this.machines[machine.id] = machine
    return machine.id
  }

  async info (id: string): Promise<object> {
    const machine = this.machines[id]
    return machine.info()
  }

  async stop (id: string): Promise<void> {
    const machine = this.machines[id]
    await machine.stop()
    delete this.machines[id]
  }
}
