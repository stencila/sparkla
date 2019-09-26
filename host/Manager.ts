import FirecrackerMachine from './FirecrackerMachine'

export default class Manager {

  machines: {[key: string]: FirecrackerMachine} = {}

  async start (): Promise<string> {
    const machine = new FirecrackerMachine({})
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
