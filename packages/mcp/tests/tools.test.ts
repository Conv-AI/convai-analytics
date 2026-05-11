import assert from "node:assert/strict";
import test from "node:test";

import { PlanInsufficientError, type ConvaiAnalytics } from "@convai/analytics";

import { PROMPT_DEFINITIONS } from "../src/prompts.js";
import { RESOURCE_URIS } from "../src/resources.js";
import { errorResult } from "../src/results.js";
import { ANALYTICS_TOOLS } from "../src/tools.js";

const EXPECTED_TOOLS = [
  "get_summary",
  "get_metrics_catalog",
  "list_sessions",
  "get_session_timeline",
  "get_interaction_trace",
  "get_first_response_summary",
  "get_first_response_timeseries",
  "get_first_response_breakdown",
  "get_first_response_markers",
  "get_first_response_settings",
  "get_interaction_first_response",
  "get_p95_latency_over_time",
  "get_latency_percentile_series",
  "get_latency_percentile_chart",
  "get_latency_threshold_chart",
  "get_latency_heatmap_chart",
  "get_component_latency_breakdown",
  "generate_component_latency_chart",
  "find_component_latency_bottlenecks",
  "generate_interaction_waterfall",
  "explain_slow_session",
  "get_error_trend",
  "generate_error_trend_chart",
  "get_error_breakdown",
  "generate_error_breakdown_chart",
  "get_dropped_error_persist_trend",
  "generate_dropped_error_persist_chart",
  "generate_reliability_summary_chart",
  "generate_reliability_trends_chart",
  "get_usage_trends",
  "generate_usage_trends_chart",
  "get_character_usage_leaderboard",
  "generate_character_usage_chart",
  "generate_session_duration_scatter",
  "estimate_active_session_concurrency",
  "generate_active_session_concurrency_chart",
  "generate_peak_concurrency_chart",
  "get_tts_provider_attribution",
  "generate_tts_provider_chart",
  "get_llm_model_latency",
  "generate_llm_model_latency_chart",
  "compare_providers",
  "detect_regressions",
  "advanced_query",
] as const;

const EXPECTED_PROMPTS = [
  "why_was_this_session_slow",
  "aggregate_latency_distribution",
  "p95_latency_trend",
  "component_bottlenecks",
  "trace_explanation",
  "error_rate_trends",
  "provider_comparison",
  "usage_summary",
] as const;

test("registers the full E2E-backed MCP surface", () => {
  assert.deepEqual(ANALYTICS_TOOLS.map((tool) => tool.name), [...EXPECTED_TOOLS]);
  assert.deepEqual(PROMPT_DEFINITIONS.map((prompt) => prompt.name), [...EXPECTED_PROMPTS]);
  assert.deepEqual(RESOURCE_URIS, [
    "convai://analytics/docs/concepts",
    "convai://analytics/docs/metrics-reference",
    "convai://analytics/docs/authentication",
    "convai://analytics/catalog",
  ]);
});

test("tool schemas do not accept tenant or infrastructure credentials", () => {
  const forbidden = new Set([
    "tenant_id",
    "tenantId",
    "account_id",
    "accountId",
    "cubeSecret",
    "cubeJwtSecret",
    "databaseUrl",
    "bigQueryProject",
    "serviceAccountJson",
  ]);

  for (const tool of ANALYTICS_TOOLS) {
    for (const key of Object.keys(tool.inputSchema)) {
      assert.equal(forbidden.has(key), false, `${tool.name} exposes forbidden input ${key}`);
    }
  }
});

test("every MCP tool returns stable JSON with a fake SDK client", async () => {
  const client = fakeClient();

  for (const tool of ANALYTICS_TOOLS) {
    const payload = await tool.handler(client, argsFor(tool.name));
    const json = JSON.stringify(payload);
    assert.ok(json.length > 2, `${tool.name} returned empty payload`);
    assert.doesNotThrow(() => JSON.parse(json));
    assert.equal(json.includes("CONVAI_API_KEY"), false);
    assert.equal(json.includes("secret-api-key"), false);
  }
});

