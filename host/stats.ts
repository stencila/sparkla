import { AggregationType, globalStats, MeasureUnit } from '@opencensus/core'
import { PrometheusStatsExporter } from '@opencensus/exporter-prometheus'
import { getLogger } from '@stencila/logga'
import osu from 'node-os-utils'

const log = getLogger('sparkla:stats')

const statusTagKey = { name: 'status' }
const statisticsTagKey = { name: 'statistics' }

// Session related statistics

const sessionsMeasure = globalStats.createMeasureInt64(
  'sparkla/sessions_count',
  MeasureUnit.UNIT,
  'The number of sessions running'
)

const sessionsCountView = globalStats.createView(
  'sparkla/view_sessions_count',
  sessionsMeasure,
  AggregationType.COUNT,
  [statusTagKey],
  'The number of sessions running'
)
globalStats.registerView(sessionsCountView)

export function recordSessions(value: number): void {
  globalStats.record([{ measure: sessionsMeasure, value }])
}

const executionDurationMeasure = globalStats.createMeasureDouble(
  'sparkla/session_execution_duration',
  MeasureUnit.MS,
  'The time taken to execute a node'
)

const executionDurationView = globalStats.createView(
  'sparkla/view_session_execution_duration',
  executionDurationMeasure,
  AggregationType.LAST_VALUE,
  [statisticsTagKey],
  'The time taken to execute a node'
)
globalStats.registerView(executionDurationView)

export function executionDuration(value: number): void {
  globalStats.record([{ measure: executionDurationMeasure, value }])
}

// Docker sessions

const dockerSessionStartDurationMeasure = globalStats.createMeasureDouble(
  'sparkla/docker_session_start_duration',
  MeasureUnit.MS,
  'The time taken to start a Docker session'
)

const dockerSessionStartDurationView = globalStats.createView(
  'sparkla/view_firecracker_session_start_duration',
  dockerSessionStartDurationMeasure,
  AggregationType.LAST_VALUE,
  [statisticsTagKey],
  'The time taken to start a Docker session'
)
globalStats.registerView(dockerSessionStartDurationView)

export function dockerSessionStartDuration(value: number): void {
  globalStats.record([{ measure: dockerSessionStartDurationMeasure, value }])
}

const dockerSessionStopDurationMeasure = globalStats.createMeasureDouble(
  'sparkla/firecracker_session_stop_duration',
  MeasureUnit.MS,
  'The time taken to stop a Docker session'
)

const dockerSessionStopDurationView = globalStats.createView(
  'sparkla/view_firecracker_session_stop_duration',
  dockerSessionStopDurationMeasure,
  AggregationType.LAST_VALUE,
  [statisticsTagKey],
  'The time taken to stop a Docker session'
)
globalStats.registerView(dockerSessionStopDurationView)

export function dockerSessionStopDuration(value: number): void {
  globalStats.record([{ measure: dockerSessionStopDurationMeasure, value }])
}

// Firecracker sessions

const firecrackerSessionStartDurationMeasure = globalStats.createMeasureDouble(
  'sparkla/firecracker_session_start_duration',
  MeasureUnit.MS,
  'The time taken to start a Firecracker session'
)

const firecrackerSessionStartDurationView = globalStats.createView(
  'sparkla/view_firecracker_session_start_duration',
  firecrackerSessionStartDurationMeasure,
  AggregationType.LAST_VALUE,
  [statisticsTagKey],
  'The time taken to start a Firecracker session'
)
globalStats.registerView(firecrackerSessionStartDurationView)

export function firecrackerSessionStartDuration(value: number): void {
  globalStats.record([
    { measure: firecrackerSessionStartDurationMeasure, value }
  ])
}

const firecrackerSessionStopDurationMeasure = globalStats.createMeasureDouble(
  'sparkla/firecracker_session_stop_duration',
  MeasureUnit.MS,
  'The time taken to stop a Firecracker session'
)

const firecrackerSessionStopDurationView = globalStats.createView(
  'sparkla/view_firecracker_session_stop_duration',
  firecrackerSessionStopDurationMeasure,
  AggregationType.LAST_VALUE,
  [statisticsTagKey],
  'The time taken to stop a Firecracker session'
)
globalStats.registerView(firecrackerSessionStopDurationView)

export function firecrackerSessionStopDuration(value: number): void {
  globalStats.record([
    { measure: firecrackerSessionStopDurationMeasure, value }
  ])
}

// System level statistics

const freeMemoryMeasure = globalStats.createMeasureDouble(
  'sparkla/memory_free',
  MeasureUnit.KBYTE,
  'The amount of free memory'
)

const usedPercentMemoryMeasure = globalStats.createMeasureDouble(
  'sparkla/memory_used_percent',
  MeasureUnit.UNIT,
  'The percent of used memory'
)

const cpuUsagePercentMeasure = globalStats.createMeasureDouble(
  'sparkla/cpu_used_percent',
  MeasureUnit.UNIT,
  'The percent of used CPU'
)

const freeMemoryView = globalStats.createView(
  'sparkla/view_memory_free',
  freeMemoryMeasure,
  AggregationType.LAST_VALUE,
  [statusTagKey],
  'The amount of free memory'
)
globalStats.registerView(freeMemoryView)

const usedPercentMemoryView = globalStats.createView(
  'sparkla/view_memory_used_percent',
  usedPercentMemoryMeasure,
  AggregationType.LAST_VALUE,
  [statusTagKey],
  'The percent of used memory'
)
globalStats.registerView(usedPercentMemoryView)

const cpuUsagePercentView = globalStats.createView(
  'sparkla/view_cpu_used_percent',
  cpuUsagePercentMeasure,
  AggregationType.LAST_VALUE,
  [statusTagKey],
  'The percent of CPU used'
)
globalStats.registerView(cpuUsagePercentView)

/**
 * Record system level stats
 */
async function recordSystemStats() {
  try {
    const memInfo = await osu.mem.info()
    globalStats.record([
      { measure: freeMemoryMeasure, value: memInfo.freeMemMb * 1024 },
      {
        measure: usedPercentMemoryMeasure,
        value: 100 - memInfo.freeMemPercentage
      }
    ])

    const cpuUsage = await osu.cpu.usage()
    globalStats.record([{ measure: cpuUsagePercentMeasure, value: cpuUsage }])
  } catch (error) {
    log.error(error)
  }
}

/**
 * Start collecting system statistics and
 * exporting .
 *
 * @param interval The interval in seconds for collecting system stats.
 * @param prometheus The port number to serve Prometheus metrics on.
 */
export function start(interval: number, prometheus: number) {
  const record = () => {
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
