/**
 * ProvidersFacade — provider/model comparison helpers.
 */

import type { ConvaiAnalytics } from "../client.js";
import type { BreakdownResponse, CommonFilters, TimeRange, Percentile } from "../types.js";

export interface ProviderCompareParams extends TimeRange, CommonFilters {
  /** Restrict to one component (e.g. 'llm', 'tts'). Default: 'llm'. */
  component?: "llm" | "tts" | "asr" | "neurosync";
  /** Default p95. */
  percentile?: Percentile;
}

export class ProvidersFacade {
  readonly #client: ConvaiAnalytics;

  constructor(client: ConvaiAnalytics) {
    this.#client = client;
  }

  /**
   * "Compare LLM provider p95 latency over the last 7 days."
   * Delegates to `breakdown(groupBy='provider', segment=<component>Metrics)`.
   */
  compare(params: ProviderCompareParams = {}): Promise<BreakdownResponse> {
    const { component = "llm", percentile = "p95", ...rest } = params;
    return this.#client.breakdown({
      measure: `turn${percentile.toUpperCase()}`,
      groupBy: component === "tts" ? "voiceProvider" : "provider",
      segment: `${component}Metrics`,
      ...rest,
    });
  }
}
