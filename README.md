# convai-analytics

Agentic analytics for Convai applications.

This repository lets MCP-capable agents, coding agents, and developers answer questions about Convai session telemetry using only a Convai API key. The recommended path is the published local MCP server, [`@convai/analytics-mcp`](https://www.npmjs.com/package/@convai/analytics-mcp), which plugs into Claude Desktop, Cursor, Codex-compatible MCP clients, and other stdio MCP hosts so agents can call typed analytics tools instead of writing custom scripts.

For developers who want direct programmatic access, the repo also includes TypeScript, Python, and CLI clients that use the same public Analytics API.

Ask questions like:

> How many interactions did my characters have in the last 7 days?
>
> How many unique end users used each character this month?
>
> Show aggregate P50/P95/P99 latency over time for production readiness sign-off.
>
> Explain why this interaction was slow and generate a waterfall chart.
>
> Which processor, provider, model, or character is driving latency or errors?

The SDK calls Convai's hosted analytics API at `https://analytics-api.convai.com/v1/analytics`. The API resolves your API key server-side, scopes every query to your account, enforces plan and quota limits, and returns agent-friendly JSON that can be summarized, charted, or used in scripts.

> **Status:** v0.2. The full v1 endpoint surface is wired: `summary`, `timeseries`, `breakdown`, `sessions.list`, `sessions.get`, `interactions.get`, `metrics/catalog`, `regression-detection`, and `query`. Convenience facades (`latency`, `providers`, `errors`, `usage`) work end to end on top of those primitives.

## What This Is

- **A local MCP server** in `packages/mcp` that exposes the main analytics questions as typed agent tools.
- **A TypeScript SDK** in `packages/typescript`.
- **A Python SDK** in `packages/python`.
- **A CLI** in `cli`.
- **Prompt recipes** in `recipes/prompts` that tell an AI agent exactly which calls to make for common analytics questions.
- **Chart recipes** in `recipes/charts` that generate Vega-Lite specs or Plotly timelines for latency, usage, reliability, and concurrency analysis.
- **Convai Evals integration notes** in [`docs/convai-evals.md`](docs/convai-evals.md) for using `convai-evals` report IDs with sessions, interactions, and latency breakdown APIs.

## What This Is Not

- **Not a client-side browser SDK.** Your Convai API key is a bearer secret. Do not put it in browser JavaScript, mobile apps, public notebooks, screenshots, logs, or committed config files.
- **Not a direct data-store client.** All reads go through Convai's hosted Analytics API with server-side account scoping, plan checks, and quota enforcement.
- **Not a write API.** It only reads analytics data. It does not mutate characters, sessions, configs, or telemetry.
- **Not a replacement for the Convai dashboard.** It is the programmable and agent-friendly surface for deeper analysis, automation, and chart generation.

## Repository Layout

```text
convai-analytics/
├── docs/                       Concepts, auth, metrics reference, prompt/chart indexes
├── openapi/                    Snapshot of the analytics API contract
├── packages/
│   ├── typescript/             @convai/analytics SDK
│   ├── mcp/                    @convai/analytics-mcp local stdio server
│   └── python/                 convai-analytics SDK
├── cli/                        convai-analytics command line interface
├── recipes/
│   ├── prompts/                Natural-language prompt templates for AI agents
│   └── charts/                 Runnable chart-generation scripts
└── examples/                   Runnable end-to-end examples
```

## Prerequisites

- Node.js 18+ for the TypeScript SDK, CLI, examples, and chart recipes.
- Python 3.10+ and `uv` for the Python SDK examples.
- A Convai API key for the account whose analytics you want to query.

Get your key from the same Convai account you use for the rest of the Convai API, then export it in your shell:

```bash
export CONVAI_API_KEY="ck_live_your_key_here"
```

The SDK reads `CONVAI_API_KEY` automatically. You normally do **not** need to set a base URL; production is the default.

## Recommended: MCP From A Fresh Client

For agent workflows, start here:

```bash
export CONVAI_API_KEY="ck_live_your_key_here"
npx -y @convai/analytics-mcp@latest
```

The server is also listed in the Official MCP Registry as [`io.github.Conv-AI/convai-analytics-mcp`](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.Conv-AI%2Fconvai-analytics-mcp). If your MCP client supports registry discovery, use that registry entry; otherwise configure the `npx` command above. Once connected, ask normal analytics questions:

After adding or changing MCP config, restart Claude Desktop, Claude Code, Cursor, Codex, or your MCP host so it reloads the server command and `CONVAI_API_KEY`.

```text
Show aggregate P50/P95/P99 latency for the last 30 days and generate a chart.
```

```text
Which component is driving p95 latency, and which sessions should I inspect?
```

```text
Show usage trends, unique end users, active-session concurrency, and provider/model latency charts.
```

See [packages/mcp/README.md](packages/mcp/README.md) for client setup snippets.

## Developer SDK Path From A Fresh Clone

```bash
git clone https://github.com/Conv-AI/convai-analytics.git
cd convai-analytics
export CONVAI_API_KEY="ck_live_your_key_here"

# Install TypeScript SDK + CLI dependencies.
make ts-install

# Optional but useful: verify the SDK and CLI compile.
make ts-build
make ts-test
```

Run the smallest working example:

```bash
packages/typescript/node_modules/.bin/tsx \
  --tsconfig tsconfig.recipes.json \
  examples/node/account-summary.ts last_7d
```

Expected result: a short account summary with sessions, end users, interactions, errors, and latency percentiles for your own account.

## Use With A Coding Agent

If your agent does not support MCP, open this repo in Codex, Claude Code, Cursor, or a similar coding agent. Give the agent this instruction:

```text
Use this repository and my CONVAI_API_KEY environment variable to answer analytics questions.
First read README.md, docs/concepts.md, docs/metrics-reference.md, and recipes/prompts/README.md.
Prefer MCP when available; otherwise use the SDK or recipes. Do not ask for direct data-store access.
Keep the API key private and do not print it.
```

Then ask normal product questions:

```text
How many interactions and unique end users did I have in the last 30 days?
Break it down by character and generate a usage trend chart.
```

```text
Show aggregate P50/P95/P99 voice.user_to_bot_latency for the last 7 days.
Add a 3000 ms p95 threshold line and summarize the worst buckets.
```

```text
List recent slow sessions, choose one with traceable interaction spans,
explain the bottleneck, and generate a waterfall chart.
```

The agent should use `recipes/prompts` for the call sequence and `recipes/charts` for chart generation.

## MCP Server

The fastest path for MCP-capable agents is [`@convai/analytics-mcp`](https://www.npmjs.com/package/@convai/analytics-mcp). It is a published local stdio MCP server that wraps only the public TypeScript SDK. It reads `CONVAI_API_KEY`, optionally reads `CONVAI_ANALYTICS_BASE_URL`, and never accepts account overrides, service credentials, database URLs, or other internal access paths.

Run it directly:

```bash
export CONVAI_API_KEY="ck_live_your_key_here"
npx -y @convai/analytics-mcp@latest
```

Official MCP Registry name: [`io.github.Conv-AI/convai-analytics-mcp`](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.Conv-AI%2Fconvai-analytics-mcp)

Claude Desktop example:

```json
{
  "mcpServers": {
    "convai-analytics": {
      "command": "npx",
      "args": ["-y", "@convai/analytics-mcp@latest"],
      "env": {
        "CONVAI_API_KEY": "ck_live_your_key_here"
      }
    }
  }
}
```

After saving this config, quit and reopen Claude Desktop so it starts the new MCP server. Claude Code, Cursor, Codex-compatible clients, and other stdio MCP hosts can use the same command/env shape; restart the client or start a new session after adding or changing MCP config. Once connected, ask questions like:

```text
Show aggregate P50/P95/P99 latency for the last 30 days and generate a chart.
```

```text
Which component is driving p95 latency, and which sessions should I inspect?
```

```text
Show usage trends, unique end users, active-session concurrency, and provider/model latency charts.
```

The MCP server returns structured JSON for data tools and Vega-Lite JSON specs for chart tools. It does not write files; your MCP client can decide whether to render, save, or summarize the returned artifacts.

Local development:

```bash
make mcp-install
make mcp-lint
make mcp-test
make mcp-build
make mcp-smoke
```

See [`packages/mcp/README.md`](packages/mcp/README.md) for the full tool list, prompt list, resources, and live smoke command. See [`docs/publishing.md`](docs/publishing.md) and [`docs/mcp-distribution.md`](docs/mcp-distribution.md) for release, registry, and marketplace publishing notes.

## TypeScript SDK

When using the repository directly:

```bash
make ts-install
packages/typescript/node_modules/.bin/tsx --tsconfig tsconfig.recipes.json examples/node/account-summary.ts last_24h
```

When using the package from your own Node project:

```bash
npm install @convai/analytics
```

```ts
import { ConvaiAnalytics } from "@convai/analytics";

const client = new ConvaiAnalytics({
  apiKey: process.env.CONVAI_API_KEY,
});

const summary = await client.summary({ range: "last_7d" });
console.log({
  sessions: summary.sessions,
  interactions: summary.interactions,
  uniqueEndUsers: summary.uniqueEndUsers,
  p95EndToEndMs: summary.p95EndToEndMs,
});
```

Find sessions to inspect:

```ts
const sessions = await client.sessions.list({
  range: "last_7d",
  sort: "slowest",
  limit: 10,
});

console.table(
  sessions.sessions.map((s) => ({
    sessionId: s.sessionId,
    interactions: s.interactionCount,
    p95EndToEndMs: s.p95EndToEndMs,
    startTime: s.startTime,
  })),
);
```

Inspect one interaction:

```ts
const trace = await client.interactions.get("interaction_id_here");

for (const span of trace.spans) {
  console.log(
    `${span.processor ?? "unknown"} ${span.durationMs ?? 0}ms` +
      (span.provider ? ` provider=${span.provider}` : ""),
  );
}
```

## Python SDK

From this repository:

```bash
cd packages/python
uv sync
uv run python - <<'PY'
from convai_analytics import ConvaiAnalytics

client = ConvaiAnalytics()
summary = client.summary(range="last_7d")
print({
    "sessions": summary.sessions,
    "interactions": summary.interactions,
    "unique_end_users": summary.unique_end_users,
    "p95_end_to_end_ms": summary.p95_end_to_end_ms,
})
PY
```

From your own Python project:

```bash
# Use this once the package is available in your Python package registry.
pip install convai-analytics
```

```python
from convai_analytics import ConvaiAnalytics

client = ConvaiAnalytics()  # reads CONVAI_API_KEY
sessions = client.sessions.list(range="last_7d", sort="slowest", limit=5)

for session in sessions.sessions:
    print(session.session_id, session.interaction_count, session.p95_end_to_end_ms)
```

## CLI

Build the local CLI:

```bash
make ts-install
make ts-build
```

Run common queries:

```bash
npx -y @convai/analytics-cli summary --range last_7d --pretty

node cli/dist/index.js summary --range last_7d --pretty

node cli/dist/index.js timeseries \
  --measure p95Value \
  --metric-name voice.user_to_bot_latency \
  --granularity day \
  --range last_30d \
  --pretty

node cli/dist/index.js sessions \
  --range last_7d \
  --sort slowest \
  --limit 5 \
  --pretty

node cli/dist/index.js interaction interaction_id_here --pretty
```

Use `--api-key` only for local one-off testing. Prefer `CONVAI_API_KEY` so the key does not end up in shell history:

```bash
CONVAI_API_KEY="ck_live_your_key_here" node cli/dist/index.js summary --range last_24h
```

## Example Questions And Commands

All commands below assume:

```bash
export CONVAI_API_KEY="ck_live_your_key_here"
make ts-install
make ts-build
```

### 1. Account Usage Summary

Question:

```text
How many sessions, interactions, unique end users, and errors did I have in the last 7 days?
```

Command:

```bash
packages/typescript/node_modules/.bin/tsx \
  --tsconfig tsconfig.recipes.json \
  examples/node/account-summary.ts last_7d
```

### 2. Aggregate Latency Percentiles

Question:

```text
Show aggregate P50/P95/P99 latency over time for production-readiness sign-off.
```

Command:

```bash
packages/typescript/node_modules/.bin/tsx \
  --tsconfig tsconfig.recipes.json \
  recipes/charts/latency_percentile_band.ts \
  --range last_7d \
  --granularity hour \
  --p95-threshold-ms 3000 \
  > latency-percentiles.vl.json
```

### 3. P95 Latency Trend

Question:

```text
Show p95 end-to-end latency over time, optionally filtered to one character.
```

Command:

```bash
packages/typescript/node_modules/.bin/tsx \
  --tsconfig tsconfig.recipes.json \
  recipes/charts/p95_over_time.ts \
  --range last_7d \
  > p95-over-time.vl.json
```

Add `--character-id your_character_id` to focus on one character.

### 4. Component Bottlenecks

Question:

```text
Which processor contributes most to p95 latency?
```

Command:

```bash
packages/typescript/node_modules/.bin/tsx \
  --tsconfig tsconfig.recipes.json \
  recipes/charts/component_breakdown.ts \
  --range last_7d \
  > component-bottlenecks.vl.json
```

### 5. Slow Session Drilldown

First find a session:

```bash
node cli/dist/index.js sessions --range last_7d --sort slowest --limit 5 --pretty
```

Then diagnose it:

```bash
packages/typescript/node_modules/.bin/tsx \
  --tsconfig tsconfig.recipes.json \
  examples/node/why-was-this-session-slow.ts session_id_here
```

### 6. Interaction Waterfall

Question:

```text
Show the latency breakdown of this specific interaction id.
```

Command:

```bash
packages/typescript/node_modules/.bin/tsx \
  --tsconfig tsconfig.recipes.json \
  recipes/charts/latency_waterfall.ts \
  --interaction interaction_id_here \
  > interaction-waterfall.vl.json
```

### 7. Reliability Trends

Question:

```text
Show errors and dropped error-persistence events over time.
```

Command:

```bash
packages/typescript/node_modules/.bin/tsx \
  --tsconfig tsconfig.recipes.json \
  recipes/charts/reliability_trends.ts \
  --range last_7d \
  --granularity day \
  > reliability-trends.vl.json
```

### 8. Usage Trends

Question:

```text
Show sessions, interactions, and unique end users over time.
```

Command:

```bash
packages/typescript/node_modules/.bin/tsx \
  --tsconfig tsconfig.recipes.json \
  recipes/charts/usage_trends.ts \
  --range last_30d \
  --granularity day \
  > usage-trends.vl.json
```

### 9. Active Session / LiveKit Room Pressure

Question:

```text
Estimate concurrent active sessions over time.
```

Command:

```bash
packages/typescript/node_modules/.bin/tsx \
  --tsconfig tsconfig.recipes.json \
  recipes/charts/concurrency_estimate.ts \
  --range last_7d \
  --bucket-minutes 5 \
  > active-session-concurrency.vl.json
```

This is a proxy derived from session start/end windows until first-class stream concurrency metrics are exposed.

### 10. Provider Comparison

Question:

```text
Compare LLM or TTS provider latency and reliability.
```

Agent prompt:

```text
Read recipes/prompts/provider-comparison.md and compare LLM and TTS providers for the last 7 days.
Return a table with provider/model, p95 latency, sample count, and any reliability caveats.
```

### 11. Regression Detection

Question:

```text
Did latency regress compared with the previous window?
```

Business-tier and above:

```ts
const regressions = await client.regressionDetection({
  baselineRange: "last_7d",
  currentRange: "last_24h",
  measure: "p95Value",
  groupBy: "processor",
});
```

Lower plans should expect a typed `PlanInsufficientError` for this endpoint.

## Prompt Recipes

The prompt recipes are the best starting point for agents:

| Recipe | Use it when you want to know |
|---|---|
| [`why-was-this-session-slow.md`](recipes/prompts/why-was-this-session-slow.md) | why a session felt slow and which interaction/component caused it |
| [`aggregate-latency-distribution.md`](recipes/prompts/aggregate-latency-distribution.md) | P50/P95/P99 latency bands for systemic trend analysis |
| [`p95-latency-trend.md`](recipes/prompts/p95-latency-trend.md) | p95 latency over time for an account or character |
| [`component-bottlenecks.md`](recipes/prompts/component-bottlenecks.md) | which processor contributes most to p95 |
| [`trace-explanation.md`](recipes/prompts/trace-explanation.md) | what happened in one interaction id |
| [`error-rate-trends.md`](recipes/prompts/error-rate-trends.md) | errors over time and by component/provider |
| [`provider-comparison.md`](recipes/prompts/provider-comparison.md) | provider/model latency comparisons |
| [`usage-summary.md`](recipes/prompts/usage-summary.md) | sessions, interactions, and unique users by character or experience |

## Chart Recipes

Most chart recipes print a Vega-Lite JSON spec to stdout. You can save that spec, render it in a notebook, hand it to an agent, or convert it to PNG with a Vega-Lite renderer.

| Script | Output |
|---|---|
| [`latency_percentile_band.ts`](recipes/charts/latency_percentile_band.ts) | P50/P95/P99 line chart, optional p95 threshold |
| [`p95_over_time.ts`](recipes/charts/p95_over_time.ts) | p95 latency trend |
| [`component_breakdown.ts`](recipes/charts/component_breakdown.ts) | p95 latency by processor |
| [`latency_waterfall.ts`](recipes/charts/latency_waterfall.ts) | per-interaction waterfall |
| [`reliability_trends.ts`](recipes/charts/reliability_trends.ts) | errors and dropped persistence events |
| [`usage_trends.ts`](recipes/charts/usage_trends.ts) | sessions, interactions, unique end users |
| [`concurrency_estimate.ts`](recipes/charts/concurrency_estimate.ts) | active-session concurrency proxy |
| [`session_timeline.py`](recipes/charts/session_timeline.py) | session event timeline |

## Authentication, Isolation, And Plans

Every request sends `CONVAI-API-KEY` to the hosted analytics API. The API key resolves server-side to one Convai account. The client cannot choose or override account scope.

| Plan | API access | Notes |
|---|---|---|
| free / starter | yes, limited monthly quota | basic endpoints |
| scale | yes, higher quota | basic endpoints |
| business | yes | adds `regression-detection` and restricted `query` |
| enterprise | yes | higher quotas / retention according to contract |

Common auth and plan errors:

| Status | Meaning |
|---|---|
| 401 | missing or invalid API key |
| 402 | plan required for analytics API access |
| 403 | endpoint requires a higher plan |
| 429 | rate limit or monthly analytics quota exceeded |

See [`docs/authentication.md`](docs/authentication.md) for details.

## Endpoint Catalog

| SDK call | REST endpoint | Notes |
|---|---|---|
| `client.summary(...)` | `GET /v1/analytics/summary` | headline account KPIs |
| `client.timeseries(...)` | `GET /v1/analytics/timeseries` | metric over time |
| `client.breakdown(...)` | `GET /v1/analytics/breakdown` | grouped breakdowns |
| `client.sessions.list(...)` | `GET /v1/analytics/sessions` | session inventory |
| `client.sessions.get(id)` | `GET /v1/analytics/sessions/{id}` | session timeline |
| `client.interactions.get(id)` | `GET /v1/analytics/interactions/{id}` | trace / component spans |
| `client.catalog()` | `GET /v1/analytics/metrics/catalog` | queryable metric definitions |
| `client.regressionDetection(...)` | `GET /v1/analytics/regression-detection` | business+ |
| `client.query(cubeQuery)` | `POST /v1/analytics/query` | restricted advanced query, business+ |

Convenience facades:

- `client.latency.byComponent(...)`
- `client.latency.overTime(...)`
- `client.providers.compare(...)`
- `client.errors.summary(...)`
- `client.errors.overTime(...)`
- `client.usage.summary(...)`
- `client.usage.interactions(...)`

## SDK And REST Parameter Names

Use camelCase in the TypeScript SDK and MCP prompts. The SDK translates request keys and common measure/group values at the HTTP boundary:

```ts
await client.timeseries({
  measure: "uniqueSessions",
  groupBy: "characterId",
  range: "last_30d",
});
```

If you call the REST API directly, use snake_case query keys and canonical snake_case values:

```bash
curl -H "CONVAI-API-KEY: $CONVAI_API_KEY" \
  "https://analytics-api.convai.com/v1/analytics/timeseries?range=last_30d&measure=unique_sessions&group_by=character_id"

curl -H "CONVAI-API-KEY: $CONVAI_API_KEY" \
  "https://analytics-api.convai.com/v1/analytics/breakdown?range=last_30d&measure=unique_sessions&group_by=character_id"
```

The public API accepts common SDK-style aliases for compatibility, but documentation uses the canonical REST form so scripts, dashboards, and agents have one stable wire format.

Status breakdowns (`group_by=status`) require telemetry rows that include status metadata. If a status breakdown returns only an empty group or no rows, treat it as a no-data state rather than rendering demo values. Character usage breakdowns currently return stable character IDs; display-name enrichment is planned as a backward-compatible addition.

## Development Commands

```bash
make ts-install          # install TypeScript SDK + CLI deps
make ts-build            # build TypeScript SDK + CLI
make ts-test             # run TypeScript unit tests
make ts-lint             # ESLint + TypeScript typecheck
make ts-typecheck-recipes # typecheck examples and chart recipes
make package-check       # verify npm package archives exclude node_modules

make py-install          # install Python SDK dev env
make py-test             # run Python tests
make py-lint             # ruff + mypy

make check-openapi       # compare committed OpenAPI snapshot with live API
make gen-types           # regenerate generated SDK types from OpenAPI snapshot
```

Live E2E test, if you have an API key with data:

```bash
CONVAI_ANALYTICS_E2E_RANGE=last_30d \
CONVAI_ANALYTICS_E2E_DELAY_MS=6500 \
make e2e-stg
```

Despite the target name, `e2e-stg` defaults to staging. To run against production:

```bash
CONVAI_ANALYTICS_BASE_URL=https://analytics-api.convai.com/v1/analytics \
CONVAI_ANALYTICS_E2E_RANGE=last_30d \
CONVAI_ANALYTICS_E2E_DELAY_MS=6500 \
make e2e-stg
```

## More Documentation

- [`docs/getting-started.md`](docs/getting-started.md)
- [`docs/concepts.md`](docs/concepts.md)
- [`docs/metrics-reference.md`](docs/metrics-reference.md)
- [`docs/prompts.md`](docs/prompts.md)
- [`docs/charts.md`](docs/charts.md)
- [`ROADMAP.md`](ROADMAP.md)
