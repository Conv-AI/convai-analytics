/**
 * ConvaiAnalytics — main SDK entry point.
 *
 * Constructs a single client bound to one (apiKey, baseUrl). Resources hang
 * off it as properties; convenience facades (latency/providers/errors/usage)
 * wrap the lower-level resources with sensible defaults so agents have a
 * named entry point per common question.
 */

import {
  ConvaiAnalyticsError,
  errorFromResponse,
  InvalidRangeError,
  type ApiErrorPayload,
} from "./apiErrors.js";
import {
  type RelativeRange,
  type SummaryParams,
  type SummaryResponse,
  type TimeseriesParams,
  type TimeseriesResponse,
  type BreakdownParams,
  type BreakdownResponse,
  type RegressionDetectionParams,
  type RegressionDetectionResponse,
  type CubeQuery,
  type CubeQueryResponse,
  type CatalogResponse,
} from "./types.js";
import { Sessions } from "./resources/sessions.js";
import { Interactions } from "./resources/interactions.js";
import { LatencyFacade } from "./resources/latency.js";
import { ProvidersFacade } from "./resources/providers.js";
import { ErrorsFacade } from "./resources/errors.js";
import { UsageFacade } from "./resources/usage.js";
import { FirstResponse } from "./resources/first-response.js";

const DEFAULT_BASE_URL = "https://analytics-api.convai.com/v1/analytics";
const SDK_VERSION = "0.2.0";

/**
 * The exact set of relative-range tokens the analytics API accepts today.
 * Mirrors `_CUBE_RANGE_TOKENS` in convai-analytics-api/routes/summary.py.
 * When the API gains absolute start/end support, drop the validator and
 * widen `SummaryParams` instead.
 */
const ALLOWED_RANGES: readonly RelativeRange[] = [
  "last_15m",
  "last_1h",
  "last_6h",
  "last_24h",
  "last_7d",
  "last_30d",
] as const;

function validateRange(range: string | undefined): void {
  if (range === undefined) return;
  if (!(ALLOWED_RANGES as readonly string[]).includes(range)) {
    throw new InvalidRangeError(range, ALLOWED_RANGES);
  }
}

/**
 * Constraints the backend's `POST /v1/analytics/query` enforces. We
 * mirror them client-side so an obvious mistake (typo'd prefix, oversize
 * query, forbidden granularity) raises *before* the round trip.
 *
 * The backend remains the source of truth — this validator is best-effort
 * and exists to give agents fast, specific feedback. If the backend
 * tightens rules, this function may lag; the response error still wins.
 */
const CUBE_MEMBER_PREFIX = "SessionMetrics.";
const CUBE_MAX_TOTAL_MEMBERS = 12;
const CUBE_FORBIDDEN_GRANULARITIES = new Set(["second"]);
const CUBE_LIMIT_MIN = 1;
const CUBE_LIMIT_MAX = 5_000;

function validateCubeQuery(q: CubeQuery): void {
  const fail = (code: string, message: string, details?: Record<string, unknown>): never => {
    throw new ConvaiAnalyticsError(0, { code, message, details });
  };

  const measures = q.measures ?? [];
  const dimensions = q.dimensions ?? [];
  const segments = q.segments ?? [];
  const filters = q.filters ?? [];
  const timeDimensions = q.timeDimensions ?? [];

  const total = measures.length + dimensions.length + segments.length;
  if (total === 0) {
    fail(
      "empty_query",
      "Query must declare at least one measure, dimension, or segment.",
    );
  }
  if (total > CUBE_MAX_TOTAL_MEMBERS) {
    fail(
      "query_too_wide",
      `Query has ${total} members; max is ${CUBE_MAX_TOTAL_MEMBERS}. Reduce measures + dimensions + segments.`,
      { total, max: CUBE_MAX_TOTAL_MEMBERS },
    );
  }

  for (const m of [...measures, ...dimensions, ...segments]) {
    if (!m.startsWith(CUBE_MEMBER_PREFIX)) {
      fail(
        "invalid_member",
        `members must start with '${CUBE_MEMBER_PREFIX}' (got '${m}').`,
        { member: m, requiredPrefix: CUBE_MEMBER_PREFIX },
      );
    }
  }
  for (const f of filters) {
    if (!f.member.startsWith(CUBE_MEMBER_PREFIX)) {
      fail(
        "invalid_member",
        `filter member must start with '${CUBE_MEMBER_PREFIX}' (got '${f.member}').`,
        { member: f.member, requiredPrefix: CUBE_MEMBER_PREFIX },
      );
    }
  }
  for (const td of timeDimensions) {
    if (!td.dimension.startsWith(CUBE_MEMBER_PREFIX)) {
      fail(
        "invalid_member",
        `timeDimension dimension must start with '${CUBE_MEMBER_PREFIX}' (got '${td.dimension}').`,
        { member: td.dimension, requiredPrefix: CUBE_MEMBER_PREFIX },
      );
    }
    if (td.granularity && CUBE_FORBIDDEN_GRANULARITIES.has(td.granularity)) {
      fail(
        "forbidden_granularity",
        `Granularity '${td.granularity}' is not permitted. Forbidden: ${[...CUBE_FORBIDDEN_GRANULARITIES].join(", ")}.`,
        { granularity: td.granularity },
      );
    }
  }

  if (q.limit !== undefined && q.limit !== null) {
    if (q.limit < CUBE_LIMIT_MIN || q.limit > CUBE_LIMIT_MAX) {
      fail(
        "invalid_limit",
        `limit must be between ${CUBE_LIMIT_MIN} and ${CUBE_LIMIT_MAX} (got ${q.limit}).`,
        { limit: q.limit, min: CUBE_LIMIT_MIN, max: CUBE_LIMIT_MAX },
      );
    }
  }
}

