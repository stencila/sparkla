import {
  AggregationType,
  globalStats,
  MeasureUnit,
  TagMap
} from '@opencensus/core'
import { PrometheusStatsExporter } from '@opencensus/exporter-prometheus'
import { getLogger, LogData, LogLevel } from '@stencila/logga'
import { SoftwareSession } from '@stencila/schema'
import osu from 'node-os-utils'
import pkg from './pkg'

const log = getLogger('sparkla:stats')

// Deployment related statistics

const versionMeasure = globalStats.createMeasureDouble(
  'sparkla/version',
  MeasureUnit.UNIT,
  'The package version number'
)

const versionView = globalStats.createView(
  'sparkla/view_version',
  versionMeasure,
  AggregationType.LAST_VALUE,
  [],
  'The package version number'
)
globalStats.registerView(versionView)

export function recordVersion() {
  try {
    const match = /^(\d+)\.(\d+)\.(\d+)/.exec(pkg.version)
    if (match !== null) {
      const [_, major, minor, patch] = match
      const value =
        parseFloat(major) + parseFloat(minor) / 100 + parseFloat(patch) / 10000
      globalStats.record([{ measure: versionMeasure, value }])
    }
  } catch (error) {
    log.error(error)
  }
}

const logLevelTagKey = { name: 'logLevel' }

const logEventMeasure = globalStats.createMeasureInt64(
  'sparkla/log_event',
  MeasureUnit.UNIT,
  'The number of log events'
)

const logEventMeasureView = globalStats.createView(
  'sparkla/view_log_event',
  logEventMeasure,
  AggregationType.COUNT,
  [logLevelTagKey],
  'The number of log events'
)
globalStats.registerView(logEventMeasureView)

export function recordLogData(data: LogData) {
  const { level } = data
  const tags = new TagMap()
  tags.set(logLevelTagKey, { value: LogLevel[level] })
  globalStats.record([{ measure: logEventMeasure, value: 1 }], tags)
}

// Session related statistics

const sessionTypeTagKey = { name: 'type' }
const sessionStatusTagKey = { name: 'status' }
const sessionEnvironTagKey = { name: 'environ' }

function createSessionTags(session: SoftwareSession, type: string) {
  const {
    status = 'undefined',
    environment: { name } = { name: 'undefined' }
  } = session

  const tags = new TagMap()
  tags.set(sessionTypeTagKey, { value: type })
  tags.set(sessionStatusTagKey, { value: status })
  tags.set(sessionEnvironTagKey, { value: name })

  return tags
}

const sessionCountMeasure = globalStats.createMeasureInt64(
  'sparkla/session_count',
  MeasureUnit.UNIT,
  'The number of sessions created'
)

const sessionCountView = globalStats.createView(
  'sparkla/view_session_count',
  sessionCountMeasure,
  AggregationType.COUNT,
  [sessionTypeTagKey, sessionStatusTagKey, sessionEnvironTagKey],
  'The number of sessions created'
)
globalStats.registerView(sessionCountView)

export function recordSession(session: SoftwareSession, type: string): void {
  globalStats.record(
    [{ measure: sessionCountMeasure, value: 1 }],
    createSessionTags(session, type)
  )
}

const sessionBeginDurationMeasure = globalStats.createMeasureDouble(
  'sparkla/session_begin_duration',
  MeasureUnit.MS,
  'The time taken to begin a session'
)

const sessionBeginDurationView = globalStats.createView(
  'sparkla/view_session_begin_duration',
  sessionBeginDurationMeasure,
  AggregationType.LAST_VALUE,
  [sessionTypeTagKey, sessionEnvironTagKey],
  'The time taken to begin a session'
)
globalStats.registerView(sessionBeginDurationView)

export function recordSessionBeginDuration(
  value: number,
  session: SoftwareSession,
  type: string
): void {
  globalStats.record(
    [{ measure: sessionBeginDurationMeasure, value }],
    createSessionTags(session, type)
  )
}

const sessionEndDurationMeasure = globalStats.createMeasureDouble(
  'sparkla/session_end_duration',
  MeasureUnit.MS,
  'The time taken to end a session'
)

