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
   *
   * The agent-friendly entry point for "explain what happened in this trace"
   * and "generate a waterfall for this interaction" prompts.
   */
  get(interactionId: string): Promise<InteractionTrace> {
    if (!interactionId) throw new Error("interactions.get: interactionId is required");
    return this.#client.get<InteractionTrace>(
      `/interactions/${encodeURIComponent(interactionId)}`,
      {},
    );
  }
}
