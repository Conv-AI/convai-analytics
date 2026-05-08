/**
 * Interactions resource — single-trace lookup by interaction id.
 *
 * The agent-friendly entry point for "explain this trace" and "generate
 * a waterfall for this interaction" prompts.
 */

import { ConvaiAnalyticsError } from "../apiErrors.js";
import type { ConvaiAnalytics } from "../client.js";
import type { InteractionTrace } from "../types.js";

export class Interactions {
  readonly #client: ConvaiAnalytics;

  constructor(client: ConvaiAnalytics) {
    this.#client = client;
  }

  /**
   * `GET /v1/analytics/interactions/{id}` — full component waterfall +
   * provider/model attribution + status for one interaction.
   */
  async get(interactionId: string): Promise<InteractionTrace> {
    if (!interactionId) {
      throw new ConvaiAnalyticsError(0, {
        code: "missing_argument",
        message: "interactions.get(interactionId): interactionId is required",
      });
    }
    return this.#client.get<InteractionTrace>(
      `/interactions/${encodeURIComponent(interactionId)}`,
      {},
    );
  }
}
