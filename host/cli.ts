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

import { defaultHandler, LogLevel, replaceHandlers } from '@stencila/logga'
import { Manager } from './Manager'
import { Config } from './Config'
import rc from 'rc'

const usage = `
Usage:
  sparkla [commands...] [options...]

Commands:
  serve           Start the Sparkla web socket server (default)
  config          Show the configuration that has been loaded
  help            Show this message

Options:
  --debug         Output debug level log entries?
  --host          The host address that the server should listen on
  --port          The port that the server should listen on
  --stats         Collect statistics?

  ...and many more, see the docs or provided config file.
`

let { _: commands, ...options } = rc('sparkla', new Config())
commands = commands.length === 0 ? ['serve'] : commands

const config = options as Config
const { debug } = config

/**
 * Configure log handler to only show debug events
 * if debug option specified
 */
replaceHandlers(data => {
  defaultHandler(data, {
    level: debug ? LogLevel.debug : LogLevel.info
  })
})

// Iterate over commands
commands.map((command: string) => {
  switch (command) {
    case 'config':
      return showConfig()
    case 'serve':
      return serve()
    case 'help':
    default:
      console.error(usage)
  }
})

function showConfig() {
  console.log(JSON.stringify(config, null, '  '))
}

async function serve() {
  const manager = new Manager(config)
  await manager.run()
}
