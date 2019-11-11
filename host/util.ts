// @ts-ignore
import externalIP from 'external-ip'
import os from 'os'

/**
 * Get the minimum of two number, both of which may
 * be undefined.
 */
export function optionalMin(a?: number, b?: number): number | undefined {
  if (a === undefined && b === undefined) return undefined
  if (a === undefined) return b
  if (b === undefined) return a
  return Math.min(a, b)
}

/**
 * Get the local IP address of the machine.
 *
 * Returns `127.0.0.1` if there is no external IP address.
 */
export function localIP(): string {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address
      }
    }
  }
  return '127.0.0.1'
}

/**
 * Get the global IP address of the machine.
 *
 * Returns `0.0.0.0` if unable to get global IP address.
 */
export function globalIP(): Promise<string> {
  return new Promise(resolve =>
    externalIP({ getIP: 'parallel' })((error: Error | null, ip: string) =>
      error === null ? resolve(ip) : resolve('0.0.0.0')
    )
  )
}
