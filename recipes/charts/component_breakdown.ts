/**
 * component_breakdown.ts
 *
 * Question: "Which processor contributes most to my p95 e2e latency?"
 *
 * Input:  --range <r>  --character-id <id> (optional)
 * Output: Vega-Lite horizontal bar chart spec to stdout
 *
 * Calls: client.latency.byComponent({ range, characterId, percentile: "p95" })
 */

import { ConvaiAnalytics, type RelativeRange } from "@convai/analytics";

interface Args {
  range: RelativeRange;
  characterId?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { range: "last_24h" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--range") args.range = argv[++i] as RelativeRange;
    else if (argv[i] === "--character-id") args.characterId = argv[++i];
  }
  return args;
}

async function main(): Promise<void> {
  const { range, characterId } = parseArgs(process.argv.slice(2));
  const client = new ConvaiAnalytics();
  const result = await client.latency.byComponent({
    range,
    characterId,
    percentile: "p95",
  });

  // Sort descending so the worst is on top.
  const rows = [...result.rows].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `p95 latency by component — ${range}${characterId ? ` (${characterId})` : ""}`,
    data: { values: rows },
    mark: "bar",
    encoding: {
      y: { field: "group", type: "nominal", sort: "-x", title: "Component" },
      x: { field: "value", type: "quantitative", title: "p95 (ms)" },
      tooltip: [
        { field: "group", title: "Component" },
        { field: "value", title: "p95 (ms)" },
        { field: "sampleCount", title: "Samples" },
      ],
    },
    width: 480,
    height: { step: 28 },
  };

  process.stdout.write(JSON.stringify(spec, null, 2) + "\n");
}

main().catch((err: Error) => {
  process.stderr.write(`error: ${err.message}\n`);
  process.exit(1);
});
