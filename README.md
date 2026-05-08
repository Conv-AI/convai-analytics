# convai-analytics

Agent-friendly client surface for the [Convai analytics API](https://analytics-api.convai.com/v1/analytics) — TypeScript SDK, Python SDK, CLI, prompt recipes, and chart recipes designed to be invoked from inside Claude Code, Codex, Cursor, or any coding agent.

> **Status:** v0.2. The full v1 endpoint surface is wired: `summary`, `timeseries`, `breakdown`, `sessions.list`, `sessions.get`, `interactions.get`, `metrics/catalog`, `regression-detection`, and `query` all call live backend endpoints. Convenience facades (`latency`, `providers`, `errors`, `usage`) work end-to-end on top of the wired primitives. See [ROADMAP.md](ROADMAP.md) for what's next.

---

## What this is

You point a coding agent at this repo, set `CONVAI_API_KEY`, and ask things like:

> Why was session `s_8a31...` slow? Generate a waterfall.
>
> Compare TTS provider p95 across my characters over the last 7 days.
>
> Which characters had the most LLM errors yesterday?
>
> How many minutes was experience `exp_42` used this week?

The agent picks the right SDK call, our hosted analytics API runs the query against the [Cube](https://github.com/Conv-AI/cube) semantic layer (or escape-hatch BigQuery for the long tail), and you get back numbers + recipes for charts.

## What this is *not*

- **Not a BigQuery client.** This repo never connects to BQ. All queries route through `analytics-api.convai.com/v1/analytics/*`, which enforces tenant isolation, plan gating, and rate limits server-side.
- **Not a dashboard.** For the curated UI experience, see Convai Playground. This repo is the agent/SDK surface that the dashboard's "agent mode" will eventually share.
- **Not a write API.** Read-only. No mutations to characters, configs, or telemetry.

## Layout

```
convai-analytics/
├── docs/                       Concepts, auth, metrics reference, recipe index
├── openapi/                    Mirror of analytics-api.convai.com/v1/analytics/openapi.json
├── packages/
│   ├── typescript/             @convai/analytics — primary SDK
│   └── python/                 convai-analytics — Python SDK
├── cli/                        convai-analytics CLI
├── recipes/
│   ├── prompts/                Canned natural-language prompts agents/users can drop in
│   └── charts/                 Chart-generation recipes (TS + Python)
└── examples/                   Runnable end-to-end scripts
```

## Quickstart (agent mode)

```bash
git clone https://github.com/Conv-AI/convai-analytics
cd convai-analytics
export CONVAI_API_KEY=<your scale-tier-or-higher key>
claude            # or: codex, cursor, etc.
```

Then in the agent:

> Look at `docs/concepts.md` and `recipes/prompts/`. Why was session `<sid>` slow?

The agent reads the docs/recipes for context, calls the SDK, and renders the result.

## Quickstart (programmatic, TypeScript)

```ts
import { ConvaiAnalytics } from "@convai/analytics";

const client = new ConvaiAnalytics({ apiKey: process.env.CONVAI_API_KEY! });

const summary = await client.summary({ range: "last_24h" });
console.log(`Sessions: ${summary.sessions}, p95 e2e: ${summary.p95EndToEndMs}ms`);

const trace = await client.interactions.get("int_8a31...");
for (const span of trace.spans) {
  console.log(`${span.processor}: ${span.durationMs} ms`);
}
```

## Quickstart (programmatic, Python)

```python
import os
from convai_analytics import ConvaiAnalytics

client = ConvaiAnalytics(api_key=os.environ["CONVAI_API_KEY"])

summary = client.summary(range="last_24h")
print(f"Sessions: {summary.sessions}, p95 e2e: {summary.p95_end_to_end_ms}ms")

trace = client.interactions.get("int_8a31...")
for span in trace.spans:
    print(f"{span.processor}: {span.duration_ms} ms")
```

## Quickstart (CLI)

```bash
npx @convai/analytics-cli summary --range last_24h
npx @convai/analytics-cli interaction int_8a31... --json
npx @convai/analytics-cli chart waterfall --interaction int_8a31... --output trace.png
```

## Authentication & plan gating

Auth is the `CONVAI-API-KEY` header (same key as the rest of the Convai API). The analytics API is gated by plan:

| Plan | API access | Visibility tiers |
|---|---|---|
| free / starter | ❌ — UI dashboards only | PUBLIC |
| **scale** | ✅ basic + rate-limited | PUBLIC |
| **business** | ✅ + `regression-detection` + `query` passthrough | PUBLIC + ENTERPRISE |
| **enterprise** | ✅ + higher quotas, longer retention, SLA | PUBLIC + ENTERPRISE |

A 402 response means your plan doesn't include API access; a 403 means the specific endpoint requires a higher tier. See [docs/authentication.md](docs/authentication.md).

## Endpoint catalog (v1)

| SDK call | REST endpoint | Min plan | Status |
|---|---|---|---|
| `client.summary(...)` | `GET /v1/analytics/summary` | scale | live |
| `client.timeseries(...)` | `GET /v1/analytics/timeseries` | scale | live |
| `client.breakdown(...)` | `GET /v1/analytics/breakdown` | scale | live |
| `client.sessions.list(...)` | `GET /v1/analytics/sessions` | scale | live |
| `client.sessions.get(id)` | `GET /v1/analytics/sessions/{id}` | scale | live |
| `client.interactions.get(id)` | `GET /v1/analytics/interactions/{id}` | scale | live |
| `client.catalog()` | `GET /v1/analytics/metrics/catalog` | scale | live |
| `client.regressionDetection(...)` | `GET /v1/analytics/regression-detection` | business | live |
| `client.query(cubeQuery)` | `POST /v1/analytics/query` | business | live |

Plan-gated calls (`regressionDetection`, `query`) surface a typed `PlanRequiredError` (402) or `PlanInsufficientError` (403) when the caller's plan is below the required tier.

The SDK also exposes **convenience facades** (`client.latency.byComponent`, `client.latency.overTime`, `client.providers.compare`, `client.errors.summary`, `client.errors.overTime`, `client.usage.summary`, `client.usage.interactions`) that delegate to `breakdown`/`timeseries` with sensible defaults. These are the agent-friendly entry points and the shapes that the future MCP server will mirror as named tools.

## Recipes

- **[Prompts](recipes/prompts/)** — drop-in natural-language prompts an agent can read to learn the common debugging workflows (e.g. [why-was-this-session-slow.md](recipes/prompts/why-was-this-session-slow.md)).
- **[Charts](recipes/charts/)** — runnable scripts that turn API responses into the standard chart formats (waterfall, p95-over-time, component breakdown, session timeline).

## Roadmap

- **v0.1:** SDK + CLI + docs + recipes scaffold. Only `summary` was live; everything else raised `NotYetSupportedError`.
- **v0.2 (current):** Full v1 endpoint surface wired across both SDKs and the CLI. OpenAPI snapshot is the source of truth for response types.
- **v0.3:** Absolute time ranges (`startTime`/`endTime`), broader `regressionDetection` vocabulary, expanded `query` allowed-set.
- **v1:** First stable public release. License flips to MIT/Apache-2.0.
- **Later:** MCP server (`@convai/analytics-mcp`), capability discovery on top of `client.catalog()`, broader metric vocabulary.

See [ROADMAP.md](ROADMAP.md) and `docs/` for details.
