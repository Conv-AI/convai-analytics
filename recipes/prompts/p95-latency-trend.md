# P95 latency trend

Track end-to-end latency over time. The first chart most teams want.

## The question

> Show p95 end-to-end latency for character `chr_warrior` over the last 7 days, hourly.

## Prompt to give the agent

```
Plot p95 voice.user_to_bot_latency for character chr_warrior over the last
7 days, hourly. Save as p95_trend.png.
```

## What the agent should do

```ts
const ts = await client.latency.overTime({
  characterId: "chr_warrior",
  range: "last_7d",
  granularity: "hour",
  percentiles: ["p95"],
});
```

Then render with `recipes/charts/p95_over_time.ts`.

## Follow-up worth asking

> Compare this week to the previous week to see if there's a regression.

For business-tier customers, `client.regressionDetection({ baselineRange: "last_7d", currentRange: "last_24h", measure: "turnP95" })` returns the largest deltas with significance flags.
