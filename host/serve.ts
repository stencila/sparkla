/**
 * Serve the `Manager`.
 * 
 * Usage examples:
 * 
 *    JWT_SECRET=not-a-secret npx ts-node-dev host/serve --debug --docker
 *    JWT_SECRET=not-a-secret npx ts-node host/serve
 *    JWT_SECRET=not-a-secret node dist/host/serve
 */

import { defaultHandler, LogLevel, replaceHandlers } from '@stencila/logga'
import { Manager, SessionType } from './Manager'
import {FirecrackerSession} from './FirecrackerSession';
import {DockerSession} from './DockerSession';

// Collect options from command line
let debug = false
let sessionType: SessionType = FirecrackerSession
for (const arg of process.argv.slice(2)) {
  if (arg === '--debug') debug = true
  if (arg === '--docker') sessionType = DockerSession
  if (arg === '--firecracker') sessionType = FirecrackerSession
}

/**
 * Configure log handler to only show debug events
 * if debug option specified
 */
replaceHandlers(data => {
  defaultHandler(data, {
    level:
      debug ? LogLevel.debug : LogLevel.info
  })
})

// Create and start manager using specified machine class
const manager = new Manager(sessionType)
manager.start().catch(error => {throw error })
