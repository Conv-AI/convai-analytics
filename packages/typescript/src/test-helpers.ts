/**
 * Test fixtures + a fetch stub the endpoint tests share.
 *
 * No `.test.ts` suffix so node:test doesn't collect this file directly.
 */

import type { components } from "./_generated.js";

export interface StubCall {
  url: URL;
  method: string;
  headers: Headers;
  body: unknown;
}

export interface StubFetch {
  fetch: typeof globalThis.fetch;
  calls: StubCall[];
}

/**
 * Build a fetch stub that returns the given JSON body with a 200 status.
 * Captures every call into `.calls` so tests can assert URL / method /
 * headers / body.
 */
export function makeStubFetch(responseBody: unknown, status = 200, extraHeaders: Record<string, string> = {}): StubFetch {
  const calls: StubCall[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof URL ? input : new URL(input as string);
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    let body: unknown = undefined;
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    calls.push({ url, method, headers, body });

    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { "Content-Type": "application/json", ...extraHeaders },
    });
  };
  return { fetch, calls };
}

// ---------- Canned responses (camelCase, matching backend wire format) ----------

const META: components["schemas"]["ResponseMeta"] = {
  freshnessAt: "2026-05-05T16:00:00+00:00",
  sampleCount: 100,
  effectiveRange: {
    startTime: "2026-05-04T16:00:00+00:00",
    endTime: "2026-05-05T16:00:00+00:00",
  },
  backend: "cube",
  cacheHit: false,
};

export const SAMPLE_SUMMARY: components["schemas"]["SummaryResponse"] = {
  sessions: 100,
  uniqueEndUsers: 42,
  interactions: 250,
  errorCount: 3,
  p50EndToEndMs: 120.5,
  p95EndToEndMs: 450.0,
  p99EndToEndMs: 800.0,
  meta: META,
};

export const SAMPLE_TIMESERIES: components["schemas"]["TimeseriesResponse"] = {
  measure: "count",
  granularity: "hour",
  points: [
    { bucketStart: "2026-05-05T15:00:00+00:00", value: 12 },
    { bucketStart: "2026-05-05T16:00:00+00:00", value: 18 },
  ],
  meta: META,
};

export const SAMPLE_BREAKDOWN: components["schemas"]["BreakdownResponse"] = {
  measure: "count",
  groupBy: "processor",
  rows: [
    { group: "llm", value: 100, sampleCount: 100 },
    { group: "tts", value: 80, sampleCount: 80 },
  ],
  meta: META,
};

export const SAMPLE_CATALOG: components["schemas"]["CatalogResponse"] = {
  metrics: [
    {
      metricName: "voice.user_to_bot_latency",
      metricType: "UserBotLatencyMetricsData",
      unit: "ms",
      description: "End-to-end latency from end-user audio in to bot audio out.",
      visibility: "public",
      supportsPercentiles: true,
    },
  ],
  meta: META,
};

export const SAMPLE_SESSION_LIST: components["schemas"]["SessionListResponse"] = {
  sessions: [
    {
      sessionId: "s_first",
      characterId: "char_a",
      appKey: "app_x",
      experienceId: null,
      startTime: "2026-05-05T15:00:00+00:00",
      endTime: "2026-05-05T15:30:00+00:00",
      durationSec: 1800,
      interactionCount: 25,
      p95EndToEndMs: 420,
      errorCount: 0,
    },
  ],
  nextCursor: "cur_second_page",
  meta: META,
};

export const SAMPLE_SESSION_DETAIL: components["schemas"]["SessionDetail"] = {
  sessionId: "s_first",
  characterId: "char_a",
  appKey: "app_x",
  experienceId: null,
  startTime: "2026-05-05T15:00:00+00:00",
  endTime: "2026-05-05T15:30:00+00:00",
  events: [
    {
      eventTime: "2026-05-05T15:00:01+00:00",
      metricName: "voice.user_to_bot_latency",
      metricType: "UserBotLatencyMetricsData",
      processor: null,
      interactionId: "int_1",
      status: "ok",
      value: 410,
      attributes: null,
    },
  ],
  meta: META,
};

