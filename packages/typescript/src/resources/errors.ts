/**
 * ErrorsFacade — error analytics convenience wrappers.
 *
 * Note: this file collides in name only with apiErrors.ts (exception
 * classes). Different concerns: this is the data-side resource for
 * querying error metrics; apiErrors.ts is for HTTP error handling.
 */

import type { ConvaiAnalytics } from "../client.js";
import type {
  BreakdownResponse,
  TimeseriesResponse,
  CommonFilters,
  TimeRange,
} from "../types.js";

export interface ErrorSummaryParams extends TimeRange, CommonFilters {
  /** Default 'processor'. Other useful values: 'provider', 'errorCode'. */
  groupBy?: "processor" | "provider" | "errorCode" | "characterId";
}

export interface ErrorRateParams extends TimeRange, CommonFilters {
  granularity?: "minute" | "hour" | "day";
}

export class ErrorsFacade {
  readonly #client: ConvaiAnalytics;

  constructor(client: ConvaiAnalytics) {
    this.#client = client;
  }

  /**
   * "How many errors did I have, broken down by component?"
   * Delegates to `breakdown(measure='count', metricNamePrefix='error.')`.
   */
  summary(params: ErrorSummaryParams = {}): Promise<BreakdownResponse> {
    const { groupBy = "processor", ...rest } = params;
    return this.#client.breakdown({
      measure: "count",
      groupBy,
      metricNamePrefix: "error.",
      ...rest,
    });
  }

  /**
   * "Plot error count over time."
   * Delegates to `timeseries(measure='count', metricNamePrefix='error.')`.
   */
  overTime(params: ErrorRateParams = {}): Promise<TimeseriesResponse> {
    const { granularity, ...rest } = params;
    return this.#client.timeseries({
      measure: "count",
      metricNamePrefix: "error.",
      granularity,
      ...rest,
    });
  }
}
