/**
 * LatencyFacade — convenience wrappers over `breakdown` and `timeseries`
 * for the most common latency questions. Pure delegation; the named REST
 * surface is the source of truth.
 */

import type { ConvaiAnalytics } from "../client.js";
import type {
  BreakdownResponse,
  TimeseriesResponse,
  CommonFilters,
  TimeRange,
  Percentile,
} from "../types.js";

export interface LatencyByComponentParams extends TimeRange, CommonFilters {
  /** Default p95. */
  percentile?: Percentile;
}

export interface LatencyOverTimeParams extends TimeRange, CommonFilters {
  /** Defaults to ['p50', 'p95', 'p99']. */
  percentiles?: Percentile[];
  granularity?: "minute" | "hour" | "day";
}

export class LatencyFacade {
  readonly #client: ConvaiAnalytics;

  constructor(client: ConvaiAnalytics) {
    this.#client = client;
  }

  /**
   * "Which component contributes most to my p95 end-to-end latency?"
   * Delegates to `breakdown(measure='turnP95', groupBy='processor', segment='endToEndTurnLatency')`.
   */
  byComponent(params: LatencyByComponentParams = {}): Promise<BreakdownResponse> {
    const { percentile = "p95", ...rest } = params;
    return this.#client.breakdown({
      measure: percentileMeasure(percentile),
      groupBy: "processor",
      segment: "endToEndTurnLatency",
      ...rest,
    });
  }

  /**
   * "Plot p50/p95/p99 end-to-end latency over time."
   * Delegates to `timeseries(measure='turnP95', metricName='voice.user_to_bot_latency')`.
   * NOTE: returns one timeseries per call; loop over `percentiles` to plot multiple.
   */
  overTime(params: LatencyOverTimeParams = {}): Promise<TimeseriesResponse> {
    const { percentiles = ["p95"], granularity, ...rest } = params;
    const percentile = percentiles[0] ?? "p95";
    return this.#client.timeseries({
      measure: percentileMeasure(percentile),
      metricName: "voice.user_to_bot_latency",
      granularity,
      ...rest,
    });
  }
}

function percentileMeasure(p: Percentile): string {
  // Cube measure names: turnP50, turnP75, turnP90, turnP95, turnP99
  return `turn${p.toUpperCase()}`;
}
