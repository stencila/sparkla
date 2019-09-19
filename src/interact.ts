/** 
 * Script intended for testing, starts a new microVM attached
 * so the current terminal. 
 */

import Machine from './Machine'

;(async () => {
  const machine = new Machine({
    stdio: 'inherit'
  })
  await machine.start()
})()
