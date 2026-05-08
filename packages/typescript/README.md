# @convai/analytics

TypeScript SDK for the Convai analytics API.

```ts
import { ConvaiAnalytics } from "@convai/analytics";

const client = new ConvaiAnalytics({ apiKey: process.env.CONVAI_API_KEY! });

const summary = await client.summary({ range: "last_24h" });
const trace = await client.interactions.get("int_8a31...");
```

`CONVAI_API_KEY` is a bearer credential. Keep it server-side or in private agent workspaces; do not ship it in browser bundles, mobile apps, public repos, notebooks, screenshots, or logs.

See the [repo root](../../) for full docs, recipes, and examples.

## API surface

Direct REST mappings:
- `client.summary(params)` → `GET /v1/analytics/summary`
- `client.timeseries(params)` → `GET /v1/analytics/timeseries`
- `client.breakdown(params)` → `GET /v1/analytics/breakdown`
- `client.sessions.list(params)` → `GET /v1/analytics/sessions`
- `client.sessions.get(id)` → `GET /v1/analytics/sessions/{id}`
- `client.interactions.get(id)` → `GET /v1/analytics/interactions/{id}`
- `client.catalog()` → `GET /v1/analytics/metrics/catalog`
- `client.regressionDetection(params)` → `GET /v1/analytics/regression-detection` (business+)
- `client.query(cubeQuery)` → `POST /v1/analytics/query` (business+)

Convenience facades (delegate to the above with sensible defaults — agent-friendly):
- `client.latency.byComponent(...)` — p50/p95/p99 by processor
- `client.providers.compare(...)` — provider/model latency comparison
- `client.errors.summary(...)` — error counts by component/provider
- `client.usage.summary(...)` — sessions, audio minutes, end users

These convenience methods are pure delegation — they mirror the future MCP server tool definitions.
