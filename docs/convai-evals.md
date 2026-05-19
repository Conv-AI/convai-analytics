# Convai Evals Reports

[`Conv-AI/convai-evals`](https://github.com/Conv-AI/convai-evals) emits JSON-first reports for browser-backed Convai Character AI evals. Each row preserves backend identifiers when the Web SDK and backend expose them:

- `backend.session_id`: use with `client.sessions.get(...)`
- `backend.character_session_id`: use with `client.interactions.get(...)` when it is populated as an analytics interaction ID
- `backend.turn_id`: keep as an opaque turn-trace identifier for correlating with report-level traces
- `backend.character_id`: use as a filter for aggregate latency breakdowns

## Slow Row Drilldown

```ts
import { readFile } from "node:fs/promises";
import { ConvaiAnalytics } from "@convai/analytics";

const report = JSON.parse(await readFile("report.json", "utf8"));
const client = new ConvaiAnalytics({ apiKey: process.env.CONVAI_API_KEY });

const slowRows = report.per_row
  .filter((row) => row.latency?.end_to_end_ms != null)
  .sort((a, b) => b.latency.end_to_end_ms - a.latency.end_to_end_ms)
  .slice(0, 5);

for (const row of slowRows) {
  const sessionId = row.backend?.session_id;
  if (sessionId) {
    const session = await client.sessions.get(sessionId);
    console.log(row.test_id, session.events.length);
  }

  const interactionId = row.backend?.character_session_id;
  if (interactionId) {
    const trace = await client.interactions.get(interactionId);
    console.log(row.test_id, trace.totalDurationMs, trace.spans);
  }
}
```

## Aggregate Comparison

Use row-level reports to find regressions, then use analytics for broader context:

```ts
const characterId = report.run_metadata.characterId;

const componentP95 = await client.latency.byComponent({
  range: "last_24h",
  characterId,
});

const providerP95 = await client.breakdown({
  range: "last_24h",
  characterId,
  measure: "p95",
  groupBy: "provider",
  segment: "llmMetrics",
});

console.log({ componentP95, providerP95 });
```

Treat missing analytics data as non-fatal. An eval report is still useful for structure, transcript, SDK event, and local latency checks even when backend analytics has not ingested the session yet.
