/**
 * Cube vocabulary the SDK passes to the backend.
 *
 * `MEASURES`, `SEGMENTS`, and `GROUP_BY` mirror the keys the backend's
 * `MEASURE_MAP` / `SEGMENT_MAP` / `GROUP_BY_MAP` tables in
 * `convai-analytics-api/src/convai_analytics_api/routes/_common.py`
 * resolve. Resource facades use these constants instead of hardcoding
 * the strings — a typo here surfaces as a TypeScript error rather than
 * a 400 from the backend.
 *
 * If the backend renames a measure / segment / group-by, bump the
 * corresponding constant here and tests will catch downstream callers.
 */

import type { Percentile } from "./types.js";

/** Cube measures the backend understands. */
export const MEASURES = {
  // Counts
  count: "count",
  uniqueSessions: "uniqueSessions",
  uniqueTurns: "uniqueTurns",
  uniqueEndUsers: "uniqueEndUsers",
  errorCount: "errorCount",
  // Aggregates over `value`
  avgValue: "avgValue",
  p50Value: "p50Value",
  p95Value: "p95Value",
  p99Value: "p99Value",
  // End-to-end turn-latency percentiles
  turnP50: "turnP50",
  turnP75: "turnP75",
  turnP90: "turnP90",
  turnP95: "turnP95",
  turnP99: "turnP99",
} as const;

export type MeasureName = typeof MEASURES[keyof typeof MEASURES];

/** Convert a `Percentile` (`"p95"`) to its Cube measure (`"turnP95"`). */
export function percentileMeasure(p: Percentile): MeasureName {
  switch (p) {
    case "p50":
      return MEASURES.turnP50;
    case "p75":
      return MEASURES.turnP75;
    case "p90":
      return MEASURES.turnP90;
    case "p95":
      return MEASURES.turnP95;
    case "p99":
      return MEASURES.turnP99;
  }
}

/**
 * Convert a percentile to the raw `value` percentile measure.
 *
 * Cube currently exposes raw-value measures for p50/p95/p99. For p75/p90
 * we fall back to the historical turn-summary measures so existing callers
 * keep working until the backend exposes raw p75/p90 too.
 */
export function rawValuePercentileMeasure(p: Percentile): MeasureName {
  switch (p) {
    case "p50":
      return MEASURES.p50Value;
    case "p95":
      return MEASURES.p95Value;
    case "p99":
      return MEASURES.p99Value;
    case "p75":
    case "p90":
      return percentileMeasure(p);
  }
}

/** Cube segments — scope a query to a metric family. */
export const SEGMENTS = {
  endToEndTurnLatency: "endToEndTurnLatency",
  asrMetrics: "asrMetrics",
  llmMetrics: "llmMetrics",
  ttsMetrics: "ttsMetrics",
  neurosyncMetrics: "neurosyncMetrics",
} as const;

export type SegmentName = typeof SEGMENTS[keyof typeof SEGMENTS];

/** group_by tokens accepted by `/timeseries` and `/breakdown`. */
export const GROUP_BY = {
  processor: "processor",
  provider: "provider",
  voiceProvider: "voiceProvider",
  model: "model",
  characterId: "characterId",
  appKey: "appKey",
  experienceId: "experienceId",
  sessionId: "sessionId",
  status: "status",
  metricName: "metricName",
  errorCode: "errorCode",
} as const;

export type GroupByKey = typeof GROUP_BY[keyof typeof GROUP_BY];

/** Well-known `metric_name` values. Pass to `metricName` filter on
 *  `/timeseries` or `/breakdown`. */
export const METRIC_NAMES = {
  voiceUserToBotLatency: "voice.user_to_bot_latency",
} as const;

/** Well-known `metric_name_prefix` filters. */
export const METRIC_NAME_PREFIXES = {
  error: "error.",
  llm: "llm.",
  tts: "tts.",
  asr: "asr.",
  neurosync: "neurosync.",
} as const;
