import Machine from './Machine'

;(async () => {
  const machine = new Machine()
  await machine.start()
  console.log(await machine.info())
  await machine.stop()
})()
