import type { ConvaiAnalytics } from "../client.js";
import type {
  SessionListParams,
  SessionListResponse,
  SessionDetail,
} from "../types.js";

export class Sessions {
  readonly #client: ConvaiAnalytics;

  constructor(client: ConvaiAnalytics) {
    this.#client = client;
  }

  /** `GET /v1/analytics/sessions` — paginated session list. */
  list(params: SessionListParams = {}): Promise<SessionListResponse> {
    return this.#client.get<SessionListResponse>("/sessions", params);
  }

  /** `GET /v1/analytics/sessions/{id}` — full per-session timeline. */
  get(sessionId: string): Promise<SessionDetail> {
    if (!sessionId) throw new Error("sessions.get: sessionId is required");
    return this.#client.get<SessionDetail>(
      `/sessions/${encodeURIComponent(sessionId)}`,
      {},
    );
  }
}
