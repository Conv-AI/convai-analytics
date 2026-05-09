# Chart recipes — index

Runnable scripts in [`recipes/charts/`](../recipes/charts/) that turn API responses into the standard chart formats. Use them as references — agents can also read them and adapt.

## Available recipes

| Recipe | Input | Output | Language |
|---|---|---|---|
| [latency_waterfall.ts](../recipes/charts/latency_waterfall.ts) | `interactionId` | Horizontal waterfall of component spans | TypeScript |
| [p95_over_time.ts](../recipes/charts/p95_over_time.ts) | time range, optional filters | Line chart with p95 over time | TypeScript |
| [latency_percentile_band.ts](../recipes/charts/latency_percentile_band.ts) | time range, optional threshold | Line chart with p50/p95/p99 bands | TypeScript |
| [component_breakdown.ts](../recipes/charts/component_breakdown.ts) | time range, optional filters | Stacked bar by processor | TypeScript |
| [reliability_trends.ts](../recipes/charts/reliability_trends.ts) | time range | Error and reliability trend chart | TypeScript |
| [usage_trends.ts](../recipes/charts/usage_trends.ts) | time range, optional filters | Sessions, interactions, unique end users over time | TypeScript |
| [concurrency_estimate.ts](../recipes/charts/concurrency_estimate.ts) | time range, bucket size | Active-session / LiveKit-room pressure proxy | TypeScript |
| [session_timeline.py](../recipes/charts/session_timeline.py) | `sessionId` | Event timeline (one row per metric, time x-axis) | Python |

## Conventions

- TypeScript recipes use [Vega-Lite](https://vega.github.io/vega-lite/) specs by default — agents can render them inline (Claude Code, Cursor) or save to PNG via `vl-convert`.
- Python recipes use [Plotly](https://plotly.com/python/) — saves to HTML by default; pass `--png` to render via Kaleido.
- Every recipe accepts the same env vars as the SDK (`CONVAI_API_KEY`, `CONVAI_ANALYTICS_BASE_URL`).
- Every recipe is self-contained — no shared utility module — so agents can read one file and run it.
- Reliability charts should use error metrics (`metricNamePrefix: "error."`) and dropped-persistence metrics today. Do not render a live status distribution from `group_by=status` unless the returned rows contain real non-empty status groups.

## Adding a new recipe

If your analysis is reusable, add a recipe. Keep them:

- **Single-purpose** — one chart per file.
- **Self-contained** — no cross-recipe imports.
- **Parameterized** — take filter inputs as CLI args or function params, not hardcoded.
- **Documented** — top-of-file comment with the question it answers and the SDK calls it makes.
