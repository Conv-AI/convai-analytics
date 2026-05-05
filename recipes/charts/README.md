# Chart recipes

Runnable scripts that turn API responses into the standard chart formats.

| Recipe | Input | Output | Language |
|---|---|---|---|
| [latency_waterfall.ts](latency_waterfall.ts) | `--interaction <id>` | Horizontal waterfall of component spans | TypeScript |
| [p95_over_time.ts](p95_over_time.ts) | `--character-id <id>` `--range <r>` | Line chart with p95 over time | TypeScript |
| [component_breakdown.ts](component_breakdown.ts) | `--range <r>` | Stacked bar by processor | TypeScript |
| [session_timeline.py](session_timeline.py) | `--session <id>` | Event timeline (one row per metric) | Python |

## Conventions

- TypeScript recipes emit a [Vega-Lite](https://vega.github.io/vega-lite/) spec to stdout (or render to PNG with `--output`).
- Python recipes use [Plotly](https://plotly.com/python/) — `--output trace.html` for interactive, `--png trace.png` for static.
- Every recipe reads `CONVAI_API_KEY` (and optionally `CONVAI_ANALYTICS_BASE_URL`) from env.
- Self-contained — no shared utility module, agents can read one file and run it.

## Running

TypeScript:

```bash
export CONVAI_API_KEY=ck_live_...
npx tsx recipes/charts/latency_waterfall.ts --interaction int_8a31abcd1234 --output trace.png
```

Python:

```bash
uv run recipes/charts/session_timeline.py --session s_8a31abcd1234 --output timeline.html
```
