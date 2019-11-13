#!/usr/bin/env node

import rc from 'rc'
import { Config } from './Config'
import pkg from './pkg'
import * as logs from './logs'
import { Manager } from './Manager'

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

// Set up logging
logs.setup(config)

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
