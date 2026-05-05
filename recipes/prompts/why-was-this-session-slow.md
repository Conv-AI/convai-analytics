# Why was this session slow?

The single most common debugging question. End-to-end walkthrough.

## The question

> Session `s_8a31...` felt slow to my user. Which interaction was the worst, and which component (LLM, TTS, Neurosync, ...) caused it?

## Prompt to give the agent

```
Read recipes/prompts/why-was-this-session-slow.md and apply it to session
s_8a31abcd1234. Walk me through your reasoning, and produce a waterfall
chart for the slowest interaction.
```

## What the agent should do

Step 1 — pull the full session timeline.

```ts
const session = await client.sessions.get("s_8a31abcd1234");
```

This returns every metric emitted during the session, ordered by `eventTime`. Each row has an `interactionId` (when it belongs to a turn) and a `processor`.

Step 2 — find the slowest interaction. The `voice.user_to_bot_latency` metric (one row per turn) is the headline — sort interactions by its value descending and pick the worst one.

```ts
const turns = session.events.filter(
  (e) => e.metricName === "voice.user_to_bot_latency",
);
turns.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
const worstInteractionId = turns[0]?.interactionId;
```

Step 3 — pull the full trace for that interaction.

```ts
const trace = await client.interactions.get(worstInteractionId!);
```

`trace.spans` is the component waterfall — every processor's start/end/duration in order.

Step 4 — identify the bottleneck. Sort spans by `durationMs` descending. The first one (excluding `transport`, which is usually network and not actionable) is the bottleneck.

```ts
const bottleneck = trace.spans
  .filter((s) => s.processor !== "transport")
  .sort((a, b) => b.durationMs - a.durationMs)[0];

console.log(
  `Worst interaction: ${trace.interactionId}\n` +
  `Total: ${trace.totalDurationMs} ms\n` +
  `Bottleneck: ${bottleneck.processor} (${bottleneck.durationMs} ms, provider=${bottleneck.provider ?? "n/a"})`,
);
```

Step 5 — render the waterfall.

```bash
npx tsx recipes/charts/latency_waterfall.ts \
  --interaction "$worstInteractionId" \
  --output worst.png
```

Or in Python:

```python
session = client.sessions.get("s_8a31abcd1234")
turns = sorted(
    [e for e in session.events if e.metric_name == "voice.user_to_bot_latency"],
    key=lambda e: e.value or 0,
    reverse=True,
)
worst = turns[0]
trace = client.interactions.get(worst.interaction_id)
bottleneck = max(
    (s for s in trace.spans if s.processor != "transport"),
    key=lambda s: s.duration_ms,
)
print(f"Bottleneck: {bottleneck.processor} ({bottleneck.duration_ms}ms)")
```

## Follow-up worth asking

> Is this character / provider / model regularly slow, or was this an outlier?

Use `client.latency.byComponent({ characterId: trace.characterId, range: "last_7d" })` to see if the bottleneck component is consistently high — if so, it's not just one bad turn.

If the bottleneck is `llm`, also check `client.providers.compare({ component: "llm", characterId: trace.characterId })` to see whether switching providers would help.

If the bottleneck is `tts`, similarly: `client.providers.compare({ component: "tts", characterId: trace.characterId })`.
