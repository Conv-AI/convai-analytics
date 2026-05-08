# Getting started

This page gets you from "I have a Convai API key" to "the agent answered my first question" in five minutes.

> **What works today (v0.2):** the full v1 endpoint surface — `summary`, `timeseries`, `breakdown`, `sessions.list/get`, `interactions.get`, `metrics/catalog`, `regressionDetection` (business plan), `query` (business plan), plus the `latency` / `providers` / `errors` / `usage` facades. See the [endpoint catalog](../README.md#endpoint-catalog-v1).

## Prerequisites

- A Convai API key on the **scale plan or higher**. Free / starter plans get UI dashboards but no API access — see [authentication.md](authentication.md) for the full plan matrix.
- One of: a coding agent (Claude Code, Codex, Cursor), Node.js 18+, or Python 3.10+.

## 1. Clone the repo

```bash
git clone https://github.com/Conv-AI/convai-analytics
cd convai-analytics
```

## 2. Set your API key

```bash
export CONVAI_API_KEY=ck_live_...
```

Optional: override the API base URL (defaults to `https://analytics-api.convai.com/v1/analytics`):

```bash
export CONVAI_ANALYTICS_BASE_URL=https://analytics-api-preview.convai.com/v1/analytics
```

## 3a. Use it from a coding agent (recommended)

```bash
claude       # or `codex`, `cursor`, etc.
```

Then ask the agent something like:

> Read `docs/concepts.md`. Find my slowest session in the last 24 hours, pull its full trace, and tell me which component took the longest in the worst interaction.

The agent will:
1. Read the docs to learn the data model + the available SDK calls.
2. Call `client.sessions.list({ range: "last_24h", sort: "slowest", limit: 5 })`.
3. For the worst session, call `client.sessions.get(sessionId)` to get the timeline.
4. Find the interaction with the highest `voice.user_to_bot_latency` and call `client.interactions.get(interactionId)` to see the per-component waterfall.
5. Read off the highest-`durationMs` span and explain the result.

## 3b. Use it programmatically (TypeScript)

```bash
cd packages/typescript
npm install
npm run build
```

```ts
import { ConvaiAnalytics } from "@convai/analytics";

const client = new ConvaiAnalytics({ apiKey: process.env.CONVAI_API_KEY! });

// Top-level KPIs
const summary = await client.summary({ range: "last_24h" });
console.log(`Sessions: ${summary.sessions}, p95 e2e: ${summary.p95EndToEndMs} ms`);

// p95 latency over time, hourly buckets
const series = await client.timeseries({
  measure: "p95",
  range: "last_24h",
  granularity: "hour",
  metricName: "voice.user_to_bot_latency",
});

// Find the slowest session, then pull its slowest interaction
const slowest = await client.sessions.list({ range: "last_24h", sort: "slowest", limit: 1 });
const session = await client.sessions.get(slowest.sessions[0]!.sessionId);
const worstTurn = session.events
  .filter((e) => e.metricName === "voice.user_to_bot_latency")
  .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
const trace = await client.interactions.get(worstTurn!.interactionId!);
for (const span of trace.spans) console.log(`${span.processor}: ${span.durationMs} ms`);
```

## 3c. Use it programmatically (Python)

```bash
cd packages/python
uv sync          # or: pip install -e .
```

```python
import os

from convai_analytics import ConvaiAnalytics

client = ConvaiAnalytics(api_key=os.environ["CONVAI_API_KEY"])

summary = client.summary(range="last_24h")
print(f"Sessions: {summary.sessions}, p95 e2e: {summary.p95_end_to_end_ms} ms")

series = client.timeseries(
    measure="p95",
    range="last_24h",
    granularity="hour",
    metric_name="voice.user_to_bot_latency",
)

slowest = client.sessions.list(range="last_24h", sort="slowest", limit=1)
session = client.sessions.get(slowest.sessions[0].session_id)
turns = sorted(
    (e for e in session.events if e.metric_name == "voice.user_to_bot_latency"),
    key=lambda e: e.value or 0,
    reverse=True,
)
trace = client.interactions.get(turns[0].interaction_id)
for span in trace.spans:
    print(f"{span.processor}: {span.duration_ms} ms")
```

## 3d. Use it from the CLI

```bash
cd cli && npm install && npm run build && npm link

convai-analytics summary --range last_24h
convai-analytics timeseries --measure p95 --range last_24h --granularity hour
convai-analytics sessions --range last_24h --sort slowest --limit 5
convai-analytics interaction int_8a31abcd1234 --json
convai-analytics chart waterfall --interaction int_8a31abcd1234 --output trace.png
```

## What's next

- **[concepts.md](concepts.md)** — what an account / app / character / session / interaction / metric actually is in the Convai data model. Read this before writing custom queries.
- **[metrics-reference.md](metrics-reference.md)** — the catalog of metric names you can filter and aggregate on.
- **[../recipes/prompts/](../recipes/prompts/)** — canned natural-language prompts for the most common debugging questions.
- **[../recipes/charts/](../recipes/charts/)** — runnable chart-generation recipes.

## Troubleshooting

- **`401 Unauthorized`** — `CONVAI_API_KEY` is missing or wrong. Double-check the key value (it should start with `ck_live_` or `ck_test_`).
- **`402 Payment Required`** — your plan doesn't include API access. Upgrade to scale or higher.
- **`403 Forbidden`** — your plan can't reach this specific endpoint (e.g. `regression-detection` requires business+).
- **`429 Too Many Requests`** — you hit the per-plan rate limit. The response includes `Retry-After`. See [authentication.md](authentication.md) for limits.
- **`InvalidRangeError`** — the `range` (or `baselineRange` / `currentRange`) you passed isn't one of `last_15m | last_1h | last_6h | last_24h | last_7d | last_30d`. Pre-flight; never reaches the wire.
- **`NotYetSupportedError`** — exported but unused as of v0.2; will return when a future endpoint is announced ahead of being wired.
