/**
 * Convenience-facade tests. Each facade is pure delegation over
 * `breakdown` / `timeseries`, so the tests assert that the right
 * outbound query params are produced for the canonical question each
 * facade answers.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { ConvaiAnalytics } from "./index.js";
import { makeStubFetch, SAMPLE_BREAKDOWN, SAMPLE_TIMESERIES } from "./test-helpers.js";

const BASE = "https://example.test/v1/analytics";

function buildClient(responseBody: unknown) {
  const stub = makeStubFetch(responseBody);
  return {
    client: new ConvaiAnalytics({ apiKey: "ck_test_fake", baseUrl: BASE, fetch: stub.fetch }),
    calls: stub.calls,
  };
}

test("latency.byComponent → backend-native breakdown query params", async () => {
  const { client, calls } = buildClient(SAMPLE_BREAKDOWN);
  await client.latency.byComponent({ range: "last_24h", characterId: "char_a" });
  const q = calls[0]!.url.searchParams;
  assert.equal(calls[0]!.url.pathname, "/v1/analytics/breakdown");
  assert.equal(q.get("measure"), "p95_value");
  assert.equal(q.get("group_by"), "processor");
  assert.equal(q.get("segment"), "end_to_end_turn_latency");
  assert.equal(q.get("character_id"), "char_a");
});

test("latency.overTime → backend-native timeseries query params", async () => {
  const { client, calls } = buildClient(SAMPLE_TIMESERIES);
  await client.latency.overTime({ range: "last_7d", granularity: "hour" });
  const q = calls[0]!.url.searchParams;
  assert.equal(calls[0]!.url.pathname, "/v1/analytics/timeseries");
  assert.equal(q.get("measure"), "p95_value");
  assert.equal(q.get("metric_name"), "voice.user_to_bot_latency");
  assert.equal(q.get("granularity"), "hour");
});

test("providers.compare(component=tts) → backend-native breakdown query params", async () => {
  const { client, calls } = buildClient(SAMPLE_BREAKDOWN);
  await client.providers.compare({ component: "tts", percentile: "p99" });
  const q = calls[0]!.url.searchParams;
  assert.equal(q.get("measure"), "p99_value");
  assert.equal(q.get("group_by"), "voice_provider");
  assert.equal(q.get("segment"), "tts_metrics");
});

test("providers.compare(component=llm) → backend-native breakdown query params", async () => {
  const { client, calls } = buildClient(SAMPLE_BREAKDOWN);
  await client.providers.compare({ component: "llm" });
  const q = calls[0]!.url.searchParams;
  assert.equal(q.get("group_by"), "provider");
  assert.equal(q.get("segment"), "llm_metrics");
});

test("errors.summary → breakdown(measure=count, metric_name_prefix=error.)", async () => {
  const { client, calls } = buildClient(SAMPLE_BREAKDOWN);
  await client.errors.summary({});
  const q = calls[0]!.url.searchParams;
  assert.equal(q.get("measure"), "count");
  assert.equal(q.get("group_by"), "processor");
  assert.equal(q.get("metric_name_prefix"), "error.");
});

test("errors.overTime → timeseries(measure=count, metric_name_prefix=error.)", async () => {
  const { client, calls } = buildClient(SAMPLE_TIMESERIES);
  await client.errors.overTime({ granularity: "day" });
  const q = calls[0]!.url.searchParams;
  assert.equal(calls[0]!.url.pathname, "/v1/analytics/timeseries");
  assert.equal(q.get("measure"), "count");
  assert.equal(q.get("metric_name_prefix"), "error.");
  assert.equal(q.get("granularity"), "day");
});

test("usage.summary → backend-native breakdown query params", async () => {
  const { client, calls } = buildClient(SAMPLE_BREAKDOWN);
  await client.usage.summary({});
  const q = calls[0]!.url.searchParams;
  assert.equal(q.get("measure"), "unique_sessions");
  assert.equal(q.get("group_by"), "character_id");
});

test("usage.interactions → backend-native breakdown query params", async () => {
  const { client, calls } = buildClient(SAMPLE_BREAKDOWN);
  await client.usage.interactions({ groupBy: "experienceId" });
  const q = calls[0]!.url.searchParams;
  assert.equal(q.get("measure"), "unique_turns");
  assert.equal(q.get("group_by"), "experience_id");
});
