#!/usr/bin/env node

import { collectConfig, helpUsage } from '@stencila/configa/dist/run'
import { Config } from './config'
import configSchema from './config.schema.json'
import * as logs from './logs'
import { Manager } from './Manager'

// Collect configuration options
const { args = ['help'], options, config, valid, log } = collectConfig<Config>(
  'sparkla',
  configSchema
)

// Set up logging
logs.setup(config)

// Iterate over commands
args.map((command: string) => {
  switch (command) {
    case 'config':
      console.log(JSON.stringify(config, null, '  '))
      break
    case 'serve': {
      const manager = new Manager(config)
      manager.run().catch(error => log.error(error))
      break
    }
    case 'help':
    default:
      console.log(helpUsage(configSchema))
  }
})