test("chart tools return Vega-Lite specs", async () => {
  const client = fakeClient();
  const chartTools = ANALYTICS_TOOLS.filter(
    (tool) => tool.name.includes("chart") || tool.name === "generate_interaction_waterfall",
  );

  for (const tool of chartTools) {
    const payload = await tool.handler(client, argsFor(tool.name));
    const spec = (payload as { spec?: { $schema?: string } }).spec;
    assert.equal(spec?.$schema, "https://vega.github.io/schema/vega-lite/v5.json", tool.name);
  }
});

test("plan-gated SDK errors become typed MCP tool errors", () => {
  const result = errorResult(
    new PlanInsufficientError({
      code: "plan_insufficient",
      message: "This endpoint requires a higher plan.",
      details: { required_plan: "Business" },
    }),
  );

  assert.equal(result.isError, true);
  assert.match(result.content[0]?.type === "text" ? result.content[0].text : "", /PlanInsufficientError/);
  assert.match(result.content[0]?.type === "text" ? result.content[0].text : "", /Required plan: Business/);
  assert.deepEqual((result.structuredContent as { error: { requiredPlan: string } }).error.requiredPlan, "Business");
});

test("tool errors redact API keys", () => {
  const oldKey = process.env.CONVAI_API_KEY;
  process.env.CONVAI_API_KEY = "secret-api-key";
  try {
    const result = errorResult(new Error("failed with api_key=secret-api-key"));
    const text = result.content[0]?.type === "text" ? result.content[0].text : "";
    assert.equal(text.includes("secret-api-key"), false);
  } finally {
    if (oldKey === undefined) {
      delete process.env.CONVAI_API_KEY;
    } else {
      process.env.CONVAI_API_KEY = oldKey;
    }
  }
});

function argsFor(name: string): Record<string, unknown> {
  switch (name) {
    case "get_session_timeline":
    case "explain_slow_session":
      return { sessionId: "s_1", range: "last_24h" };
    case "get_interaction_trace":
    case "generate_interaction_waterfall":
    case "get_interaction_first_response":
      return { interactionId: "i_1" };
    case "get_first_response_summary":
    case "get_first_response_timeseries":
    case "get_first_response_breakdown":
    case "get_first_response_markers":
      return { characterId: "char_1", range: "last_24h" };
    case "get_first_response_settings":
      return { settingsHash: "settings_abc", characterId: "char_1" };
    case "advanced_query":
      return { query: { measures: ["SessionMetrics.count"] } };
    default:
      return { range: "last_24h" };
  }
}

