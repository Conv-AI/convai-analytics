/**
 * usage_trends.ts
 *
 * Question: "Show sessions, interactions, and unique end users over time."
 *
 * Input:  --range <r>  --granularity <hour|day>  --character-id <id> (optional)
 * Output: Vega-Lite multi-line chart spec to stdout
 *
 * Calls: client.timeseries({ measure: "uniqueSessions" | "uniqueTurns" | "uniqueEndUsers" })
 */

import {
  ConvaiAnalytics,
  type RelativeRange,
  type TimeseriesPoint,
  type TimeseriesResponse,
} from "@convai/analytics";

interface Args {
  range: RelativeRange;
  granularity: "hour" | "day";
  characterId?: string;
}

interface ChartRow {
  bucketStart: string;
  metric: "sessions" | "interactions" | "unique end users";
  value: number | null | undefined;
  sampleCount: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { range: "last_30d", granularity: "day" };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--range") args.range = argv[++i] as RelativeRange;
    else if (flag === "--granularity") args.granularity = argv[++i] as "hour" | "day";
    else if (flag === "--character-id") args.characterId = argv[++i];
  }
  return args;
}

async function usageSeries(
  client: ConvaiAnalytics,
  args: Args,
  measure: string,
): Promise<TimeseriesResponse> {
  return client.timeseries({
    range: args.range,
    characterId: args.characterId,
    measure,
    granularity: args.granularity,
  });
}

function toRows(
  metric: ChartRow["metric"],
  response: TimeseriesResponse,
): ChartRow[] {
  return response.points.map((point: TimeseriesPoint) => ({
    bucketStart: point.bucketStart,
    metric,
    value: point.value,
    sampleCount: response.meta.sampleCount,
  }));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const client = new ConvaiAnalytics();
  const [sessions, interactions, endUsers] = await Promise.all([
    usageSeries(client, args, "uniqueSessions"),
    usageSeries(client, args, "uniqueTurns"),
    usageSeries(client, args, "uniqueEndUsers"),
  ]);

  const values = [
    ...toRows("sessions", sessions),
    ...toRows("interactions", interactions),
    ...toRows("unique end users", endUsers),
  ];

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Usage trends - ${args.range}${args.characterId ? ` (${args.characterId})` : ""}`,
    data: { values },
    mark: { type: "line", point: true },
    encoding: {
      x: { field: "bucketStart", type: "temporal", title: "Time" },
      y: { field: "value", type: "quantitative", title: "Count" },
      color: { field: "metric", type: "nominal", title: "Metric" },
      tooltip: [
        { field: "bucketStart", type: "temporal", title: "Bucket" },
        { field: "metric", title: "Metric" },
        { field: "value", title: "Count" },
        { field: "sampleCount", title: "Samples" },
      ],
    },
    width: 760,
    height: 340,
  };

  process.stdout.write(JSON.stringify(spec, null, 2) + "\n");
}

main().catch((err: Error) => {
  process.stderr.write(`error: ${err.message}\n`);
  process.exit(1);
});
