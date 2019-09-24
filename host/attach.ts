/**
 * Start a Firecracker VM and attach to it's serial console.
 * 
 * Usage:
 * 
 * ```bash
 * npm run dev:attach
 * # or
 * npx ts-node host/attach
 * ```
 * 
 * Type `reboot` to shutdown the VM. If that doesn't work, you may
 * need to kill the machine in another terminal e.g.
 * 
 * ```bash
 * pkill firecracker
 * ```
 */

import Machine from './Machine'
import { LogLevel, replaceHandlers, defaultHandler } from '@stencila/logga';

// Always, show all log events
replaceHandlers(data => defaultHandler(data, { level: LogLevel.debug }))

// Start with attach option on
const machine = new Machine()
machine.start({ attach: true })
