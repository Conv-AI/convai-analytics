# Component bottlenecks

Which processor drives p95?

## The question

> Across all my characters in the last 24 hours, which component is the largest contributor to p95 end-to-end latency?

## Prompt to give the agent

```
Use client.latency.byComponent to break down p95 e2e latency by processor
over the last 24 hours. Sort descending. Tell me the top three.
```

## What the agent should do

```ts
const breakdown = await client.latency.byComponent({
  range: "last_24h",
  percentile: "p95",
});
const sorted = [...breakdown.rows].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
console.table(sorted.slice(0, 3));
```

## Follow-up worth asking

> For the worst component, which provider/model is the laggard?

```ts
const worst = sorted[0]!.group;
const providers = await client.providers.compare({
  component: worst as "llm",
  range: "last_24h",
});
```
