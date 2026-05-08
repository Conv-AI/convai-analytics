/**
 * UsageFacade — account/character/experience usage analytics.
 */

import type { ConvaiAnalytics } from "../client.js";
import { GROUP_BY, MEASURES } from "../measures.js";
import type { BreakdownResponse, CommonFilters, TimeRange } from "../types.js";

export interface UsageSummaryParams extends TimeRange, CommonFilters {
  /** What to group by. Default 'characterId'. Other useful: 'experienceId', 'appKey'. */
  groupBy?: "characterId" | "experienceId" | "appKey";
}

export class UsageFacade {
  readonly #client: ConvaiAnalytics;

  constructor(client: ConvaiAnalytics) {
    this.#client = client;
  }

  /**
   * "How many sessions / unique end users / interactions did I have, by character?"
   * Delegates to `breakdown(measure=uniqueSessions, groupBy=...)`.
   */
  summary(params: UsageSummaryParams = {}): Promise<BreakdownResponse> {
    const { groupBy = GROUP_BY.characterId, ...rest } = params;
    return this.#client.breakdown({
      measure: MEASURES.uniqueSessions,
      groupBy,
      ...rest,
    });
  }

  /** "How many interactions per character?" */
  interactions(params: UsageSummaryParams = {}): Promise<BreakdownResponse> {
    const { groupBy = GROUP_BY.characterId, ...rest } = params;
    return this.#client.breakdown({
      measure: MEASURES.uniqueTurns,
      groupBy,
      ...rest,
    });
  }
}
