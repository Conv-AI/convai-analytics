/**
 * p95_over_time.ts
 *
 * Question: "Show p95 end-to-end latency over time for character X."
 *
 * Input:  --character-id <id> (optional)  --range <last_24h|last_7d|...>
 * Output: Vega-Lite line chart spec to stdout
 *
 * Calls: client.latency.overTime({ characterId, range, percentile: "p95" })
 */

import { ConvaiAnalytics, type RelativeRange } from "@convai/analytics";

interface Args {
  characterId?: string;
  range: RelativeRange;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { range: "last_24h" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--character-id") args.characterId = argv[++i];
    else if (argv[i] === "--range") args.range = argv[++i] as RelativeRange;
  }
  return args;
}

async function main(): Promise<void> {
  const { characterId, range } = parseArgs(process.argv.slice(2));
  const client = new ConvaiAnalytics();
  const ts = await client.latency.overTime({
    characterId,
    range,
    percentile: "p95",
    granularity: "hour",
  });

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `p95 voice.user_to_bot_latency — ${range}${characterId ? ` (${characterId})` : ""}`,
    data: { values: ts.points },
    mark: { type: "line", point: true },
    encoding: {
      x: { field: "bucketStart", type: "temporal", title: "Time" },
      y: { field: "value", type: "quantitative", title: "p95 (ms)" },
      tooltip: [
        { field: "bucketStart", type: "temporal", title: "Bucket" },
        { field: "value", title: "p95 (ms)" },
      ],
    },
    width: 720,
    height: 320,
  };

  process.stdout.write(JSON.stringify(spec, null, 2) + "\n");
}

main().catch((err: Error) => {
  process.stderr.write(`error: ${err.message}\n`);
  process.exit(1);
});
