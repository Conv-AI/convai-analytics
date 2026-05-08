# Roadmap

What `convai-analytics` does today, what's coming next, and what's further out. Framed as **now / next / later** — the order is committed, the timing is not.

---

## Now — v0.2

The full v1 endpoint surface is wired end-to-end across the TypeScript SDK, Python SDK, CLI, and local MCP server. Anything below that doesn't say "later" returns real numbers from your own data — no stubs.

### Account-level KPIs

```ts
import { ConvaiAnalytics } from "@convai/analytics";

const client = new ConvaiAnalytics({ apiKey: process.env.CONVAI_API_KEY! });

const summary = await client.summary({ range: "last_24h" });
// summary.sessions, summary.uniqueEndUsers, summary.interactions,
// summary.errorCount, summary.p50EndToEndMs, summary.p95EndToEndMs,
// summary.p99EndToEndMs, ...
```

Optional filters: `characterId`, `appKey`, `experienceId`. Time range is one of `last_15m | last_1h | last_6h | last_24h | last_7d | last_30d`.

### MCP server

`@convai/analytics-mcp` exposes the same analytics surface as typed local stdio MCP tools plus prompt and resource helpers. It wraps the public TypeScript SDK, reads `CONVAI_API_KEY`, and returns structured JSON or Vega-Lite specs for chart tools.

### Time-series

```ts
const series = await client.timeseries({
  measure: "p95",
  range: "last_24h",
  granularity: "hour",
  metricName: "voice.user_to_bot_latency",
});
// series.points: [{ bucketStart, value, group? }, ...]
```

Same filter dimensions as `summary` plus `metricName` / `metricNamePrefix`, `provider`, `model`, `processor`, `status`, `endUserId`, and an optional `groupBy` for one-series-per-group.

### Group-by breakdown

```ts
const rows = await client.breakdown({
  measure: "p95",
  groupBy: "characterId",
  range: "last_7d",
});
// rows.rows: [{ group, value, sampleCount }, ...]
```

Default `limit` is 50 (max 500). Use it to answer "which slice of my traffic is the worst" — by character, processor, provider, model, app, experience.

### Session list and per-session timeline

```ts
const list = await client.sessions.list({
  range: "last_24h",
  sort: "slowest",
  limit: 25,
});
// list.sessions: per-session headline numbers (interaction count, p95, errors)
// list.nextCursor: opaque pagination token

// Next page:
const next = await client.sessions.list({
  range: "last_24h",
  sort: "slowest",
  cursor: list.nextCursor,
});

// Drill into one:
const detail = await client.sessions.get("s_8a31abcd1234");
// detail.events: ordered timeline of every metric emitted during the session
```

### Per-interaction trace

```ts
const trace = await client.interactions.get("int_8a31abcd1234");
// trace.spans: per-component timing (ASR, LLM, TTS, ...) with
//              provider/model attribution
// trace.failureStage: which component dropped the turn, if any
```

This is the "why was this turn slow / why did this turn fail" answer.

### Metrics catalog

```ts
const catalog = await client.catalog();
// catalog.metrics: metric names + dimensions + units + descriptions
//                  available at your plan tier
```

Lets an agent discover what's askable for *your* plan and tenant before it asks.

### Convenience facades

Pre-composed common questions on top of `breakdown` / `timeseries`:

```ts
// "which component contributed most to my p95?"
await client.latency.byComponent({ percentile: "p95", range: "last_24h" });

// "p95 latency over time"
await client.latency.overTime({ percentile: "p95", granularity: "hour" });

// "which TTS provider is slowest?"
await client.providers.compare({ component: "tts", percentile: "p95" });

// "errors by component, last day"
await client.errors.summary({ range: "last_24h" });
await client.errors.overTime({ granularity: "hour" });

// "sessions per character"
await client.usage.summary({ groupBy: "characterId" });
await client.usage.interactions({ groupBy: "experienceId" });
```

### Typed pre-flight errors

The SDK validates what it can before the request leaves. Agents driving this get actionable feedback instead of an opaque 4xx:

- `InvalidRangeError` — `range`, `baselineRange`, or `currentRange` token isn't one of the six accepted values. Carries the offending token and the valid set.
- `PlanRequiredError` / `PlanInsufficientError` — 402/403 from a plan-gated endpoint. Carries the required plan tier in the message.
- `RateLimitError` — 429 with `retryAfter` parsed from the `Retry-After` header.
- `NotYetSupportedError` — exported but unused as of v0.2. It returns if a future endpoint is announced ahead of being wired.

All subclass `ConvaiAnalyticsError`, so a single catch handles any of them.

### Three surfaces, one types contract

The TypeScript SDK, Python SDK, and CLI are all wired to every endpoint. Shapes match across languages — `p95EndToEndMs` in TS is `p95_end_to_end_ms` in Python; same numbers underneath. CI fails the build if the generated types in either language drift from `openapi/convai-analytics-api.json`.

---

## Next — v0.3

### Rolling-window regression detection — wider rollout

Already wired in v0.2 for `business`-tier callers:

```ts
const regressions = await client.regressionDetection({
  measure: "voice.user_to_bot_latency",
  baselineRange: "last_7d",
  currentRange: "last_24h",
  threshold: 0.15,
});
// regressions.rows: [{ group, baselineValue, currentValue,
//                     relativeChange, sampleCount, significant }]
```

For v0.3 we plan to broaden the supported `groupBy` set and `measure` vocabulary so any metric in the catalog can be regression-checked, not just the curated ones, plus surface a top-level `triggered: boolean` for ergonomics.

### Restricted query passthrough — wider rollout

Also wired in v0.2 for `business`-tier callers:

```ts
const result = await client.query({
  measures: ["SessionMetrics.uniqueSessions"],
  dimensions: ["SessionMetrics.characterId"],
  timeDimensions: [{ dimension: "SessionMetrics.eventTime", granularity: "day" }],
  limit: 100,
});
```

The currently-allowed measure / dimension / segment vocabulary lives behind `client.catalog()`. v0.3 will expand the allowed set as backend safety controls catch up.

### Absolute time ranges

Today every windowed endpoint takes one of the six relative-range tokens. v0.3 adds explicit `startTime` / `endTime` (ISO 8601, UTC) so you can query a fixed historical window.

---

## Later

These ship on their own cadence, once the surface beneath them is stable.

### Capability discovery

Once the catalog endpoint stabilizes, the SDK will lazy-fetch it on first call and gate facade methods on the metric names actually visible at the caller's plan and tenant. Agents will get a "this metric isn't queryable for you" error before the request goes out, with a concrete list of what *is* queryable.

### Metric vocabulary expansion

A larger set of measures (TTS audio bytes, knowledge-bank lookup latency, smart-turn confidence, dynamic-context churn, etc.) become first-class via `metricName` / `groupBy`, alongside the existing latency / volume / error / usage primitives.

---

## Tracking what's wired right now

- The endpoint catalog in [README.md](README.md) shows the current status of every endpoint. Treat it as authoritative for "is this wired today?"
- `openapi/convai-analytics-api.json` reflects exactly the endpoints the API exposes. A new endpoint shows up there → it's available in the next SDK release.
- If `client.someMethod()` raises `NotYetSupportedError`, the error tells you which release it lands in. Anything else is wired.
