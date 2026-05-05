# convai-analytics

Agent-friendly client surface for the [Convai analytics API](https://analytics-api.convai.com/v1/analytics) — TypeScript SDK, Python SDK, CLI, prompt recipes, and chart recipes designed to be invoked from inside Claude Code, Codex, Cursor, or any coding agent.

> **Status:** v0.1. `summary` is wired and live; `timeseries`, `breakdown`, `sessions`, `interactions`, `metrics/catalog` land in API Phase 2; `regression-detection` and `query` in Phase 3. Methods that target unshipped endpoints raise a typed `NotYetSupportedError` pre-flight rather than firing a request that would 404. Track rollout in [`Conv-AI/convai-analytics-api`](https://github.com/Conv-AI/convai-analytics-api).

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

// Phase 2 (not yet wired — throws NotYetSupportedError today):
// const trace = await client.interactions.get("int_8a31...");
```

## Quickstart (programmatic, Python)

```python
import os
from convai_analytics import ConvaiAnalytics

client = ConvaiAnalytics(api_key=os.environ["CONVAI_API_KEY"])

summary = client.summary(range="last_24h")
print(f"Sessions: {summary.sessions}, p95 e2e: {summary.p95_end_to_end_ms}ms")

# Phase 2 (not yet wired — raises NotYetSupportedError today):
# trace = client.interactions.get("int_8a31...")
```

## Quickstart (CLI)

```bash
npx @convai/analytics-cli summary --range last_24h

# Phase 2 (not yet wired — exits with NotYetSupportedError today):
# npx @convai/analytics-cli interaction int_8a31... --json
# npx @convai/analytics-cli chart waterfall --interaction int_8a31... --output trace.png
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

| SDK call | REST endpoint | Min plan |
|---|---|---|
| `client.summary(...)` | `GET /v1/analytics/summary` | scale |
| `client.timeseries(...)` | `GET /v1/analytics/timeseries` | scale |
| `client.breakdown(...)` | `GET /v1/analytics/breakdown` | scale |
| `client.sessions.list(...)` | `GET /v1/analytics/sessions` | scale |
| `client.sessions.get(id)` | `GET /v1/analytics/sessions/{id}` | scale |
| `client.interactions.get(id)` | `GET /v1/analytics/interactions/{id}` | scale |
| `client.catalog()` | `GET /v1/analytics/metrics/catalog` | scale |
| `client.regressionDetection(...)` | `GET /v1/analytics/regression-detection` | business |
| `client.query(cubeQuery)` | `POST /v1/analytics/query` | business |

The SDK also exposes **convenience facades** (`client.latency.byComponent`, `client.providers.compare`, `client.errors.summary`, `client.usage.summary`) that delegate to `breakdown`/`timeseries` with sensible defaults — these are the agent-friendly entry points and the shapes that the future MCP server will mirror as named tools.

## Recipes

- **[Prompts](recipes/prompts/)** — drop-in natural-language prompts an agent can read to learn the common debugging workflows (e.g. [why-was-this-session-slow.md](recipes/prompts/why-was-this-session-slow.md)).
- **[Charts](recipes/charts/)** — runnable scripts that turn API responses into the standard chart formats (waterfall, p95-over-time, component breakdown, session timeline).

## Roadmap

- **v0 (this commit):** SDK skeleton + docs + recipes. Endpoints stubbed (see SDK source for `// TODO: wired in Phase 4` markers).
- **v0.1:** Wire SDKs to live `summary`, `timeseries`, `metrics/catalog` (Phase 4 of the backend).
- **v0.2:** Wire `breakdown`, `sessions`, `sessions/{id}`, `interactions/{id}` (Phase 5).
- **v1:** First public release. License flips to MIT/Apache-2.0 once contract is stable.
- **v1+:** MCP server (`@convai/analytics-mcp`) — thin adapter exposing each SDK function as a typed tool for Claude Desktop / Cursor / Goose. Tracked as Phase 7 of the backend plan.

See `docs/` for details.