const sessionEndDurationView = globalStats.createView(
  'sparkla/view_session_end_duration',
  sessionEndDurationMeasure,
  AggregationType.LAST_VALUE,
  [sessionTypeTagKey, sessionEnvironTagKey],
  'The time taken to end a session'
)
globalStats.registerView(sessionEndDurationView)

export function recordSessionEndDuration(
  value: number,
  session: SoftwareSession,
  type: string
): void {
  globalStats.record(
    [{ measure: sessionEndDurationMeasure, value }],
    createSessionTags(session, type)
  )
}

const executeDurationMeasure = globalStats.createMeasureDouble(
  'sparkla/session_execute_duration',
  MeasureUnit.MS,
  'The time taken to execute a node'
)

const executeDurationView = globalStats.createView(
  'sparkla/view_session_execute_duration',
  executeDurationMeasure,
  AggregationType.LAST_VALUE,
  [sessionTypeTagKey],
  'The time taken to execute a node'
)
globalStats.registerView(executeDurationView)

export function recordExecuteDuration(value: number, type: string): void {
  const tags = new TagMap()
  tags.set(sessionTypeTagKey, { value: type })
  globalStats.record([{ measure: executeDurationMeasure, value }], tags)
}

// System level statistics

const memoryFreeMeasure = globalStats.createMeasureDouble(
  'sparkla/memory_free',
  MeasureUnit.KBYTE,
  'The amount of free memory'
)

const memoryUsedPercentMeasure = globalStats.createMeasureDouble(
  'sparkla/memory_used_percent',
  MeasureUnit.UNIT,
  'The percent of used memory'
)

const memoryFreeView = globalStats.createView(
  'sparkla/view_memory_free',
  memoryFreeMeasure,
  AggregationType.LAST_VALUE,
  [],
  'The amount of free memory'
)
globalStats.registerView(memoryFreeView)

const memoryUsedPercentView = globalStats.createView(
  'sparkla/view_memory_used_percent',
  memoryUsedPercentMeasure,
  AggregationType.LAST_VALUE,
  [],
  'The percent of used memory'
)
globalStats.registerView(memoryUsedPercentView)

const cpuUsagePercentMeasure = globalStats.createMeasureDouble(
  'sparkla/cpu_used_percent',
  MeasureUnit.UNIT,
  'The percent of used CPU'
)

const cpuUsagePercentView = globalStats.createView(
  'sparkla/view_cpu_used_percent',
  cpuUsagePercentMeasure,
  AggregationType.LAST_VALUE,
  [],
  'The percent of CPU used'
)
globalStats.registerView(cpuUsagePercentView)

const driveUsedPercentMeasure = globalStats.createMeasureDouble(
  'sparkla/drive_used_percent',
  MeasureUnit.UNIT,
  'The percent of root filesystem used.'
)

const driveUsedPercentView = globalStats.createView(
  'sparkla/view_drive_used_percent',
  driveUsedPercentMeasure,
  AggregationType.LAST_VALUE,
  [],
  'The percent of root filesystem used.'
)
globalStats.registerView(driveUsedPercentView)

/**
 * Record system level stats
 */
async function recordSystemStats() {
  try {
    const memInfo = await osu.mem.info()
    const cpuUsage = await osu.cpu.usage()
    const driveInfo = await osu.drive.info('/')
    globalStats.record([
      { measure: memoryFreeMeasure, value: memInfo.freeMemMb * 1024 },
      {
        measure: memoryUsedPercentMeasure,
        value: 100 - memInfo.freeMemPercentage
      },
      { measure: cpuUsagePercentMeasure, value: cpuUsage },
      // The `* 1` is necessary to make the value a `number`
      { measure: driveUsedPercentMeasure, value: driveInfo.usedPercentage * 1 }
    ])
  } catch (error) {
    log.error(error)
  }
}

/**
 * Start collecting system statistics and
 * exporting.
 *
 * @param interval The interval in seconds for collecting system stats.
 * @param prometheus The port number to serve Prometheus metrics on.
 */
export function start(interval: number, prometheus: number) {
  const record = () => {
    recordVersion()
    recordSystemStats().catch(error => log.error(error))
  }
  record()
  setInterval(record, interval * 1000)

  if (prometheus > 0) {
    const exporter = new PrometheusStatsExporter({
      port: prometheus,
      startServer: true
    })
    globalStats.registerExporter(exporter)
  }
}
