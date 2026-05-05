# Getting started

This page gets you from "I have a Convai API key" to "the agent answered my first question" in five minutes.

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

Optional: override the API base URL (defaults to `https://api.convai.com/v1/analytics`):

```bash
export CONVAI_ANALYTICS_BASE_URL=https://api-preview.convai.com/v1/analytics
```

## 3a. Use it from a coding agent (recommended)

```bash
claude       # or `codex`, `cursor`, etc.
```

Then ask the agent something like:

> Read `docs/concepts.md` and `recipes/prompts/`. Then look at session `s_8a31abcd1234` and tell me which component contributed most to its p95 end-to-end latency over the last hour. Generate a waterfall chart for the slowest interaction.

The agent will:
1. Read the docs to learn the data model + available SDK calls.
2. Call `client.sessions.get("s_8a31abcd1234")` to pull the session timeline.
3. Find the slowest interaction, call `client.interactions.get(...)` to get the trace.
4. Use `recipes/charts/latency_waterfall.ts` to render the chart.

## 3b. Use it programmatically (TypeScript)

```bash
cd packages/typescript
npm install
npm run build
```

```ts
import { ConvaiAnalytics } from "@convai/analytics";

const client = new ConvaiAnalytics({ apiKey: process.env.CONVAI_API_KEY! });

// Top-level KPIs over the last 24 hours
const summary = await client.summary({ range: "last_24h" });
console.log(`Sessions: ${summary.sessions}`);
console.log(`p95 end-to-end: ${summary.p95EndToEndMs} ms`);

// One trace
const trace = await client.interactions.get("int_8a31abcd1234");
for (const span of trace.spans) {
  console.log(`${span.processor.padEnd(15)} ${span.durationMs} ms`);
}
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
print(f"Sessions: {summary.sessions}")
print(f"p95 end-to-end: {summary.p95_end_to_end_ms} ms")

trace = client.interactions.get("int_8a31abcd1234")
for span in trace.spans:
    print(f"{span.processor:<15} {span.duration_ms} ms")
```

## 3d. Use it from the CLI

```bash
cd cli && npm install && npm run build && npm link

convai-analytics summary --range last_24h
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
