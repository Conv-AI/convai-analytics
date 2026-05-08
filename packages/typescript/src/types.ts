/**
 * Public types for the analytics SDK.
 *
 * Response shapes are aliased from the auto-generated `_generated.ts` —
 * source of truth is `openapi/convai-analytics-api.json`. *Param* shapes
 * (what the SDK accepts) are hand-written: they intentionally narrow the
 * raw OpenAPI query-string surface to the subset the backend actually
 * honors today, since unrecognized query params would be silently
 * dropped with no client-side feedback.
 *
 * Naming convention: camelCase in TS, the HTTP transport in client.ts
 * handles snake_case ↔ camelCase mapping at the wire boundary. Outgoing
 * query params are converted camelCase → snake_case to match the
 * backend's FastAPI Query aliases (e.g. `characterId` → `character_id`).
 */

import type { components } from "./_generated.js";

// ---------- Time & shared ----------

/** Relative-range tokens accepted by every windowed endpoint. */
export type RelativeRange =
  | "last_15m"
  | "last_1h"
  | "last_6h"
  | "last_24h"
  | "last_7d"
  | "last_30d";

/**
 * Time-window selector. Backend currently only honors `range` (relative
 * tokens); `startTime` / `endTime` (absolute) lands in a future API
 * release. Until then the SDK accepts only `range` to avoid silent
 * filter-drop bugs.
 */
export interface TimeRange {
  range?: RelativeRange;
}

export type Percentile = "p50" | "p75" | "p90" | "p95" | "p99";

export type Aggregation = "count" | "sum" | "avg" | "min" | "max" | "unique";

export type Processor =
  | "asr"
  | "vad"
  | "stt"
  | "llm"
  | "knowledge_bank"
  | "memory"
  | "tts"
  | "neurosync"
  | "transport"
  | "dynamic_context"
  | "moderation"
  | "emotion";

export type Status = "ok" | "error" | "timeout" | "cancelled";

/**
 * Filter dimensions accepted by `/timeseries` and `/breakdown`. Each is
 * forwarded as a snake_case query param (`characterId` → `character_id`).
 */
export interface CommonFilters {
  appKey?: string;
  characterId?: string;
  experienceId?: string;
  endUserId?: string;
  metricName?: string;
  metricNamePrefix?: string;
  provider?: string;
  model?: string;
  processor?: Processor;
  status?: Status;
}

// ---------- Response aliases (generated source of truth) ----------

export type ResponseMeta = components["schemas"]["ResponseMeta"];
export type EffectiveRange = components["schemas"]["EffectiveRange"];
export type SummaryResponse = components["schemas"]["SummaryResponse"];
export type TimeseriesResponse = components["schemas"]["TimeseriesResponse"];
export type TimeseriesPoint = components["schemas"]["TimeseriesPoint"];
export type BreakdownResponse = components["schemas"]["BreakdownResponse"];
export type BreakdownRow = components["schemas"]["BreakdownRow"];
export type SessionListResponse = components["schemas"]["SessionListResponse"];
export type SessionSummary = components["schemas"]["SessionSummary"];
export type SessionDetail = components["schemas"]["SessionDetail"];
export type SessionTimelineEvent = components["schemas"]["SessionTimelineEvent"];
export type InteractionTrace = components["schemas"]["InteractionTrace"];
export type ComponentSpan = components["schemas"]["ComponentSpan"];
export type CatalogResponse = components["schemas"]["CatalogResponse"];
export type MetricDefinition = components["schemas"]["MetricDefinition"];
/** Backend type is named `RegressionResponse`; SDK keeps the historical
 * `RegressionDetectionResponse` name for the public surface. */
export type RegressionDetectionResponse = components["schemas"]["RegressionResponse"];
export type RegressionDetectionRow = components["schemas"]["RegressionRow"];
/** Backend's POST body type. SDK exposes both `CubeQuery` (input) and
 * `CubeQueryRequest` (raw alias) so users can pick the name they prefer. */
export type CubeQueryRequest = components["schemas"]["CubeQueryRequest"];
export type CubeQuery = CubeQueryRequest;
export type CubeQueryResponse = components["schemas"]["CubeQueryResponse"];
export type CubeFilter = components["schemas"]["CubeFilter"];
export type CubeTimeDimension = components["schemas"]["CubeTimeDimension"];

// ---------- Param shapes (hand-written, narrow to honored fields) ----------

/** `/summary` only honors `range` + the three id filters today. */
export interface SummaryParams {
  range?: RelativeRange;
  characterId?: string;
  appKey?: string;
  experienceId?: string;
}

/**
 * `/timeseries` query params. `measure` defaults server-side to "count".
 * Granularity defaults to "hour".
 */
export interface TimeseriesParams extends TimeRange, CommonFilters {
  /** Measure token, e.g. `count`, `avg`, `p95`, `turn_p95`. Default "count" server-side. */
  measure?: string;
  /** Bucket size. Default "hour". */
  granularity?: "minute" | "hour" | "day";
  /** Optional group key — emits a separate series per group value. */
  groupBy?: string;
  /** Optional Cube segment scope (e.g. `endToEndTurnLatency`). */
  segment?: string;
}

/**
 * `/breakdown` query params. `groupBy` defaults to "processor", `limit` to 50.
 */
export interface BreakdownParams extends TimeRange, CommonFilters {
  /** Measure token, e.g. `count`, `p95`, `turn_p95`. Default "count" server-side. */
  measure?: string;
  /** Group key. Default "processor" server-side. */
  groupBy?: string;
  /** Number of rows. 1–500. Default 50. */
  limit?: number;
  /** Optional Cube segment scope. */
  segment?: string;
}

/**
 * `/sessions` query params. `sort` defaults to "recent"; `limit` defaults to 25.
 * Pagination via opaque `cursor` returned by the previous response.
 */
export interface SessionListParams extends TimeRange {
  sort?: "recent" | "longest" | "slowest";
  /** 1–100. Default 25. */
  limit?: number;
  /** Opaque cursor from the previous response's `nextCursor`. */
  cursor?: string;
  appKey?: string;
  characterId?: string;
  experienceId?: string;
  endUserId?: string;
}

/**
 * `/regression-detection` query params. Requires plan ≥ business.
 * `baselineRange` must cover a longer window than `currentRange`.
 */
export interface RegressionDetectionParams {
  /** Default "voice.user_to_bot_latency" server-side. */
  measure?: string;
  /** Default "last_7d" server-side. */
  baselineRange?: RelativeRange;
  /** Default "last_24h" server-side. */
  currentRange?: RelativeRange;
  /** One of: overall | app_key | character_id | experience_id | provider | voice_provider | model. Default "overall". */
  groupBy?: string;
  /** Minimum relative change to flag. 0.0–10.0. Default 0.15 (15%). */
  threshold?: number;
}
