/**
 * Serve the `Manager` to provide an API for starting,
 * stopping, and communicating with `FirecrackerMachine`s.
 */

import { defaultHandler, LogLevel, replaceHandlers } from '@stencila/logga'
import Manager from './Manager'

/**
 * Configure log handler to only show debug events during development
 */
replaceHandlers(data => {
  defaultHandler(data, {
    level:
      process.env.NODE_ENV === 'development' ? LogLevel.debug : LogLevel.info
  })
})

// Collect options from command line
let debug = false
let engine = 'firecracker'
for (const arg of process.argv.slice(2)) {
  if (arg === '--debug') debug = true
  if (arg === '--docker') engine = 'docker'
}

const manager = new Manager()

  // TODO: Implement. Currently just a stub that starts a single machine
;(async () => {
  let stopped = false
  process.on('SIGINT', async () => {
    stopped = true
    await manager.stopAll()
  })

  process.on('beforeExit', async () => {
    if (!stopped) await manager.stopAll()
  })
  const machineId = await manager.start({
    engine: 'docker',
    options: { image: 'sparkla:alpine' }
  })
})()
