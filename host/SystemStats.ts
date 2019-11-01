import { AggregationType, globalStats, MeasureUnit } from '@opencensus/core'
import osu from 'node-os-utils'
import { getLogger } from '@stencila/logga'
const POLL_INTERVAL_SECONDS = 60 * 1000

const log = getLogger('sparkla:systemStats')

const statusTagKey = { name: 'status' }

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

export class SystemStats {
  public setup(): void {
    SystemStats.recordStats()
    setInterval(() => {
      SystemStats.recordStats()
    }, POLL_INTERVAL_SECONDS)
  }

  public static recordStats(): void {
    osu.mem
      .info()
      .then(memInfo => {
        globalStats.record([
          { measure: freeMemoryMeasure, value: memInfo.freeMemMb * 1024 },
          {
            measure: usedPercentMemoryMeasure,
            value: 100 - memInfo.freeMemPercentage
          }
        ])
      })
      .catch(error => {
        log.error(error)
      })
    osu.cpu
      .usage()
      .then(cpuUsage => {
        globalStats.record([
          { measure: cpuUsagePercentMeasure, value: cpuUsage }
        ])
      })
      .catch(error => {
        log.error(error)
      })
  }
}
