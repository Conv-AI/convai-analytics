import type { ConvaiAnalytics } from "../client.js";
import type {
  FirstResponseBreakdownParams,
  FirstResponseBreakdownResponse,
  FirstResponseMarkersParams,
  FirstResponseMarkersResponse,
  FirstResponseSettingsParams,
  FirstResponseSettingsResponse,
  FirstResponseSummaryParams,
  FirstResponseSummaryResponse,
  FirstResponseTimeseriesParams,
  FirstResponseTimeseriesResponse,
  InteractionFirstResponse,
} from "../types.js";

export class FirstResponse {
  readonly #client: ConvaiAnalytics;

  constructor(client: ConvaiAnalytics) {
    this.#client = client;
  }

  /** Character-first P50/P95/P99 SLA summary. Defaults include turn 1. */
  summary(params: FirstResponseSummaryParams): Promise<FirstResponseSummaryResponse> {
    return this.#client.get<FirstResponseSummaryResponse>(
      "/first-response/summary",
      params as unknown as Record<string, unknown>,
    );
  }

  /** Bucketed P50/P95/P99 SLA series. Defaults include turn 1. */
  timeseries(params: FirstResponseTimeseriesParams): Promise<FirstResponseTimeseriesResponse> {
    return this.#client.get<FirstResponseTimeseriesResponse>(
      "/first-response/timeseries",
      params as unknown as Record<string, unknown>,
    );
  }

  /** Grouped first-response SLA breakdown by mode, stage, provider, settings hash, etc. */
  breakdown(params: FirstResponseBreakdownParams): Promise<FirstResponseBreakdownResponse> {
    return this.#client.get<FirstResponseBreakdownResponse>(
      "/first-response/breakdown",
      params as unknown as Record<string, unknown>,
    );
  }

  /** Settings-change markers derived from observed settings hash transitions. */
  markers(params: FirstResponseMarkersParams): Promise<FirstResponseMarkersResponse> {
    return this.#client.get<FirstResponseMarkersResponse>(
      "/first-response/markers",
      params as unknown as Record<string, unknown>,
    );
  }

  /** Fetch one sanitized latency settings snapshot by hash. */
  settings(
    settingsHash: string,
    params: FirstResponseSettingsParams = {},
  ): Promise<FirstResponseSettingsResponse> {
    return this.#client.get<FirstResponseSettingsResponse>(
      `/first-response/settings/${encodeURIComponent(settingsHash)}`,
      params as unknown as Record<string, unknown>,
    );
  }

  /** Additive first-response waterfall for one interaction. */
  interaction(interactionId: string): Promise<InteractionFirstResponse> {
    return this.#client.get<InteractionFirstResponse>(
      `/interactions/${encodeURIComponent(interactionId)}/first-response`,
      {},
    );
  }
}
