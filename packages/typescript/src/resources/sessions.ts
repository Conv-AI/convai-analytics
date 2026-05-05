import type { ConvaiAnalytics } from "../client.js";
import { NotYetSupportedError } from "../apiErrors.js";
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
  async list(_params: SessionListParams = {}): Promise<SessionListResponse> {
    throw new NotYetSupportedError("/sessions", "API Phase 2");
  }

  /** `GET /v1/analytics/sessions/{id}` — full per-session timeline. */
  async get(_sessionId: string): Promise<SessionDetail> {
    throw new NotYetSupportedError("/sessions/{id}", "API Phase 2");
  }
}
