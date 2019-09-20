/** 
 * Start, and interact with, a new `Machine` attached to the current terminal. 
 * 
 * Mainly intended for testing the rootfs and host-guest
 * communication by "shelling into" the guest.
 */

import Machine from './Machine'

;(async () => {
  const machine = new Machine({
    stdio: 'inherit'
  })
  await machine.start()
})()
