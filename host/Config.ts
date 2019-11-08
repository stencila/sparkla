import { PrometheusStatsExporter } from '@opencensus/exporter-prometheus'

export class Config {
  /**
   * Output debug level log entries?
   */
  debug = false

  /**
   * The host address that the server should listen on.
   */
  host = '127.0.0.1'

  /**
   * The port that the server should listen on.
   */
  port = 9000

  /**
   * The class of sessions created.
   */
  sessionType: 'firecracker' | 'docker' = 'docker'

  /**
   * Interval in seconds between checks
   * for expired sessions.
   */
  expiryInterval = 15

  /**
   * Number of seconds to provide clients with
   * a warning prior to reaching maximum session duration.
   */
  durationWarning = 600

  /**
   * Number of seconds to provide clients with
   * a warning prior to a reaching session timeout.
   */
  timeoutWarning = 60

  /**
   * Interval in seconds between checks
   * for stale sessions.
   */
  staleInterval = 60

  /**
   * Number of seconds that a stopped session is
   * considered stale and will be removed from the list of sessions.
   */
  stalePeriod = 3600

  /**
   * Collect statistics on session and system status?
   */
  stats = true

  /**
   * Export stats for Prometheus?
   */
  prometheus = true
}