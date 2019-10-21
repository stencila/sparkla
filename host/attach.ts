/**
 * Start a Firecracker VM and attach to it's serial console.
 * Useful during development as a Firecracker debugging tool e.g. checking
 * rootfs, networking, volumes etc.
 *
 * Usage:
 *
 * ```bash
 * npx ts-node host/attach
 * ```
 *
 * Type `reboot` to shutdown the VM. If that doesn't work, you may
 * need to kill it in another terminal e.g.
 *
 * ```bash
 * pkill firecracker
 * ```
 */

import { FirecrackerSession } from './FirecrackerSession'
import { LogLevel, replaceHandlers, defaultHandler } from '@stencila/logga'

// Always, show all log events
replaceHandlers(data => defaultHandler(data, { level: LogLevel.debug }))

// Start with attach option on
const session = new FirecrackerSession()
session
  .begin(
    {
      type: 'SoftwareSession',
      environment: { type: 'Environment', name: 'stencila/sparkla-alpine' }
    },
    { attach: true }
  )
  .catch((error: Error) => {
    throw error
  })
