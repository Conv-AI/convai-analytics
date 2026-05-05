# Error rate trends

Watch error rates over time and find which component / provider drives them.

## The question

> Show error rates over the last 24 hours, hourly. If anything spiked, tell me which component and provider.

## Prompt to give the agent

```
Plot error count over the last 24 hours, hourly. Then break errors down by
component and by provider. Highlight any spike > 2× the median bucket.
```

## What the agent should do

```ts
// Time series
const ts = await client.errors.overTime({ range: "last_24h", granularity: "hour" });

// Find spikes
const values = ts.points.map((p) => p.value ?? 0).sort((a, b) => a - b);
const median = values[Math.floor(values.length / 2)] ?? 0;
const spikes = ts.points.filter((p) => (p.value ?? 0) > 2 * median);

// Component + provider breakdowns
const byComponent = await client.errors.summary({ range: "last_24h", groupBy: "processor" });
const byProvider = await client.errors.summary({ range: "last_24h", groupBy: "provider" });
```

## Follow-up worth asking

> For the spike hour, which interactions failed? Pull a few traces.

Use `client.sessions.list({ range: "<spike-hour>", sort: "slowest" })` then `client.interactions.get(...)` on the worst few.
