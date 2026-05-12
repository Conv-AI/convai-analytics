/**
 * LatencyFacade — convenience wrappers over `breakdown` and `timeseries`
 * for the most common latency questions. Pure delegation; the named REST
 * surface is the source of truth.
 */

import type { ConvaiAnalytics } from "../client.js";
import {
  GROUP_BY,
  METRIC_NAMES,
  rawValuePercentileMeasure,
  SEGMENTS,
} from "../measures.js";
import type {
  BreakdownResponse,
  CommonFilters,
  FirstResponseBreakdownParams,
  FirstResponseBreakdownResponse,
  FirstResponseSummaryParams,
  FirstResponseSummaryResponse,
  FirstResponseTimeseriesParams,
  FirstResponseTimeseriesResponse,
  Percentile,
  TimeRange,
  TimeseriesResponse,
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
   * Delegates to `breakdown(measure=p95Value, groupBy=processor, segment=endToEndTurnLatency)`.
   */
  byComponent(params: LatencyByComponentParams = {}): Promise<BreakdownResponse> {
    const { percentile = "p95", ...rest } = params;
    return this.#client.breakdown({
      measure: rawValuePercentileMeasure(percentile),
      groupBy: GROUP_BY.processor,
      segment: SEGMENTS.endToEndTurnLatency,
      ...rest,
    });
  }

  /**
   * "Plot p50/p95/p99 end-to-end latency over time."
   * Deprecated compatibility path for the legacy `voice.user_to_bot_latency`
   * metric. Prefer `latency.firstResponse*` for SLA reporting.
   */
  overTime(params: LatencyOverTimeParams = {}): Promise<TimeseriesResponse> {
    const { percentiles = ["p95"], granularity, ...rest } = params;
    const percentile = percentiles[0] ?? "p95";
    return this.#client.timeseries({
      measure: rawValuePercentileMeasure(percentile),
      metricName: METRIC_NAMES.voiceUserToBotLatency,
      granularity,
      ...rest,
    });
  }

  /** Character-first, mode-specific first-response SLA summary. */
  firstResponseSummary(
    params: FirstResponseSummaryParams,
  ): Promise<FirstResponseSummaryResponse> {
    return this.#client.firstResponse.summary(params);
  }

  /** Character-first, mode-specific first-response SLA time series. */
  firstResponseOverTime(
    params: FirstResponseTimeseriesParams,
  ): Promise<FirstResponseTimeseriesResponse> {
    return this.#client.firstResponse.timeseries(params);
  }

  /** Character-first, mode-specific first-response SLA breakdown. */
  firstResponseBreakdown(
    params: FirstResponseBreakdownParams,
  ): Promise<FirstResponseBreakdownResponse> {
    return this.#client.firstResponse.breakdown(params);
  }
}
