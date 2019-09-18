import { defaultHandler, LogLevel, replaceHandlers } from '@stencila/logga';
import Machine from './Machine';

/** 
 * Configure log handler to only show debug events during development
 */
replaceHandlers(data => {
  defaultHandler(data, {
    level: process.env.NODE_ENV === 'development' ? LogLevel.debug : LogLevel.info
  })
})

;(async () => {
  const machine = new Machine()
  await machine.start()
  console.log(await machine.info())
  await machine.stop()
})()
