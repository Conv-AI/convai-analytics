# Concepts

The Convai analytics data model. Read this before writing custom queries — it is the shared vocabulary between the SDK, the REST API, and the recipes.

## Object hierarchy

```
Account                    your billing/ownership boundary; resolved from your API key
  └── App (App Key)        an integration boundary — one per game/app/project
        └── Character      an AI character configuration
              └── Session  one continuous user↔character interaction
                    └── Interaction (Trace)   one logical pipeline invocation (a turn)
                          └── Component span  a timed segment within a trace (ASR, LLM, TTS, ...)
```

You can filter most queries by any level: `accountId` (implicit, from API key), `appKey`, `characterId`, `sessionId`, `interactionId`, plus optional dimensions like `experienceId` and `endUserId`.

## Account

Your Convai account. It is resolved server-side from the API key — you never pass account override fields explicitly. Every query is forcibly scoped to your account before any data is read.

## App / Project / App Key

The application-level integration boundary. One Convai account can have many app keys (e.g. one per game, or one per environment). The SDK accepts `appKey` as a filter on most endpoints.

## Character

The AI character configuration — system prompt, voice, knowledge bank attachments, etc. Identified by `characterId`. A single session is always with one character.

## Experience

A deployed integration — a game, world, or pixel-streamed/no-code experience. Identified by `experienceId`. Useful for product analytics ("how many minutes was experience X used this week?").

## Session

A continuous user↔character interaction. Bounded by connect/disconnect events. Identified by `sessionId`. Contains:

- start/end timestamps
- the character involved
- a list of interactions (turns)
- session-lifecycle events: connect, disconnect, reconnect, interruption, terminal

`GET /v1/analytics/sessions/{id}` returns the full per-session timeline of every metric emitted during the session.

## Interaction (Trace)

A single logical AI-processing unit. **Not just a user voice turn** — any meaningful pipeline invocation:

- user voice turn (ASR → LLM → TTS → Neurosync)
- user text turn (LLM → TTS → Neurosync)
- dynamic context update that triggers an LLM call
- forced response
- TTS-only generation
- Knowledge Bank call
- Memory call
- terminal event

Identified by `interactionId` (sometimes called `traceId` — same thing). `GET /v1/analytics/interactions/{id}` returns the full component waterfall + provider/model attribution + status + error codes for one interaction.

## Component span

A timed segment within an interaction. Each component span has:

- `processor` — `asr`, `llm`, `tts`, `neurosync`, `transport`, `knowledge_bank`, `memory`, `vad`, `stt`, ...
- `start`, `end`, `durationMs`
- `provider` / `model` (where applicable)
- `status` — `ok`, `error`, `timeout`, `cancelled`
- attributes (provider error code, prompt fingerprint, audio bytes, etc.)

Component spans are what `recipes/charts/latency_waterfall.ts` renders.

## Metric

The atomic unit of queryable telemetry. Each metric is identified by:

- `metric_name` — e.g. `voice.user_to_bot_latency`, `neurosync.turn_summary`, `llm.ttfb`, `tts.text_to_first_audio`, `stt.transcript_aggregation`, `vad.speech_confirmation_delay`
- `metric_type` — coarse categorization: `TTFBMetricsData`, `ProcessingMetricsData`, `NeuroSyncMetricsData`, `CustomLatencyMetricsData`, `UserBotLatencyMetricsData`, `LLMUsageMetricsData`, `TTSUsageMetricsData`, `SmartTurnMetricsData`
- `event_time` — timestamp
- account, character, session, and interaction identifiers
- `value` — numeric measurement (or null for count-only metrics)
- `tags` — structured metadata such as `provider`, `voice_provider`, and metric-specific attributes (p50/p95/p99/max for `*.turn_summary` metrics, etc.)

To discover what's queryable for your account: `client.catalog()` returns the metric names + types + units + descriptions visible at your plan tier.

See [metrics-reference.md](metrics-reference.md) for the full catalog.

## Time ranges

Most endpoints accept either:

- a relative range string: `last_15m`, `last_1h`, `last_24h`, `last_7d`, `last_30d`
- explicit `startTime` / `endTime` (ISO 8601, UTC)

Defaults vary by endpoint — see each SDK function's docstring. The default is `last_24h` for most queries.

## Aggregations

Where percentiles apply, all of `p50`, `p75`, `p90`, `p95`, `p99` are available; defaults are `[p50, p95, p99]`. Other aggregations: `count`, `sum`, `avg`, `min`, `max`, `unique`.

## Group-by dimensions

`GET /breakdown` accepts `groupBy` for any of:

- `processor` — ASR / LLM / TTS / Neurosync / etc.
- `provider` / `voiceProvider` — OpenAI, Anthropic, ElevenLabs, ...
- `model` — gpt-4o, claude-sonnet-4-7, ...
- `characterId`
- `sessionId`
- `interactionType`
- `status`
- `metricName`

## Why `breakdown` and not `errors-by-component` / `provider-comparison` / `usage-summary`?

The REST surface deliberately exposes a small set of composable endpoints rather than one endpoint per question. The SDK wraps the common compositions as named convenience methods (`client.errors.summary`, `client.providers.compare`, `client.usage.summary`, `client.latency.byComponent`) so agents get discoverability without the REST surface ballooning. Both layers refer to the same underlying data; the convenience methods are pure delegation. See the [TypeScript SDK source](../packages/typescript/src/resources/) for what each delegates to.
