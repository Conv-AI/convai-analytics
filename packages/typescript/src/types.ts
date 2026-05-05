/**
 * Public types for the analytics SDK. Hand-written for now; will be
 * regenerated from `openapi/convai-analytics-api.json` once Phase 4 of
 * the API repo lands real schemas.
 *
 * Naming convention: camelCase in TS, the HTTP transport in client.ts
 * handles snake_case ↔ camelCase mapping at the wire boundary.
 */

// ---------- Time & shared ----------

/** Convenience relative-range strings accepted by every endpoint. */
export type RelativeRange =
  | "last_15m"
  | "last_1h"
  | "last_6h"
  | "last_24h"
  | "last_7d"
  | "last_30d";

export interface TimeRange {
  /** Either a relative range OR an explicit start/end pair. */
  range?: RelativeRange;
  startTime?: string; // ISO 8601, UTC
  endTime?: string;
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

/** Server-attached metadata on every response — explainability */
export interface ResponseMeta {
  /** When the underlying data was last refreshed. ISO 8601. */
  freshnessAt: string;
  /** Sample count used to compute the response. */
  sampleCount: number;
  /** Effective time range (after defaults applied). */
  effectiveRange: { startTime: string; endTime: string };
  /** Backend that served the query. Internal — agents shouldn't depend on this. */
  backend?: "cube" | "bq";
  /** Whether this response came from cache. */
  cacheHit?: boolean;
}

// ---------- summary ----------

/**
 * Narrow set — these are the only fields the analytics API's `/summary`
 * endpoint reads today. `startTime`/`endTime` and the rest of `CommonFilters`
 * (endUserId, metricName, provider, model, processor, status) land alongside
 * the broader endpoint surface in API Phase 2; until then they would be
 * silently dropped on the wire and produce wrong-but-plausible numbers.
 */
export interface SummaryParams {
  range?: RelativeRange;
  characterId?: string;
  appKey?: string;
  experienceId?: string;
}

export interface SummaryResponse {
  sessions: number;
  uniqueEndUsers: number;
  interactions: number;
  errorCount: number;
  p50EndToEndMs: number;
  p95EndToEndMs: number;
  p99EndToEndMs: number;
  meta: ResponseMeta;
}

// ---------- timeseries ----------

export interface TimeseriesParams extends TimeRange, CommonFilters {
  /** What to plot. e.g. `p95Value`, `count`, `avgValue`. */
  measure: string;
  /** Bucket size. Server picks a sensible default if omitted. */
  granularity?: "minute" | "hour" | "day";
  /** Optional group-by — a separate series per group value. */
  groupBy?: string;
}

export interface TimeseriesPoint {
  bucketStart: string; // ISO 8601
  group?: string;      // present when groupBy is set
  value: number | null;
}

export interface TimeseriesResponse {
  measure: string;
  granularity: "minute" | "hour" | "day";
  points: TimeseriesPoint[];
  meta: ResponseMeta;
}

// ---------- breakdown ----------

export interface BreakdownParams extends TimeRange, CommonFilters {
  measure: string;
  groupBy: string;
  /** Limit number of returned groups; default 50. */
  limit?: number;
  /** Optional Cube segment to scope (e.g. `endToEndTurnLatency`, `llmMetrics`). */
  segment?: string;
}

export interface BreakdownRow {
  group: string;
  value: number | null;
  sampleCount: number;
}

export interface BreakdownResponse {
  measure: string;
  groupBy: string;
  rows: BreakdownRow[];
  meta: ResponseMeta;
}

// ---------- sessions ----------

export interface SessionListParams extends TimeRange, CommonFilters {
  /** Sort order; default `recent`. */
  sort?: "recent" | "longest" | "slowest";
  /** Cursor returned by the previous page; omit for first page. */
  cursor?: string;
  limit?: number;
}

export interface SessionSummary {
  sessionId: string;
  characterId: string;
  appKey: string;
  experienceId?: string;
  startTime: string;
  endTime: string;
  durationSec: number;
  interactionCount: number;
  p95EndToEndMs: number;
  errorCount: number;
}

export interface SessionListResponse {
  sessions: SessionSummary[];
  nextCursor?: string;
  meta: ResponseMeta;
}

export interface SessionTimelineEvent {
  eventTime: string;
  metricName: string;
  metricType: string;
  processor?: Processor;
  interactionId?: string;
  status?: Status;
  value?: number | null;
  attributes?: Record<string, unknown>;
}

export interface SessionDetail {
  sessionId: string;
  characterId: string;
  appKey: string;
  experienceId?: string;
  startTime: string;
  endTime: string;
  events: SessionTimelineEvent[];
  meta: ResponseMeta;
}

// ---------- interactions ----------

export interface ComponentSpan {
  processor: Processor;
  startTime: string;
  endTime: string;
  durationMs: number;
  status: Status;
  provider?: string;
  model?: string;
  errorCode?: string;
  attributes?: Record<string, unknown>;
}

export interface InteractionTrace {
  interactionId: string;
  sessionId: string;
  characterId: string;
  appKey: string;
  endUserId?: string;
  interactionType: string;
  startTime: string;
  endTime: string;
  totalDurationMs: number;
  terminalStatus: Status;
  failureStage?: Processor;
  spans: ComponentSpan[];
  meta: ResponseMeta;
}

// ---------- catalog ----------

export interface MetricDefinition {
  metricName: string;
  metricType: string;
  unit?: string;
  description: string;
  visibility: "public" | "enterprise" | "internal";
  /** Whether percentile aggregations make sense for this metric. */
  supportsPercentiles: boolean;
}

export interface CatalogResponse {
  metrics: MetricDefinition[];
  meta: ResponseMeta;
}

// ---------- advanced ----------

export interface RegressionDetectionParams extends CommonFilters {
  baselineRange: RelativeRange;
  currentRange: RelativeRange;
  measure: string;
  /** Minimum relative change to flag as a regression; default 0.15 (15%). */
  threshold?: number;
}

export interface RegressionDetectionRow {
  group: string;
  baselineValue: number;
  currentValue: number;
  relativeChange: number;
  significant: boolean;
}

export interface RegressionDetectionResponse {
  rows: RegressionDetectionRow[];
  meta: ResponseMeta;
}

/** Restricted Cube query — see API repo docs for the allowed subset. */
export interface CubeQuery {
  measures?: string[];
  dimensions?: string[];
  segments?: string[];
  filters?: Array<{ member: string; operator: string; values: string[] }>;
  timeDimensions?: Array<{
    dimension: string;
    granularity?: string;
    dateRange?: string | [string, string];
  }>;
  limit?: number;
  order?: Record<string, "asc" | "desc">;
}

export interface CubeQueryResponse {
  data: Array<Record<string, unknown>>;
  meta: ResponseMeta;
}
