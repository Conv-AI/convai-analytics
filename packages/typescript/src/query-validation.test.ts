/**
 * Pre-flight validator for `client.query(...)` — mirrors the constraints
 * the backend's `/v1/analytics/query` enforces. Each test asserts the
 * right `code` is on the thrown error and that no fetch call escapes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { ConvaiAnalytics, ConvaiAnalyticsError } from "./index.js";
import { makeStubFetch, SAMPLE_CUBE_QUERY } from "./test-helpers.js";

function makeClient() {
  const stub = makeStubFetch(SAMPLE_CUBE_QUERY);
  return {
    client: new ConvaiAnalytics({
      apiKey: "ck_test_fake",
      baseUrl: "https://example.test/v1/analytics",
      fetch: stub.fetch,
    }),
    calls: stub.calls,
  };
}

async function expectCode(
  fn: () => Promise<unknown>,
  expectedCode: string,
): Promise<ConvaiAnalyticsError> {
  let captured: unknown;
  await assert.rejects(fn, (err) => {
    captured = err;
    assert.ok(err instanceof ConvaiAnalyticsError, "expected ConvaiAnalyticsError");
    assert.equal((err as ConvaiAnalyticsError).code, expectedCode);
    return true;
  });
  return captured as ConvaiAnalyticsError;
}

test("query: empty payload → empty_query", async () => {
  const { client, calls } = makeClient();
  await expectCode(() => client.query({}), "empty_query");
  assert.equal(calls.length, 0);
});

test("query: total members > 12 → query_too_wide", async () => {
  const { client, calls } = makeClient();
  const measures = Array.from(
    { length: 13 },
    (_, i) => `SessionMetrics.measure${i}`,
  );
  const err = await expectCode(() => client.query({ measures }), "query_too_wide");
  assert.equal((err.details as { total: number; max: number }).total, 13);
  assert.equal((err.details as { total: number; max: number }).max, 12);
  assert.equal(calls.length, 0);
});

test("query: member without SessionMetrics. prefix → invalid_member", async () => {
  const { client, calls } = makeClient();
  await expectCode(
    () => client.query({ measures: ["BadModel.x"] }),
    "invalid_member",
  );
  await expectCode(
    () => client.query({
      measures: ["SessionMetrics.x"],
      filters: [{ member: "Other.field", operator: "equals", values: ["a"] }],
    }),
    "invalid_member",
  );
  await expectCode(
    () => client.query({
      measures: ["SessionMetrics.x"],
      timeDimensions: [{ dimension: "Wrong.eventTime", granularity: "hour" }],
    }),
    "invalid_member",
  );
  assert.equal(calls.length, 0);
});

test("query: timeDimension granularity 'second' → forbidden_granularity", async () => {
  const { client, calls } = makeClient();
  await expectCode(
    () => client.query({
      measures: ["SessionMetrics.uniqueSessions"],
      timeDimensions: [
        { dimension: "SessionMetrics.eventTime", granularity: "second" },
      ],
    }),
    "forbidden_granularity",
  );
  assert.equal(calls.length, 0);
});

test("query: limit out of range → invalid_limit", async () => {
  const { client, calls } = makeClient();
  await expectCode(
    () => client.query({ measures: ["SessionMetrics.uniqueSessions"], limit: 0 }),
    "invalid_limit",
  );
  await expectCode(
    () => client.query({ measures: ["SessionMetrics.uniqueSessions"], limit: 6_000 }),
    "invalid_limit",
  );
  assert.equal(calls.length, 0);
});

test("query: well-formed payload still goes through", async () => {
  const { client, calls } = makeClient();
  await client.query({
    measures: ["SessionMetrics.uniqueSessions"],
    dimensions: ["SessionMetrics.characterId"],
    timeDimensions: [
      { dimension: "SessionMetrics.eventTime", granularity: "hour" },
    ],
    limit: 100,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url.pathname, "/v1/analytics/query");
});
