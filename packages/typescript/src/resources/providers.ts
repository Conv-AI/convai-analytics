/**
 * ProvidersFacade — provider/model comparison helpers.
 */

import type { ConvaiAnalytics } from "../client.js";
import {
  GROUP_BY,
  rawValuePercentileMeasure,
  SEGMENTS,
  type SegmentName,
} from "../measures.js";
import type {
  BreakdownResponse,
  CommonFilters,
  Percentile,
  TimeRange,
} from "../types.js";

export type Component = "llm" | "tts" | "asr" | "neurosync";

export interface ProviderCompareParams extends TimeRange, CommonFilters {
  /** Restrict to one component (e.g. 'llm', 'tts'). Default: 'llm'. */
  component?: Component;
  /** Default p95. */
  percentile?: Percentile;
}

const COMPONENT_TO_SEGMENT: Record<Component, SegmentName> = {
  llm: SEGMENTS.llmMetrics,
  tts: SEGMENTS.ttsMetrics,
  asr: SEGMENTS.asrMetrics,
  neurosync: SEGMENTS.neurosyncMetrics,
};

export class ProvidersFacade {
  readonly #client: ConvaiAnalytics;

  constructor(client: ConvaiAnalytics) {
    this.#client = client;
  }

  /**
   * "Compare LLM provider p95 latency over the last 7 days."
   * Delegates to `breakdown(groupBy=provider|voiceProvider, segment=<component>Metrics)`.
   */
  compare(params: ProviderCompareParams = {}): Promise<BreakdownResponse> {
    const { component = "llm", percentile = "p95", ...rest } = params;
    return this.#client.breakdown({
      measure: rawValuePercentileMeasure(percentile),
      // TTS uses `voiceProvider`; everything else uses `provider`.
      groupBy: component === "tts" ? GROUP_BY.voiceProvider : GROUP_BY.provider,
      segment: COMPONENT_TO_SEGMENT[component],
      ...rest,
    });
  }
}
