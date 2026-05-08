# Provider comparison

Compare LLM or TTS providers head-to-head on your traffic.

## The question

> For my traffic over the last 7 days, which LLM provider has the lowest p95 TTFB? Which TTS provider has the lowest text-to-first-audio?

## Prompt to give the agent

```
Compare LLM provider p95 latency for the last 7 days. Then compare TTS
provider p95 latency for the same window. Output as two tables.
```

## What the agent should do

```ts
const llm = await client.providers.compare({
  component: "llm",
  range: "last_7d",
  percentile: "p95",
});

const tts = await client.providers.compare({
  component: "tts",
  range: "last_7d",
  percentile: "p95",
});
```

## Follow-up worth asking

> Did latency change after the most recent provider switch?

For business+ customers: `client.regressionDetection({ baselineRange: "last_7d", currentRange: "last_24h", measure: "p95Value" })` with `groupBy: "provider"` to flag the deltas.
