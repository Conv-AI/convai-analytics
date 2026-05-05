# Trace explanation

Explain a single interaction in plain English.

## The question

> Explain what happened in interaction `int_8a31...`. Was it interrupted? Which provider/model handled the LLM and TTS?

## Prompt to give the agent

```
Pull interaction int_8a31abcd1234 and summarize: total duration, terminal
status, per-component latency, providers used, and any errors. Keep it
under 8 lines.
```

## What the agent should do

```ts
const trace = await client.interactions.get("int_8a31abcd1234");
const lines = [
  `Interaction ${trace.interactionId}: ${trace.interactionType}, ${trace.totalDurationMs} ms total, ${trace.terminalStatus}`,
  ...trace.spans.map(
    (s) => `  ${s.processor.padEnd(15)} ${String(s.durationMs).padStart(5)} ms` +
           (s.provider ? `  [${s.provider}/${s.model ?? ""}]` : "") +
           (s.errorCode ? `  ERROR: ${s.errorCode}` : ""),
  ),
];
console.log(lines.join("\n"));
```

## Follow-up worth asking

> Generate a waterfall chart for this trace.

```bash
npx tsx recipes/charts/latency_waterfall.ts --interaction int_8a31abcd1234 --output trace.png
```
