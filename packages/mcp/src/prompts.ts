import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { z } from "zod/v4";

export interface PromptDefinition {
  name: string;
  title: string;
  description: string;
  argsSchema: ZodRawShapeCompat;
  build: (args: Record<string, unknown>) => string;
}

const rangeArg = z.string().default("last_24h").describe("Time range such as last_24h, last_7d, or last_30d.");
const optionalText = z.string().optional();

export const PROMPT_DEFINITIONS: PromptDefinition[] = [
  {
    name: "why_was_this_session_slow",
    title: "Why Was This Session Slow",
    description: "Investigate a slow session and explain the likely latency contributors.",
    argsSchema: {
      sessionId: optionalText.describe("Optional session id. Omit to inspect the slowest sessions."),
      range: rangeArg,
    },
    build: ({ sessionId, range }) =>
      `Explain why ${sessionId ? `session ${sessionId}` : `a slow session in ${range}`} felt slow. Use explain_slow_session first, then inspect the waterfall spans and call out the top processor, provider, model, and duration signals. Keep the answer customer-readable and mention if data is missing.`,
  },
  {
    name: "aggregate_latency_distribution",
    title: "Aggregate Latency Distribution",
    description: "Generate P50/P95/P99 latency distribution for production-readiness review.",
    argsSchema: {
      range: rangeArg,
      thresholdMs: z.number().positive().default(3000),
    },
    build: ({ range, thresholdMs }) =>
      `Show aggregate P50/P95/P99 voice.user_to_bot_latency for ${range}. Use get_latency_percentile_chart and get_latency_threshold_chart with thresholdMs=${thresholdMs}. Explain systemic trend, tail behavior, and whether p95 appears production-ready.`,
  },
  {
    name: "p95_latency_trend",
    title: "P95 Latency Trend",
    description: "Track p95 end-to-end latency over time, optionally filtered to a character.",
    argsSchema: {
      range: rangeArg,
      characterId: optionalText.describe("Optional character id filter."),
    },
    build: ({ range, characterId }) =>
      `Show p95 end-to-end voice latency over ${range}${characterId ? ` for character ${characterId}` : ""}. Use get_p95_latency_over_time and summarize high/low buckets, sample volume, and trend direction.`,
  },
  {
    name: "component_bottlenecks",
    title: "Component Bottlenecks",
    description: "Find which component contributes most to p95 latency.",
    argsSchema: {
      range: rangeArg,
      topN: z.number().int().min(1).max(20).default(5),
    },
    build: ({ range, topN }) =>
      `Which processors contribute most to p95 latency in ${range}? Use find_component_latency_bottlenecks with topN=${topN}, then explain the ranking and which component should be investigated first.`,
  },
  {
    name: "trace_explanation",
    title: "Trace Explanation",
    description: "Explain what happened inside a single interaction id.",
    argsSchema: {
      interactionId: z.string().describe("Convai interaction id."),
    },
    build: ({ interactionId }) =>
      `Explain the latency breakdown for interaction ${interactionId}. Use get_interaction_trace and generate_interaction_waterfall, then summarize processor/provider/model spans, failures, and the top latency contributor.`,
  },
  {
    name: "error_rate_trends",
    title: "Error Rate Trends",
    description: "Analyze errors over time and by component/provider.",
    argsSchema: {
      range: rangeArg,
    },
    build: ({ range }) =>
      `Analyze reliability for ${range}. Use get_error_trend, get_error_breakdown, get_dropped_error_persist_trend, and generate_reliability_trends_chart. Summarize whether errors are increasing and which component looks responsible.`,
  },
  {
    name: "provider_comparison",
    title: "Provider Comparison",
    description: "Compare LLM/TTS/ASR/NeuroSync providers by latency and sample count.",
    argsSchema: {
      range: rangeArg,
      component: z.enum(["llm", "tts", "asr", "neurosync"]).default("llm"),
    },
    build: ({ range, component }) =>
      `Compare ${component} providers for ${range}. Use compare_providers and, when useful, generate_tts_provider_chart or generate_llm_model_latency_chart. Return provider/model, p95 latency, sample count, and reliability caveats.`,
  },
  {
    name: "usage_summary",
    title: "Usage Summary",
    description: "Summarize sessions, interactions, unique users, characters, and usage trend charts.",
    argsSchema: {
      range: rangeArg,
    },
    build: ({ range }) =>
      `Summarize usage for ${range}. Use get_summary, get_usage_trends, generate_usage_trends_chart, and get_character_usage_leaderboard. Include sessions, interactions, unique end users, top characters, and any obvious usage spikes.`,
  },
];

export function registerPrompts(server: McpServer): void {
  for (const prompt of PROMPT_DEFINITIONS) {
    server.registerPrompt(
      prompt.name,
      {
        title: prompt.title,
        description: prompt.description,
        argsSchema: prompt.argsSchema,
      },
      async (args) => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: prompt.build(args as Record<string, unknown>),
            },
          },
        ],
      }),
    );
  }
}