export const SAMPLE_INTERACTION: components["schemas"]["InteractionTrace"] = {
  interactionId: "int_1",
  sessionId: "s_first",
  characterId: "char_a",
  appKey: "app_x",
  endUserId: null,
  interactionType: "voice_turn",
  startTime: "2026-05-05T15:00:00+00:00",
  endTime: "2026-05-05T15:00:00.41+00:00",
  totalDurationMs: 410,
  terminalStatus: "ok",
  failureStage: null,
  spans: [
    {
      processor: "asr",
      startTime: "2026-05-05T15:00:00+00:00",
      endTime: "2026-05-05T15:00:00.1+00:00",
      durationMs: 100,
      status: "ok",
      provider: "deepgram",
      model: null,
      errorCode: null,
      attributes: null,
    },
  ],
  meta: META,
};

export const SAMPLE_REGRESSION: components["schemas"]["RegressionResponse"] = {
  rows: [
    {
      group: "all",
      baselineValue: 400,
      currentValue: 480,
      relativeChange: 0.2,
      sampleCount: 250,
      significant: true,
    },
  ],
  meta: META,
};

export const SAMPLE_CUBE_QUERY: components["schemas"]["CubeQueryResponse"] = {
  data: [{ "SessionMetrics.uniqueSessions": 100 }],
  meta: META,
};

export const SAMPLE_FIRST_RESPONSE_SUMMARY = {
  characterId: "char_a",
  mode: "voice_to_voice_animation",
  turnScope: "all",
  latencyKind: "primary",
  stats: { count: 10, avgMs: 650, p50Ms: 500, p95Ms: 900, p99Ms: 1200 },
  meta: META,
};

export const SAMPLE_FIRST_RESPONSE_TIMESERIES = {
  characterId: "char_a",
  mode: "voice_to_voice_animation",
  turnScope: "all",
  latencyKind: "primary",
  granularity: "hour",
  points: [
    {
      bucketStart: "2026-05-05T15:00:00+00:00",
      stats: { count: 5, p50Ms: 500, p95Ms: 900, p99Ms: 1200 },
    },
  ],
  meta: META,
};

export const SAMPLE_FIRST_RESPONSE_BREAKDOWN = {
  characterId: "char_a",
  mode: null,
  turnScope: "warm",
  latencyKind: "primary",
  groupBy: "mode",
  rows: [
    {
      group: "voice_to_voice_animation",
      stats: { count: 5, p50Ms: 500, p95Ms: 900, p99Ms: 1200 },
    },
  ],
  meta: META,
};

export const SAMPLE_FIRST_RESPONSE_MARKERS = {
  characterId: "char_a",
  mode: null,
  turnScope: "all",
  latencyKind: "primary",
  markers: [
    {
      timestamp: "2026-05-05T15:00:00+00:00",
      priorSettingsHash: null,
      currentSettingsHash: "settings_abc",
      changedSettingCategories: ["llm"],
      priorSettingsUrl: null,
      currentSettingsUrl: "/v1/analytics/first-response/settings/settings_abc",
    },
  ],
  meta: META,
};

export const SAMPLE_FIRST_RESPONSE_SETTINGS = {
  characterId: "char_a",
  settingsHash: "settings_abc",
  settingsSnapshotVersion: 1,
  settings: { llm: { model: "gpt-test" } },
  categoryHashes: { llm: "hash-llm" },
  firstSeenAt: "2026-05-05T15:00:00+00:00",
  lastSeenAt: "2026-05-05T15:00:00+00:00",
  meta: META,
};

export const SAMPLE_INTERACTION_FIRST_RESPONSE = {
  interactionId: "int_1",
  sessionId: "s_first",
  characterId: "char_a",
  turnId: 2,
  criticalPathId: "critical_1",
  mode: "voice_to_voice_animation",
  inputModalities: "voice",
  outputMode: "voice_animation",
  outputModality: "animation",
  latencyKind: "all_modalities_ready",
  durationMs: 900,
  settingsHash: "settings_abc",
  spans: [
    {
      stage: "tts_first_audio_ready",
      sequenceIndex: 1,
      startBoundary: "llm_first_text_handoff",
      endBoundary: "tts_first_audio_ready",
      durationMs: 300,
      includedInSum: true,
    },
  ],
  meta: META,
};
