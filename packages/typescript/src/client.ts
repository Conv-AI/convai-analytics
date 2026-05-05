/**
 * ConvaiAnalytics — main SDK entry point.
 *
 * Constructs a single client bound to one (apiKey, baseUrl). Resources hang
 * off it as properties; convenience facades (latency/providers/errors/usage)
 * wrap the lower-level resources with sensible defaults so agents have a
 * named entry point per common question.
 */

import {
  errorFromResponse,
  InvalidRangeError,
  NotYetSupportedError,
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

const DEFAULT_BASE_URL = "https://analytics-api.convai.com/v1/analytics";
const SDK_VERSION = "0.0.1";

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
  }

  // ---------- Direct REST mappings ----------

  /** `GET /v1/analytics/summary` — top-level KPIs over a window. */
  summary(params: SummaryParams = {}): Promise<SummaryResponse> {
    validateRange(params.range);
    return this.get<SummaryResponse>("/summary", params);
  }

  /** `GET /v1/analytics/timeseries` — measure × granularity time series. */
  async timeseries(_params: TimeseriesParams): Promise<TimeseriesResponse> {
    throw new NotYetSupportedError("/timeseries", "API Phase 2");
  }

  /** `GET /v1/analytics/breakdown` — group-by aggregation for one measure. */
  async breakdown(_params: BreakdownParams): Promise<BreakdownResponse> {
    throw new NotYetSupportedError("/breakdown", "API Phase 2");
  }

  /** `GET /v1/analytics/metrics/catalog` — what your plan can query. */
  async catalog(): Promise<CatalogResponse> {
    throw new NotYetSupportedError("/metrics/catalog", "API Phase 2");
  }

  /**
   * `GET /v1/analytics/regression-detection` — rolling p95 regression vs baseline.
   * Requires the `business` plan or higher (otherwise 403).
   * Backed by the BigQuery escape hatch on the server.
   */
  async regressionDetection(
    _params: RegressionDetectionParams,
  ): Promise<RegressionDetectionResponse> {
    throw new NotYetSupportedError("/regression-detection", "API Phase 3");
  }

  /**
   * `POST /v1/analytics/query` — restricted Cube passthrough.
   * Requires `business` plan or higher. Use only when a hand-shaped query
   * cannot be expressed via the named endpoints; prefer the named ones for
   * forward compatibility.
   */
  async query(_cubeQuery: CubeQuery): Promise<CubeQueryResponse> {
    throw new NotYetSupportedError("POST /query", "API Phase 3");
  }

  // ---------- HTTP transport (used by resources/) ----------

  /** @internal — used by resource classes to make GET calls. */
  async get<T>(path: string, params: Record<string, unknown>): Promise<T> {
    const url = new URL(this.#baseUrl + path);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(camelToSnake(key), String(value));
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
