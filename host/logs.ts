import {
  defaultHandler,
  LogLevel,
  replaceHandlers,
  addHandler
} from '@stencila/logga'
import * as Sentry from '@sentry/node'
import { Config } from './Config'
import pkg from './pkg'
import * as stats from './stats'

/**
 * Set up logging
 */
export function setup(config: Config) {
  const { debug, logsSentry } = config

  /**
   * Configure log handler to only show debug events
   * on stderr if debug option specified
   */
  replaceHandlers(data => {
    defaultHandler(data, {
      level: debug ? LogLevel.debug : LogLevel.info
    })
  })

  /**
   * Record log event levels to statistics
   */
  addHandler(data => stats.recordLogData(data))

  /**
   * Set up Sentry log handler
   */
  if (process.env.NODE_ENV !== 'development' && logsSentry !== null) {
    Sentry.init({
      release: pkg.version,
      dsn: logsSentry
    })
    addHandler(data => {
      const { level, message, stack } = data
      if (level === LogLevel.warn)
        Sentry.captureMessage(message, Sentry.Severity.Warning)
      else if (level === LogLevel.error)
        Sentry.captureException({ message, stack })
    })
  }
}