function fakeClient(): ConvaiAnalytics {
  const summary = {
    sessions: 10,
    interactions: 42,
    uniqueEndUsers: 7,
    errorCount: 1,
    p50EndToEndMs: 900,
    p95EndToEndMs: 1800,
    p99EndToEndMs: 2400,
    effectiveRange: { start: "2026-05-01T00:00:00.000Z", end: "2026-05-02T00:00:00.000Z" },
    meta: { sampleCount: 42 },
  };
  const timeseries = {
    points: [
      { bucketStart: "2026-05-01T00:00:00.000Z", value: 1000 },
      { bucketStart: "2026-05-01T01:00:00.000Z", value: 1500 },
    ],
    meta: { sampleCount: 42 },
  };
  const breakdown = {
    rows: [
      { group: "llm", value: 900, sampleCount: 20 },
      { group: "tts", value: 700, sampleCount: 22 },
    ],
    meta: { sampleCount: 42 },
  };
  const sessions = {
    sessions: [
      {
        sessionId: "s_1",
        startTime: "2026-05-01T00:00:00.000Z",
        endTime: "2026-05-01T00:05:00.000Z",
        durationSec: 300,
        interactionCount: 4,
        p95EndToEndMs: 1800,
      },
    ],
    nextCursor: null,
    meta: { sampleCount: 1 },
  };
  const detail = {
    sessionId: "s_1",
    events: [
      {
        metricName: "voice.user_to_bot_latency",
        interactionId: "i_1",
        value: 1800,
        eventTime: "2026-05-01T00:00:01.000Z",
      },
    ],
    meta: { sampleCount: 1 },
  };
  const trace = {
    interactionId: "i_1",
    spans: [
      {
        metricName: "llm.ttfb",
        processor: "llm",
        provider: "openai",
        model: "gpt-test",
        status: "ok",
        durationMs: 900,
      },
      {
        metricName: "tts.text_to_first_audio",
        processor: "tts",
        provider: "test-tts",
        model: "voice-test",
        status: "ok",
        durationMs: 700,
      },
    ],
    meta: { sampleCount: 2 },
  };
  const firstResponseSummary = {
    characterId: "char_1",
    turnScope: "all",
    latencyKind: "primary",
    stats: { count: 10, p50Ms: 500, p95Ms: 900, p99Ms: 1200 },
    meta: { sampleCount: 10 },
  };
  const firstResponseTimeseries = {
    characterId: "char_1",
    turnScope: "all",
    latencyKind: "primary",
    granularity: "hour",
    points: [
      {
        bucketStart: "2026-05-01T00:00:00.000Z",
        stats: { count: 5, p50Ms: 500, p95Ms: 900, p99Ms: 1200 },
      },
    ],
    meta: { sampleCount: 5 },
  };
  const firstResponseBreakdown = {
    characterId: "char_1",
    turnScope: "all",
    latencyKind: "primary",
    groupBy: "mode",
    rows: [{ group: "voice_to_voice_animation", stats: { count: 5, p95Ms: 900 } }],
    meta: { sampleCount: 5 },
  };
  const firstResponseMarkers = {
    characterId: "char_1",
    turnScope: "all",
    latencyKind: "primary",
    markers: [
      {
        timestamp: "2026-05-01T00:00:00.000Z",
        currentSettingsHash: "settings_abc",
        changedSettingCategories: ["llm"],
        currentSettingsUrl: "/v1/analytics/first-response/settings/settings_abc",
      },
    ],
    meta: { sampleCount: 1 },
  };
  const firstResponseSettings = {
    characterId: "char_1",
    settingsHash: "settings_abc",
    settingsSnapshotVersion: 1,
    settings: { llm: { model: "gpt-test" } },
    categoryHashes: { llm: "hash-llm" },
    meta: { sampleCount: 1 },
  };
  const interactionFirstResponse = {
    interactionId: "i_1",
    characterId: "char_1",
    mode: "voice_to_voice_animation",
    latencyKind: "all_modalities_ready",
    durationMs: 900,
    settingsHash: "settings_abc",
    spans: [{ stage: "tts_first_audio_ready", durationMs: 300, includedInSum: true }],
    meta: { sampleCount: 1 },
  };

  return {
    summary: async () => summary,
    catalog: async () => ({ metrics: [{ metricName: "voice.user_to_bot_latency" }] }),
    timeseries: async () => timeseries,
    breakdown: async () => breakdown,
    regressionDetection: async () => ({ rows: [], meta: { sampleCount: 0 } }),
    query: async (query: unknown) => ({ query, data: [], meta: { sampleCount: 0 } }),
    sessions: {
      list: async () => sessions,
      get: async () => detail,
    },
    interactions: {
      get: async () => trace,
    },
    firstResponse: {
      summary: async () => firstResponseSummary,
      timeseries: async () => firstResponseTimeseries,
      breakdown: async () => firstResponseBreakdown,
      markers: async () => firstResponseMarkers,
      settings: async () => firstResponseSettings,
      interaction: async () => interactionFirstResponse,
    },
    latency: {
      byComponent: async () => breakdown,
      overTime: async () => timeseries,
    },
    providers: {
      compare: async () => breakdown,
    },
    errors: {
      overTime: async () => timeseries,
      summary: async () => breakdown,
    },
    usage: {
      summary: async () => breakdown,
      interactions: async () => breakdown,
    },
  } as unknown as ConvaiAnalytics;
}
