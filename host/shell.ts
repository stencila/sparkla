/**
 * A simple shell for testing connection to, and configuration of,
 * guest VMs. Defaults to using `sh`.
 * 
 * Usage:
 * 
 * ```bash
 * npm run dev:shell
 * ```
 * 
 * For full debug level log messages use:
 * 
 * ```bash
 * npm run dev:shell:debug
 * ```
 * 
 * Sends requests to execute a `CodeChunk` with `programmingLanguage: 'sh'`
 * to the VM and prints it's `outputs` to the console.
 */

import { LogLevel, replaceHandlers } from '@stencila/logga';
import * as readline from 'readline'
import Machine from './Machine'

const red = '\u001b[31;1m'
const blue = '\u001b[34;1m'
const grey = '\u001b[30;1m'
const reset = '\u001b[0m'

// Collect options from command line
let debug = false
for (const arg of process.argv.slice(2)) {
  if (arg === '--debug') debug = true
}

/** 
 * Configure log handler to only show `info` and `debug` events
 * when `--debug` flag is set
 */
replaceHandlers(data => {
  const { level, tag, message } = data
  if (level <= (debug ? LogLevel.debug : LogLevel.warn)) {
    process.stderr.write(`${grey}${tag}: ${LogLevel[level].toUpperCase()}: ${message}${reset}\n`)
  }
})

;(async () => {
  // Create and start a new VM
  const machine = new Machine()
  await machine.start()

  // Create the REPL with the starting prompt
  const repl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  repl.prompt()

  // For each line the user enters...
  repl.on('line', async (line: string) => {
    // When user enters a line, execute a shell `CodeChunk`
    const result = await machine.call('execute', {
      type: 'CodeChunk',
      programmingLanguage: 'sh',
      text: line
    })

    // Display any errors
    if (result.errors && result.errors.length > 0) {
      process.stderr.write(red)
      for (const error of result.errors) process.stderr.write(error || '')
      process.stderr.write(reset)
    }

    // Display any outputs
    if (result.outputs && result.outputs.length > 0) {
      process.stdout.write(blue)
      for (const output of result.outputs) process.stdout.write(output || '')
      process.stdout.write(reset)
    }

    // Provide a new prompt
    repl.prompt()
  })

})()
