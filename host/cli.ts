#!/usr/bin/env node

/**
 * Command line interface to serve the `Manager`.
 *
 * Usage examples:
 *
 *    JWT_SECRET=not-a-secret npx ts-node-dev host/cli --debug --docker
 *    JWT_SECRET=not-a-secret npx ts-node host/cli
 *    JWT_SECRET=not-a-secret node dist/host/cli
 */

import {
  defaultHandler,
  LogLevel,
  replaceHandlers,
  getLogger
} from '@stencila/logga'
import { Manager, SessionType } from './Manager'
import { FirecrackerSession } from './FirecrackerSession'
import { DockerSession } from './DockerSession'

const log = getLogger('sparkla:cli')

// Collect options from command line
let debug = false
let sessionType: SessionType = FirecrackerSession
let host: string | undefined
let port: number | undefined
for (let index = 2; index < process.argv.length; index++) {
  const arg = process.argv[index]
  if (arg === '--debug') debug = true
  else if (arg === '--docker') sessionType = DockerSession
  else if (arg === '--firecracker') sessionType = FirecrackerSession
  else if (arg === '--host') host = process.argv[++index]
  else if (arg === '--port') port = parseFloat(process.argv[++index])
  else {
    log.warn(`Unrecognised argument will be ignored: ${arg}`)
  }
}

/**
 * Configure log handler to only show debug events
 * if debug option specified
 */
replaceHandlers(data => {
  defaultHandler(data, {
    level: debug ? LogLevel.debug : LogLevel.info
  })
})

// Create and start manager using specified session class
const manager = new Manager(sessionType, host, port)
manager.start().catch(error => {
  throw error
})
