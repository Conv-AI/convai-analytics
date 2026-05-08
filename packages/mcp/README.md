# @convai/analytics-mcp

Local stdio MCP server for Convai Analytics.

This package lets MCP-capable agents answer Convai analytics questions without writing custom SDK scripts. It wraps the public `@convai/analytics` TypeScript SDK, uses `CONVAI_API_KEY`, and returns structured JSON plus Vega-Lite chart specs.

## Install And Run

```bash
export CONVAI_API_KEY="ck_live_your_key_here"
npx -y @convai/analytics-mcp
```

Optional:

```bash
export CONVAI_ANALYTICS_BASE_URL="https://analytics-api.convai.com/v1/analytics"
```

Leave `CONVAI_ANALYTICS_BASE_URL` unset for production. Do not put the API key in source code, committed MCP config, screenshots, or logs.

## Claude Desktop

```json
{
  "mcpServers": {
    "convai-analytics": {
      "command": "npx",
      "args": ["-y", "@convai/analytics-mcp"],
      "env": {
        "CONVAI_API_KEY": "ck_live_your_key_here"
      }
    }
  }
}
```

## Cursor / Codex-Compatible MCP Clients

Use the same stdio command:

```json
{
  "command": "npx",
  "args": ["-y", "@convai/analytics-mcp"],
  "env": {
    "CONVAI_API_KEY": "ck_live_your_key_here"
  }
}
```

## Security Model

The server is customer-facing and public-safe by design:

- It only calls the public Convai Analytics API through `@convai/analytics`.
- It does not accept `tenant_id`, `account_id`, service credentials, Cube secrets, database URLs, or BigQuery access.
- Account scoping, plan gating, and quota enforcement stay server-side in the hosted analytics API.
- Tool results are sanitized so errors do not echo `CONVAI_API_KEY`.

## Tools

Core and account tools:

- `get_summary`
- `get_metrics_catalog`
- `list_sessions`
- `get_session_timeline`
- `get_interaction_trace`

Latency tools:

- `get_p95_latency_over_time`
- `get_latency_percentile_series`
- `get_latency_percentile_chart`
- `get_latency_threshold_chart`
- `get_latency_heatmap_chart`
- `get_component_latency_breakdown`
- `generate_component_latency_chart`
- `find_component_latency_bottlenecks`
- `generate_interaction_waterfall`
- `explain_slow_session`

Reliability tools:

- `get_error_trend`
- `generate_error_trend_chart`
- `get_error_breakdown`
- `generate_error_breakdown_chart`
- `get_dropped_error_persist_trend`
- `generate_dropped_error_persist_chart`
- `generate_reliability_summary_chart`
- `generate_reliability_trends_chart`

Usage and concurrency tools:

- `get_usage_trends`
- `generate_usage_trends_chart`
- `get_character_usage_leaderboard`
- `generate_character_usage_chart`
- `generate_session_duration_scatter`
- `estimate_active_session_concurrency`
- `generate_active_session_concurrency_chart`
- `generate_peak_concurrency_chart`

Provider and model tools:

- `get_tts_provider_attribution`
- `generate_tts_provider_chart`
- `get_llm_model_latency`
- `generate_llm_model_latency_chart`
- `compare_providers`

Plan-gated advanced tools:

- `detect_regressions`
- `advanced_query`

Plan-gated tools return typed MCP tool errors for 402/403 responses with the required plan in the message.

## Prompts

The server exposes prompt templates for common customer questions:

- `why_was_this_session_slow`
- `aggregate_latency_distribution`
- `p95_latency_trend`
- `component_bottlenecks`
- `trace_explanation`
- `error_rate_trends`
- `provider_comparison`
- `usage_summary`

## Resources

- `convai://analytics/docs/concepts`
- `convai://analytics/docs/metrics-reference`
- `convai://analytics/docs/authentication`
- `convai://analytics/catalog`

The catalog resource fetches the caller's account catalog when `CONVAI_API_KEY` is available.

## Example Questions

```text
How many interactions and unique end users did I have in the last 30 days?
Break it down by character and generate a usage trend chart.
```

```text
Show aggregate P50/P95/P99 voice.user_to_bot_latency for production readiness sign-off.
Add a 3000 ms p95 threshold line and summarize the worst buckets.
```

```text
Explain why session s_123 was slow and generate an interaction waterfall if there is a traceable interaction.
```

```text
Show reliability trends, errors by component, and dropped error-persistence events.
```

```text
Estimate active session concurrency and show the peak concurrency chart.
```

## Local Development

From the repo root:

```bash
make mcp-install
make mcp-lint
make mcp-test
make mcp-build
make mcp-smoke
```

Live smoke against production with your own key:

```bash
export CONVAI_API_KEY="ck_live_your_key_here"
export CONVAI_ANALYTICS_BASE_URL="https://analytics-api.convai.com/v1/analytics"
export CONVAI_ANALYTICS_E2E_RANGE="last_30d"
cd packages/mcp
npm run e2e:prod
```

The live smoke accepts empty data for accounts without recent traffic and treats plan-gated 402/403 responses as valid gated results.
