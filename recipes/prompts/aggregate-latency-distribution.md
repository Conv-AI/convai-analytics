# Aggregate latency distribution

Show systemic latency behavior across historical traffic, not just one trace.

## The question

> We need aggregate P50/P95/P99 latency views for production-readiness sign-off. Show whether voice.user_to_bot_latency is stable over the last 7 or 30 days, and call out buckets where p95 or p99 crosses our threshold.

## Prompt to give the agent

```
Use my Convai API key and the convai-analytics SDK to chart aggregate
voice.user_to_bot_latency for the last 7 days. Show P50, P95, and P99 as
separate lines, include sample counts in tooltips, and add a threshold line at
3000 ms. Save the chart spec and summarize the worst buckets.
```

## What the agent should do

```ts
const [p50, p95, p99] = await Promise.all([
  client.timeseries({
    range: "last_7d",
    granularity: "hour",
    metricName: "voice.user_to_bot_latency",
    measure: "p50Value",
  }),
  client.timeseries({
    range: "last_7d",
    granularity: "hour",
    metricName: "voice.user_to_bot_latency",
    measure: "p95Value",
  }),
  client.timeseries({
    range: "last_7d",
    granularity: "hour",
    metricName: "voice.user_to_bot_latency",
    measure: "p99Value",
  }),
]);
```

Then render with `recipes/charts/latency_percentile_band.ts`. For example:

```bash
npx tsx recipes/charts/latency_percentile_band.ts \
  --range last_7d \
  --granularity hour \
  --p95-threshold-ms 3000
```

## Follow-up worth asking

> Break down the worst p95 buckets by model, voice provider, and character to find whether the regression is broad or isolated.

True binned histograms are not first-class in the public API yet. Until a histogram endpoint lands, this recipe uses percentile bands and optional hour/day heatmaps as the production-readiness proxy.
