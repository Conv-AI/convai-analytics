/**
 * Smallest working example — pulls the top-level account KPIs.
 *
 * Run:
 *   export CONVAI_API_KEY=ck_live_...
 *   npx tsx examples/node/account-summary.ts            # last 24h
 *   npx tsx examples/node/account-summary.ts last_7d    # last 7 days
 *   npx tsx examples/node/account-summary.ts last_24h <character_id>
 */

import { ConvaiAnalytics } from "@convai/analytics";

type Range = "last_15m" | "last_1h" | "last_6h" | "last_24h" | "last_7d" | "last_30d";

async function main(): Promise<void> {
  const range = (process.argv[2] ?? "last_24h") as Range;
  const characterId = process.argv[3];

  const client = new ConvaiAnalytics();
  const summary = await client.summary({ range, characterId });

  const scope = characterId ? `character ${characterId}` : "the whole account";
  console.log(`Summary for ${scope} over ${range}:`);
  console.log(`  Sessions:       ${summary.sessions.toLocaleString()}`);
  console.log(`  End users:      ${summary.uniqueEndUsers.toLocaleString()}`);
  console.log(`  Interactions:   ${summary.interactions.toLocaleString()}`);
  console.log(`  Errors:         ${summary.errorCount.toLocaleString()}`);
  console.log(`  p50 end-to-end: ${summary.p50EndToEndMs} ms`);
  console.log(`  p95 end-to-end: ${summary.p95EndToEndMs} ms`);
  console.log(`  p99 end-to-end: ${summary.p99EndToEndMs} ms`);
  console.log(
    `\n(window: ${summary.meta.effectiveRange.startTime} → ${summary.meta.effectiveRange.endTime}; ` +
      `cache_hit=${summary.meta.cacheHit ?? false})`,
  );
}

main().catch((err: Error) => {
  process.stderr.write(`error: ${err.message}\n`);
  process.exit(1);
});
