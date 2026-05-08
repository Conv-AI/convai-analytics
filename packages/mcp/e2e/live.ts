#!/usr/bin/env tsx
import {
  ConvaiAnalytics,
  PlanInsufficientError,
  PlanRequiredError,
  RateLimitError,
} from "@convai/analytics";

import { ANALYTICS_TOOLS } from "../src/tools.js";

interface Result {
  name: string;
  status: "pass" | "skip" | "plan-gated";
  detail: string;
}

const RANGE = process.env.CONVAI_ANALYTICS_E2E_RANGE ?? "last_30d";
const REQUEST_DELAY_MS = Number(process.env.CONVAI_ANALYTICS_E2E_DELAY_MS ?? "250");

async function main(): Promise<void> {
  const apiKey = process.env.CONVAI_API_KEY;
  if (!apiKey) throw new Error("CONVAI_API_KEY is required for live MCP E2E.");

  const client = new ConvaiAnalytics({
    apiKey,
    baseUrl: process.env.CONVAI_ANALYTICS_BASE_URL,
  });
  const context = await discoverDrilldownTargets(client);
  const results: Result[] = [];

  for (const tool of ANALYTICS_TOOLS) {
    const args = argsFor(tool.name, context);
    if (!args) {
      results.push({ name: tool.name, status: "skip", detail: "no session/interaction target available" });
      continue;
    }

    try {
      const payload = await retryRateLimit(() => tool.handler(client, args));
      validatePayload(tool.name, payload);
      results.push({ name: tool.name, status: "pass", detail: summarize(payload) });
    } catch (err) {
      if (err instanceof PlanRequiredError || err instanceof PlanInsufficientError) {
        results.push({ name: tool.name, status: "plan-gated", detail: err.message });
      } else {
        throw new Error(`${tool.name} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
  }

  const failed = results.filter((result) => result.status === "skip");
  for (const result of results) {
    process.stdout.write(`${result.status.toUpperCase()} ${result.name}: ${result.detail}\n`);
  }
  process.stdout.write(
    `MCP live E2E complete: ${results.filter((r) => r.status === "pass").length} pass, ` +
      `${results.filter((r) => r.status === "plan-gated").length} plan-gated, ` +
      `${failed.length} skipped\n`,
  );
}

async function discoverDrilldownTargets(client: ConvaiAnalytics) {
  const sessions = await retryRateLimit(() =>
    client.sessions.list({ range: RANGE as "last_30d", sort: "slowest", limit: 25 }),
  );
  const sessionId = sessions.sessions[0]?.sessionId;
  if (!sessionId) return { sessionId: undefined, interactionId: undefined };

  const detail = await retryRateLimit(() => client.sessions.get(sessionId));
  const interactionId = detail.events.find((event) => event.interactionId)?.interactionId;
  return { sessionId, interactionId };
}

function argsFor(
  name: string,
  context: { sessionId?: string; interactionId?: string },
): Record<string, unknown> | undefined {
  if (name === "get_session_timeline" || name === "explain_slow_session") {
    return context.sessionId ? { sessionId: context.sessionId, range: RANGE } : undefined;
  }
  if (name === "get_interaction_trace" || name === "generate_interaction_waterfall") {
    return context.interactionId ? { interactionId: context.interactionId } : undefined;
  }
  if (name === "advanced_query") {
    return {
      query: {
        measures: ["SessionMetrics.count"],
        timeDimensions: [{ dimension: "SessionMetrics.eventTime", dateRange: RANGE }],
      },
    };
  }
  return { range: RANGE };
}

function validatePayload(name: string, payload: unknown): void {
  const json = JSON.stringify(payload);
  if (!json || json === "{}") throw new Error("empty payload");
  if (json.includes(process.env.CONVAI_API_KEY ?? "__missing__")) {
    throw new Error("payload echoed CONVAI_API_KEY");
  }
  if (name.includes("chart") || name === "generate_interaction_waterfall") {
    const spec = (payload as { spec?: { $schema?: string } }).spec;
    if (spec?.$schema !== "https://vega.github.io/schema/vega-lite/v5.json") {
      throw new Error("chart tool did not return a Vega-Lite spec");
    }
  }
}

function summarize(payload: unknown): string {
  const json = JSON.stringify(payload);
  return json.length > 180 ? `${json.slice(0, 180)}...` : json;
}

async function retryRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!(err instanceof RateLimitError)) throw err;
    const waitMs = Math.max(err.retryAfter ?? 65, 2) * 1000;
    await sleep(waitMs);
    return fn();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
