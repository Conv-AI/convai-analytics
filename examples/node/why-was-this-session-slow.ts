/**
 * End-to-end implementation of recipes/prompts/why-was-this-session-slow.md.
 *
 * Pulls a session, finds the slowest interaction by user-to-bot latency,
 * fetches its component waterfall, and reports the bottleneck.
 *
 * Run:
 *   export CONVAI_API_KEY=ck_live_...
 *   npx tsx examples/node/why-was-this-session-slow.ts s_8a31abcd1234
 */

import { ConvaiAnalytics } from "@convai/analytics";

async function main(): Promise<void> {
  const sessionId = process.argv[2];
  if (!sessionId) {
    process.stderr.write("usage: why-was-this-session-slow.ts <sessionId>\n");
    process.exit(2);
  }

  const client = new ConvaiAnalytics();

  // 1. Pull the session timeline.
  const session = await client.sessions.get(sessionId);
  console.log(`Session ${sessionId}: ${session.events.length} events`);

  // 2. Find the worst interaction by voice.user_to_bot_latency.
  const turns = session.events
    .filter((e) => e.metricName === "voice.user_to_bot_latency")
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const worst = turns[0];
  if (!worst?.interactionId) {
    console.log("No user_to_bot_latency turns found. Was this a text-only or empty session?");
    return;
  }
  console.log(`Worst turn: ${worst.interactionId} (${worst.value} ms)`);

  // 3. Pull the full trace.
  const trace = await client.interactions.get(worst.interactionId);

  // 4. Identify the bottleneck (excluding network/transport).
  const bottleneck = trace.spans
    .filter((s) => s.processor !== "transport")
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))[0];

  if (!bottleneck) {
    console.log("Trace has no actionable component spans.");
    return;
  }

  const provider = bottleneck.provider
    ? `, provider=${bottleneck.provider}/${bottleneck.model ?? ""}`
    : "";
  console.log(
    `\nBottleneck: ${bottleneck.processor ?? "?"} (${bottleneck.durationMs ?? 0} ms${provider})`,
  );
  console.log(`Status: ${trace.terminalStatus ?? "?"}`);

  // 5. Print the full waterfall as a quick text report.
  console.log("\nFull waterfall:");
  for (const s of trace.spans) {
    const label = (s.processor ?? "?").padEnd(15);
    const ms = String(s.durationMs ?? 0).padStart(5);
    const tags = s.provider ? `[${s.provider}/${s.model ?? ""}]` : "";
    const err = s.errorCode ? `  ERROR ${s.errorCode}` : "";
    console.log(`  ${label} ${ms} ms ${tags}${err}`);
  }

  console.log(
    `\nFor a chart: npx tsx recipes/charts/latency_waterfall.ts --interaction ${worst.interactionId} --output trace.png`,
  );
}

main().catch((err: Error) => {
  process.stderr.write(`error: ${err.message}\n`);
  process.exit(1);
});
