/**
 * Serve the `Manager` to provide an API for starting,
 * stopping, and communicating with `Machine`s.
 */

import { defaultHandler, LogLevel, replaceHandlers } from '@stencila/logga';
import Manager from './Manager';

/** 
 * Configure log handler to only show debug events during development
 */
replaceHandlers(data => {
  defaultHandler(data, {
    level: process.env.NODE_ENV === 'development' ? LogLevel.debug : LogLevel.info
  })
})

const manager = new Manager()
  
// TODO: Implement. Currently just a stub that starts a single machine
;(async () => {
  const machineId = await manager.start()
})()
