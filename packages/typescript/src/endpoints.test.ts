/**
 * Endpoint tests — one per SDK method, using a fetch stub that captures
 * the outbound request so we can assert URL, method, headers, query
 * params, and (for POST) request body. Response shape is a canned camelCase
 * payload that mirrors what the backend emits.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { ConvaiAnalytics, PlanInsufficientError, RateLimitError } from "./index.js";
import {
  makeStubFetch,
  SAMPLE_BREAKDOWN,
  SAMPLE_CATALOG,
  SAMPLE_CUBE_QUERY,
  SAMPLE_INTERACTION,
  SAMPLE_REGRESSION,
  SAMPLE_SESSION_DETAIL,
  SAMPLE_SESSION_LIST,
  SAMPLE_SUMMARY,
  SAMPLE_TIMESERIES,
} from "./test-helpers.js";

const BASE = "https://example.test/v1/analytics";
const KEY = "ck_test_fake";

function buildClient(responseBody: unknown, status = 200) {
  const stub = makeStubFetch(responseBody, status);
  const client = new ConvaiAnalytics({
    apiKey: KEY,
    baseUrl: BASE,
    fetch: stub.fetch,
  });
  return { client, calls: stub.calls };
}

function assertCall(
  call: { url: URL; method: string; headers: Headers },
  expected: { method: string; pathname: string; query?: Record<string, string> },
) {
  assert.equal(call.method, expected.method);
  assert.equal(call.url.pathname, expected.pathname);
  assert.equal(call.headers.get("CONVAI-API-KEY"), KEY);
  assert.equal(call.headers.get("Accept"), "application/json");
  for (const [k, v] of Object.entries(expected.query ?? {})) {
    assert.equal(
      call.url.searchParams.get(k),
      v,
      `expected query[${k}]=${v}, got ${call.url.searchParams.get(k)}`,
    );
  }
}

// ---------- summary ----------

test("summary: GETs /summary with snake_case params and returns parsed body", async () => {
  const { client, calls } = buildClient(SAMPLE_SUMMARY);
  const result = await client.summary({
    range: "last_24h",
    characterId: "npc_warrior_42",
    appKey: "app_x",
  });
  assert.equal(calls.length, 1);
  assertCall(calls[0]!, {
    method: "GET",
    pathname: "/v1/analytics/summary",
    query: { range: "last_24h", character_id: "npc_warrior_42", app_key: "app_x" },
  });
  assert.equal(result.sessions, 100);
  assert.equal(result.p95EndToEndMs, 450);
});

test("summary: undefined params are not sent on the wire", async () => {
  const { client, calls } = buildClient(SAMPLE_SUMMARY);
  await client.summary({ range: "last_24h" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url.searchParams.has("character_id"), false);
  assert.equal(calls[0]!.url.searchParams.has("app_key"), false);
});

// ---------- timeseries ----------

test("timeseries: GETs /timeseries with measure / granularity / group_by", async () => {
  const { client, calls } = buildClient(SAMPLE_TIMESERIES);
  const result = await client.timeseries({
    measure: "p95",
    granularity: "hour",
    range: "last_7d",
    groupBy: "processor",
    metricName: "voice.user_to_bot_latency",
    characterId: "char_a",
  });
  assert.equal(calls.length, 1);
  assertCall(calls[0]!, {
    method: "GET",
    pathname: "/v1/analytics/timeseries",
    query: {
      measure: "p95",
      granularity: "hour",
      range: "last_7d",
      group_by: "processor",
      metric_name: "voice.user_to_bot_latency",
      character_id: "char_a",
    },
  });
  assert.equal(result.measure, "count");
  assert.equal(result.points.length, 2);
});

// ---------- breakdown ----------

test("breakdown: GETs /breakdown with all filter dimensions", async () => {
  const { client, calls } = buildClient(SAMPLE_BREAKDOWN);
  const result = await client.breakdown({
    measure: "count",
    groupBy: "processor",
    range: "last_24h",
    limit: 10,
    metricNamePrefix: "error.",
    characterId: "char_a",
    appKey: "app_x",
    provider: "openai",
    status: "error",
  });
  assert.equal(calls.length, 1);
  assertCall(calls[0]!, {
    method: "GET",
    pathname: "/v1/analytics/breakdown",
    query: {
      measure: "count",
      group_by: "processor",
      range: "last_24h",
      limit: "10",
      metric_name_prefix: "error.",
      character_id: "char_a",
      app_key: "app_x",
      provider: "openai",
      status: "error",
    },
  });
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0]!.group, "llm");
});

// ---------- catalog ----------

test("catalog: GETs /metrics/catalog with no query params", async () => {
  const { client, calls } = buildClient(SAMPLE_CATALOG);
  const result = await client.catalog();
  assert.equal(calls.length, 1);
  assertCall(calls[0]!, { method: "GET", pathname: "/v1/analytics/metrics/catalog" });
  assert.equal([...calls[0]!.url.searchParams.keys()].length, 0);
  assert.equal(result.metrics.length, 1);
  assert.equal(result.metrics[0]!.metricName, "voice.user_to_bot_latency");
});

// ---------- sessions.list (cursor pagination round-trip) ----------

test("sessions.list: round-trips an opaque cursor", async () => {
  // Page 1: no cursor → returns nextCursor.
  const stub1 = makeStubFetch(SAMPLE_SESSION_LIST);
  const client1 = new ConvaiAnalytics({ apiKey: KEY, baseUrl: BASE, fetch: stub1.fetch });
  const page1 = await client1.sessions.list({ range: "last_24h", limit: 25 });
  assertCall(stub1.calls[0]!, {
    method: "GET",
    pathname: "/v1/analytics/sessions",
    query: { range: "last_24h", limit: "25" },
  });
  assert.equal(stub1.calls[0]!.url.searchParams.has("cursor"), false);
  assert.equal(page1.nextCursor, "cur_second_page");

  // Page 2: feed nextCursor back as `cursor`. Server stops paginating.
  const stub2 = makeStubFetch({ ...SAMPLE_SESSION_LIST, sessions: [], nextCursor: null });
  const client2 = new ConvaiAnalytics({ apiKey: KEY, baseUrl: BASE, fetch: stub2.fetch });
  const page2 = await client2.sessions.list({ range: "last_24h", limit: 25, cursor: page1.nextCursor! });
  assertCall(stub2.calls[0]!, {
    method: "GET",
    pathname: "/v1/analytics/sessions",
    query: { range: "last_24h", limit: "25", cursor: "cur_second_page" },
  });
  assert.equal(page2.nextCursor, null);
  assert.equal(page2.sessions.length, 0);
});

// ---------- sessions.get ----------

test("sessions.get: GETs /sessions/{id} with URL-encoded id", async () => {
  const { client, calls } = buildClient(SAMPLE_SESSION_DETAIL);
  const result = await client.sessions.get("s/with weird+chars");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "GET");
  // encodeURIComponent encodes `/`, space and `+`
  assert.equal(calls[0]!.url.pathname, "/v1/analytics/sessions/s%2Fwith%20weird%2Bchars");
  assert.equal(result.sessionId, "s_first");
  assert.equal(result.events.length, 1);
});

// ---------- interactions.get ----------

test("interactions.get: GETs /interactions/{id}", async () => {
  const { client, calls } = buildClient(SAMPLE_INTERACTION);
  const result = await client.interactions.get("int_1");
  assert.equal(calls.length, 1);
  assertCall(calls[0]!, { method: "GET", pathname: "/v1/analytics/interactions/int_1" });
  assert.equal(result.interactionId, "int_1");
  assert.equal(result.spans.length, 1);
  assert.equal(result.spans[0]!.processor, "asr");
});

// ---------- regressionDetection (plan-gated) ----------

test("regressionDetection: GETs /regression-detection with snake_case params", async () => {
  const { client, calls } = buildClient(SAMPLE_REGRESSION);
  const result = await client.regressionDetection({
    measure: "voice.user_to_bot_latency",
    baselineRange: "last_7d",
    currentRange: "last_24h",
    groupBy: "provider",
    threshold: 0.2,
  });
  assert.equal(calls.length, 1);
  assertCall(calls[0]!, {
    method: "GET",
    pathname: "/v1/analytics/regression-detection",
    query: {
      measure: "voice.user_to_bot_latency",
      baseline_range: "last_7d",
      current_range: "last_24h",
      group_by: "provider",
      threshold: "0.2",
    },
  });
  assert.equal(result.rows[0]!.significant, true);
});

test("regressionDetection: 403 → PlanInsufficientError", async () => {
  const { client } = buildClient(
    {
      error: {
        code: "plan_below_required",
        message: "Endpoint requires plan 'business' (current: 'scale').",
        details: { required_plan: "business", current_plan: "scale" },
      },
    },
    403,
  );
  await assert.rejects(
    () => client.regressionDetection({}),
    (err) => {
      assert.ok(err instanceof PlanInsufficientError);
      assert.equal(err.status, 403);
      assert.equal(err.code, "plan_below_required");
      return true;
    },
  );
});

// ---------- query (POST, plan-gated) ----------

test("query: POSTs JSON body to /query and parses response", async () => {
  const { client, calls } = buildClient(SAMPLE_CUBE_QUERY);
  const result = await client.query({
    measures: ["SessionMetrics.uniqueSessions"],
    dimensions: ["SessionMetrics.characterId"],
    limit: 100,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "POST");
  assert.equal(calls[0]!.url.pathname, "/v1/analytics/query");
  assert.equal(calls[0]!.headers.get("Content-Type"), "application/json");
  assert.equal(calls[0]!.headers.get("CONVAI-API-KEY"), KEY);
  assert.deepEqual(calls[0]!.body, {
    measures: ["SessionMetrics.uniqueSessions"],
    dimensions: ["SessionMetrics.characterId"],
    limit: 100,
  });
  assert.equal(result.data.length, 1);
});

test("query: 402 → PlanRequiredError surfaces the required plan in details", async () => {
  const { client } = buildClient(
    {
      error: {
        code: "plan_required",
        message: "Analytics API requires the scale plan or higher.",
        details: { required_plan: "scale", current_plan: "starter" },
      },
    },
    402,
  );
  await assert.rejects(
    () => client.query({ measures: ["SessionMetrics.uniqueSessions"], limit: 1 }),
    (err) => {
      assert.equal((err as { status: number }).status, 402);
      assert.deepEqual((err as { details: unknown }).details, {
        required_plan: "scale",
        current_plan: "starter",
      });
      return true;
    },
  );
});

// ---------- 429 → RateLimitError carries Retry-After ----------

test("any endpoint: 429 → RateLimitError with retryAfter parsed", async () => {
  const stub = makeStubFetch(
    { error: { code: "rate_limited", message: "Slow down." } },
    429,
    { "Retry-After": "30" },
  );
  const client = new ConvaiAnalytics({ apiKey: KEY, baseUrl: BASE, fetch: stub.fetch });
  await assert.rejects(
    () => client.summary({ range: "last_24h" }),
    (err) => {
      assert.ok(err instanceof RateLimitError);
      assert.equal(err.retryAfter, 30);
      return true;
    },
  );
});