export interface ConvaiAnalyticsOptions {
  /** Convai API key. Falls back to `CONVAI_API_KEY` env var. */
  apiKey?: string;
  /** Override the API base URL. Falls back to `CONVAI_ANALYTICS_BASE_URL`. */
  baseUrl?: string;
  /** Per-request timeout in ms. Default 30s. */
  timeoutMs?: number;
  /** Custom fetch impl (tests). Defaults to global `fetch`. */
  fetch?: typeof globalThis.fetch;
}

export class ConvaiAnalytics {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #fetch: typeof globalThis.fetch;

  readonly sessions: Sessions;
  readonly interactions: Interactions;
  readonly latency: LatencyFacade;
  readonly providers: ProvidersFacade;
  readonly errors: ErrorsFacade;
  readonly usage: UsageFacade;
  readonly firstResponse: FirstResponse;

  constructor(options: ConvaiAnalyticsOptions = {}) {
    const apiKey = options.apiKey ?? process.env.CONVAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ConvaiAnalytics: apiKey is required (pass it explicitly or set CONVAI_API_KEY).",
      );
    }
    this.#apiKey = apiKey;
    this.#baseUrl = (
      options.baseUrl ??
      process.env.CONVAI_ANALYTICS_BASE_URL ??
      DEFAULT_BASE_URL
    ).replace(/\/$/, "");
    this.#timeoutMs = options.timeoutMs ?? 30_000;
    this.#fetch = options.fetch ?? globalThis.fetch;

    this.sessions = new Sessions(this);
    this.interactions = new Interactions(this);
    this.latency = new LatencyFacade(this);
    this.providers = new ProvidersFacade(this);
    this.errors = new ErrorsFacade(this);
    this.usage = new UsageFacade(this);
    this.firstResponse = new FirstResponse(this);
  }

  // ---------- Direct REST mappings ----------

  /** `GET /v1/analytics/summary` — top-level KPIs over a window. */
  async summary(params: SummaryParams = {}): Promise<SummaryResponse> {
    validateRange(params.range);
    return this.get<SummaryResponse>("/summary", params as Record<string, unknown>);
  }

  /** `GET /v1/analytics/timeseries` — bucketed values for a single measure. */
  async timeseries(params: TimeseriesParams = {}): Promise<TimeseriesResponse> {
    validateRange(params.range);
    return this.get<TimeseriesResponse>("/timeseries", params as Record<string, unknown>);
  }

  /** `GET /v1/analytics/breakdown` — group-by aggregation for one measure. */
  async breakdown(params: BreakdownParams = {}): Promise<BreakdownResponse> {
    validateRange(params.range);
    return this.get<BreakdownResponse>("/breakdown", params as Record<string, unknown>);
  }

  /** `GET /v1/analytics/metrics/catalog` — what your plan can query. */
  async catalog(): Promise<CatalogResponse> {
    return this.get<CatalogResponse>("/metrics/catalog", {});
  }

  /**
   * `GET /v1/analytics/regression-detection` — rolling p95 regression vs baseline.
   * Requires the `business` plan or higher (otherwise the request returns
   * 402/403 and the SDK raises `PlanRequiredError` / `PlanInsufficientError`).
   */
  async regressionDetection(
    params: RegressionDetectionParams = {},
  ): Promise<RegressionDetectionResponse> {
    validateRange(params.baselineRange);
    validateRange(params.currentRange);
    return this.get<RegressionDetectionResponse>(
      "/regression-detection",
      params as Record<string, unknown>,
    );
  }

  /**
   * `POST /v1/analytics/query` — restricted advanced query.
   *
   * Requires `business` plan or higher. Use only when a hand-shaped query
   * cannot be expressed via the named endpoints; prefer the named ones for
   * forward compatibility.
   *
   * Backend constraints (validated client-side, then re-checked server-side):
   * - All members (`measures`, `dimensions`, `segments`, `filters[].member`,
   *   `timeDimensions[].dimension`) must start with `SessionMetrics.`.
   * - Total `measures.length + dimensions.length + segments.length` ≥ 1 and ≤ 12.
   * - `timeDimensions[].granularity` cannot be `"second"`.
   * - `limit` must be 1–5000 (default 1000).
   *
   * Violations raise a typed `ConvaiAnalyticsError` with `code` set to one
   * of `empty_query`, `query_too_wide`, `invalid_member`,
   * `forbidden_granularity`, or `invalid_limit`.
   */
  async query(cubeQuery: CubeQuery): Promise<CubeQueryResponse> {
    validateCubeQuery(cubeQuery);
    return this.post<CubeQueryResponse>("/query", cubeQuery);
  }

  // ---------- HTTP transport (used by resources/) ----------

  /** @internal — used by resource classes to make GET calls. */
  async get<T>(path: string, params: Record<string, unknown>): Promise<T> {
    const url = new URL(this.#baseUrl + path);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(camelToSnake(key), normalizeQueryValue(key, value));
    }
    return this.request<T>("GET", url, undefined);
  }

  /** @internal — used by resource classes to make POST calls. */
  async post<T>(path: string, body: unknown): Promise<T> {
    const url = new URL(this.#baseUrl + path);
    return this.request<T>("POST", url, body);
  }

  async #request<T>(method: string, url: URL, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await this.#fetch(url, {
        method,
        headers: {
          "CONVAI-API-KEY": this.#apiKey,
          "Accept": "application/json",
          "User-Agent": `convai-analytics-ts/${SDK_VERSION}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await response.text();
      const parsed: unknown = text ? JSON.parse(text) : null;

      if (!response.ok) {
        const errPayload = (
          parsed && typeof parsed === "object" && "error" in parsed
            ? (parsed as { error: ApiErrorPayload }).error
            : { code: "unknown_error", message: text || response.statusText }
        );
        const retryAfterRaw = response.headers.get("Retry-After");
        const retryAfter = retryAfterRaw ? Number(retryAfterRaw) : undefined;
        throw errorFromResponse(response.status, errPayload, retryAfter);
      }

      // Convert snake_case keys to camelCase at the wire boundary.
      return deepSnakeToCamel(parsed) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // Public-facing wrapper (typescript private fields can't be called from
  // friend resource classes without this indirection).
  /** @internal */
  request<T>(method: string, url: URL, body: unknown): Promise<T> {
    return this.#request<T>(method, url, body);
  }
}

// ---------- Wire-format helpers ----------

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
}

const MEASURE_ALIASES: Record<string, string> = {
  avgValue: "avg_value",
  p50Value: "p50_value",
  p95Value: "p95_value",
  p99Value: "p99_value",
  turnP50: "turn_p50",
  turnP95: "turn_p95",
  turnP99: "turn_p99",
  turnMax: "turn_max",
  uniqueSessions: "unique_sessions",
  uniqueTurns: "unique_turns",
  uniqueEndUsers: "unique_end_users",
  errorCount: "error_count",
};

const GROUP_BY_ALIASES: Record<string, string> = {
  voiceProvider: "voice_provider",
  characterId: "character_id",
  metricName: "metric_name",
  metricType: "metric_type",
  appKey: "app_key",
  experienceId: "experience_id",
};

const SEGMENT_ALIASES: Record<string, string> = {
  endToEndTurnLatency: "end_to_end_turn_latency",
  neuroSyncTurnSummary: "neuro_sync_turn_summary",
  customLatencyMetrics: "custom_latency_metrics",
  userBotLatencyMetrics: "user_bot_latency_metrics",
  smartTurnMetrics: "smart_turn_metrics",
  sttMetrics: "stt_metrics",
  vadMetrics: "vad_metrics",
  ttsMetrics: "tts_metrics",
  llmMetrics: "llm_metrics",
};

function normalizeQueryValue(key: string, value: unknown): string {
  if (typeof value !== "string") return String(value);
  switch (key) {
    case "measure":
      return MEASURE_ALIASES[value] ?? value;
    case "groupBy":
      return GROUP_BY_ALIASES[value] ?? value;
    case "segment":
      return SEGMENT_ALIASES[value] ?? value;
    default:
      return value;
  }
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function deepSnakeToCamel(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepSnakeToCamel);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[snakeToCamel(k)] = deepSnakeToCamel(v);
    }
    return out;
  }
  return value;
}
