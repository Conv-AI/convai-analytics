/**
 * Pre-flight validation — `InvalidRangeError` and missing-argument errors
 * fire before any HTTP call. Uses a fetch stub that records calls so we
 * can assert "no network call happened" alongside "the right error was
 * raised".
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ConvaiAnalytics,
  ConvaiAnalyticsError,
  InvalidRangeError,
} from "./index.js";
import { makeStubFetch, SAMPLE_SUMMARY } from "./test-helpers.js";

function makeClient(): { client: ConvaiAnalytics; calls: ReturnType<typeof makeStubFetch>["calls"] } {
  const stub = makeStubFetch(SAMPLE_SUMMARY);
  const client = new ConvaiAnalytics({ apiKey: "ck_test_fake", fetch: stub.fetch });
  return { client, calls: stub.calls };
}

test("summary: rejects unknown range token before any request", async () => {
  const { client, calls } = makeClient();
  await assert.rejects(
    () => client.summary({ range: "last_45m" as never }),
    (err) => {
      assert.ok(err instanceof InvalidRangeError);
      assert.ok(err instanceof ConvaiAnalyticsError);
      assert.match((err as Error).message, /last_45m/);
      return true;
    },
  );
  assert.equal(calls.length, 0, "no fetch call should have happened");
});

test("timeseries: rejects unknown range token before any request", async () => {
  const { client, calls } = makeClient();
  await assert.rejects(
    () => client.timeseries({ range: "last_3m" as never, measure: "count" }),
    InvalidRangeError,
  );
  assert.equal(calls.length, 0);
});

test("breakdown: rejects unknown range token before any request", async () => {
  const { client, calls } = makeClient();
  await assert.rejects(
    () => client.breakdown({ range: "last_99h" as never, measure: "count", groupBy: "processor" }),
    InvalidRangeError,
  );
  assert.equal(calls.length, 0);
});

test("regressionDetection: rejects unknown baselineRange / currentRange", async () => {
  const { client, calls } = makeClient();
  await assert.rejects(
    () => client.regressionDetection({ baselineRange: "last_99h" as never }),
    InvalidRangeError,
  );
  await assert.rejects(
    () => client.regressionDetection({ currentRange: "last_3m" as never }),
    InvalidRangeError,
  );
  assert.equal(calls.length, 0);
});

test("sessions.get: missing sessionId raises before any request", async () => {
  const { client, calls } = makeClient();
  await assert.rejects(
    () => client.sessions.get(""),
    (err) => {
      assert.ok(err instanceof ConvaiAnalyticsError);
      assert.match((err as Error).message, /sessionId is required/);
      return true;
    },
  );
  assert.equal(calls.length, 0);
});

test("interactions.get: missing interactionId raises before any request", async () => {
  const { client, calls } = makeClient();
  await assert.rejects(
    () => client.interactions.get(""),
    (err) => {
      assert.ok(err instanceof ConvaiAnalyticsError);
      assert.match((err as Error).message, /interactionId is required/);
      return true;
    },
  );
  assert.equal(calls.length, 0);
});
