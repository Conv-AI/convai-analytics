# Metrics reference

The Convai telemetry pipeline emits 40+ named metrics across 8 metric types. This page is a non-authoritative human-readable index — for the live, plan-scoped catalog, call:

```ts
const catalog = await client.catalog();
```

```python
catalog = client.catalog()
```

`client.catalog()` returns only the metrics visible at your plan tier (e.g. scale-tier customers see `PUBLIC`-visibility metrics; business+ adds `ENTERPRISE`).

## Metric types

| Metric type | What it covers |
|---|---|
| `TTFBMetricsData` | Time-to-first-byte for upstream provider calls (LLM, TTS). |
| `ProcessingMetricsData` | Internal processing stages (transcript aggregation, prompt build, response filtering). |
| `NeuroSyncMetricsData` | Neurosync animation pipeline — frame rates, blendshape counts, audio gating. |
| `CustomLatencyMetricsData` | Ad-hoc latency points instrumented per-feature. |
| `UserBotLatencyMetricsData` | End-to-end user → bot latency (the `voice.user_to_bot_latency` headline metric). |
| `LLMUsageMetricsData` | Token counts, model identity, prompt fingerprint. |
| `TTSUsageMetricsData` | Audio bytes, voice provider, voice ID. |
| `SmartTurnMetricsData` | Turn-segmentation decisions (smart-turn endpointing). |

## Headline metrics

The metrics that show up in 90% of customer queries.

| Metric name | Type | Visibility | Meaning |
|---|---|---|---|
| `voice.user_to_bot_latency` | `UserBotLatencyMetricsData` | PUBLIC | End-to-end latency from user-utterance-end to first-bot-audio-byte. **The number to watch.** |
| `neurosync.turn_summary` | `NeuroSyncMetricsData` | PUBLIC | Per-turn animation pipeline summary (p50/p95/p99/max in tags). |
| `llm.ttfb` | `TTFBMetricsData` | PUBLIC | Time-to-first-byte from the LLM provider. |
| `tts.text_to_first_audio` | `TTFBMetricsData` | PUBLIC | TTS provider time-to-first-audio. |
| `stt.transcript_aggregation` | `ProcessingMetricsData` | PUBLIC | STT transcript assembly latency. |
| `vad.speech_confirmation_delay` | `ProcessingMetricsData` | PUBLIC | VAD confirmation delay. |
| `llm.prompt.fingerprint` | `LLMUsageMetricsData` | PUBLIC | Prompt-cache fingerprint (for cache-hit analysis). |

## Errors & lifecycle

| Metric name | Type | Visibility | Meaning |
|---|---|---|---|
| `error.provider` | `ProcessingMetricsData` | PUBLIC | Provider-side error (rate limit, timeout, etc.). |
| `error.terminal` | `ProcessingMetricsData` | PUBLIC | Session-terminating error. |
| `session.connect` / `session.disconnect` / `session.reconnect` | `ProcessingMetricsData` | PUBLIC | Session lifecycle events. |
| `interaction.interrupted` / `interaction.cancelled` | `ProcessingMetricsData` | PUBLIC | Turn-lifecycle non-success terminals. |

For aggregate reliability charts today, prefer `client.errors.overTime(...)`, `client.errors.summary(...)`, and `metricNamePrefix: "error."`. The `status` group-by dimension is reserved for status-tagged telemetry; if it returns only an empty group, show a no-data state instead of demo ok/error/timeout/cancelled values.

## Per-processor breakdown

When `groupBy=processor` is used in `client.breakdown(...)`, processor values are:

`asr`, `vad`, `stt`, `llm`, `knowledge_bank`, `memory`, `tts`, `neurosync`, `transport`, `dynamic_context`, `moderation`, `emotion`

## Filtering tips for agents

- **"latency for character X"** → filter `characterId`, segment `endToEndTurnLatency` (= `metric_name = 'voice.user_to_bot_latency'`).
- **"why was session Y slow?"** → `client.sessions.get(sessionId)` returns the full timeline; sort spans by `durationMs`.
- **"what's my LLM provider mix?"** → `client.breakdown({ groupBy: "provider", segment: "llmMetrics" })`.
- **"errors over time"** → `client.timeseries({ measure: "count", metricNamePrefix: "error." })`.
- **"audio minutes used by experience"** → `client.usage.summary({ groupBy: "experienceId" })`.
- **"usage by character name"** → `client.usage.summary({ groupBy: "characterId" })` returns stable character IDs today; map names separately until character-name enrichment lands.

The catalog endpoint also returns `units` and `description` for every metric — agents should fall back to that when picking which metric to query.
