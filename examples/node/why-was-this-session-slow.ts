/**
 * End-to-end implementation of recipes/prompts/why-was-this-session-slow.md.
 *
 * STATUS: requires API Phase 2 (sessions + interactions endpoints). Today
 * the script catches `NotYetSupportedError` and exits with a clear message.
 * For a working smoke example, see `account-summary.ts`.
 *
 * Run (once Phase 2 lands):
 *   export CONVAI_API_KEY=ck_live_...
 *   npx tsx examples/node/why-was-this-session-slow.ts s_8a31abcd1234
 */

import { ConvaiAnalytics, NotYetSupportedError } from "@convai/analytics";

async function main(): Promise<void> {
  const sessionId = process.argv[2];
  if (!sessionId) {
    process.stderr.write("usage: why-was-this-session-slow.ts <sessionId>\n");
    process.exit(2);
  }

  const client = new ConvaiAnalytics();

  // Step 1 — pull the session timeline.
  const session = await client.sessions.get(sessionId);
  console.log(`Session ${sessionId}: ${session.events.length} events`);

  // Step 2 — find the worst interaction by voice.user_to_bot_latency.
  const turns = session.events
    .filter((e) => e.metricName === "voice.user_to_bot_latency")
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const worst = turns[0];
  if (!worst?.interactionId) {
    console.log("No user_to_bot_latency turns found. Was this a text-only or empty session?");
    return;
  }
  console.log(`Worst turn: ${worst.interactionId} (${worst.value} ms)`);

  // Step 3 — pull the full trace.
  const trace = await client.interactions.get(worst.interactionId);

  // Step 4 — identify the bottleneck (excluding network/transport).
  const bottleneck = trace.spans
    .filter((s) => s.processor !== "transport")
    .sort((a, b) => b.durationMs - a.durationMs)[0];

  if (!bottleneck) {
    console.log("Trace has no actionable component spans.");
    return;
  }

  console.log(
    `\nBottleneck: ${bottleneck.processor} (${bottleneck.durationMs} ms` +
      (bottleneck.provider ? `, provider=${bottleneck.provider}/${bottleneck.model ?? ""}` : "") +
      `)`,
  );
  console.log(`Status: ${trace.terminalStatus}`);

  // Step 5 — print the full waterfall as a quick text report.
  console.log("\nFull waterfall:");
  for (const s of trace.spans) {
    console.log(
      `  ${s.processor.padEnd(15)} ${String(s.durationMs).padStart(5)} ms ${
        s.provider ? `[${s.provider}/${s.model ?? ""}]` : ""
      }${s.errorCode ? `  ERROR ${s.errorCode}` : ""}`,
    );
  }

  console.log(
    `\nFor a chart: npx tsx recipes/charts/latency_waterfall.ts --interaction ${worst.interactionId} --output trace.png`,
  );
}

main().catch((err: Error) => {
  process.stderr.write(`error: ${err.message}\n`);
  process.exit(1);
});
