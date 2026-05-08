/**
 * Sessions resource — list and per-session detail.
 *
 * Pagination model: opaque `cursor` returned by the previous `.list()`
 * response under `nextCursor`. Pass it back as `cursor` on the next
 * call. The cursor is base64-encoded server-side; do not interpret.
 */

import { ConvaiAnalyticsError } from "../apiErrors.js";
import type { ConvaiAnalytics } from "../client.js";
import type {
  SessionDetail,
  SessionListParams,
  SessionListResponse,
} from "../types.js";

export class Sessions {
  readonly #client: ConvaiAnalytics;

  constructor(client: ConvaiAnalytics) {
    this.#client = client;
  }

  /** `GET /v1/analytics/sessions` — paginated session list with headline numbers. */
  async list(params: SessionListParams = {}): Promise<SessionListResponse> {
    return this.#client.get<SessionListResponse>(
      "/sessions",
      params as Record<string, unknown>,
    );
  }

  /** `GET /v1/analytics/sessions/{id}` — full per-session timeline. */
  async get(sessionId: string): Promise<SessionDetail> {
    if (!sessionId) {
      throw new ConvaiAnalyticsError(0, {
        code: "missing_argument",
        message: "sessions.get(sessionId): sessionId is required",
      });
    }
    return this.#client.get<SessionDetail>(
      `/sessions/${encodeURIComponent(sessionId)}`,
      {},
    );
  }
}
