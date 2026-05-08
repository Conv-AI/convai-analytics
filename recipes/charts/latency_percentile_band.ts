/**
 * latency_percentile_band.ts
 *
 * Question: "Show aggregate P50/P95/P99 latency over time for production sign-off."
 *
 * Input:  --range <r>  --character-id <id> (optional)  --granularity <hour|day>
 *         --p95-threshold-ms <n> (optional)
 * Output: Vega-Lite layered line chart spec to stdout
 *
 * Calls: client.timeseries({ measure: "p50Value" | "p95Value" | "p99Value",
 *                           metricName: "voice.user_to_bot_latency" })
 */

import {
  ConvaiAnalytics,
  type RelativeRange,
  type TimeseriesPoint,
  type TimeseriesResponse,
} from "@convai/analytics";

interface Args {
  range: RelativeRange;
  characterId?: string;
  granularity: "hour" | "day";
  p95ThresholdMs?: number;
}

interface ChartRow {
  bucketStart: string;
  percentile: "p50" | "p95" | "p99";
  value: number | null | undefined;
  sampleCount: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { range: "last_7d", granularity: "hour" };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--range") args.range = argv[++i] as RelativeRange;
    else if (flag === "--character-id") args.characterId = argv[++i];
    else if (flag === "--granularity") args.granularity = argv[++i] as "hour" | "day";
    else if (flag === "--p95-threshold-ms") args.p95ThresholdMs = Number(argv[++i]);
  }
  return args;
}

async function latencySeries(
  client: ConvaiAnalytics,
  args: Args,
  percentile: ChartRow["percentile"],
): Promise<TimeseriesResponse> {
  const measure = {
    p50: "p50Value",
    p95: "p95Value",
    p99: "p99Value",
  }[percentile];
  return client.timeseries({
    range: args.range,
    characterId: args.characterId,
    metricName: "voice.user_to_bot_latency",
    measure,
    granularity: args.granularity,
  });
}

function toRows(
  percentile: ChartRow["percentile"],
  response: TimeseriesResponse,
): ChartRow[] {
  return response.points.map((point: TimeseriesPoint) => ({
    bucketStart: point.bucketStart,
    percentile,
    value: point.value,
    sampleCount: response.meta.sampleCount,
  }));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const client = new ConvaiAnalytics();
  const [p50, p95, p99] = await Promise.all([
    latencySeries(client, args, "p50"),
    latencySeries(client, args, "p95"),
    latencySeries(client, args, "p99"),
  ]);

  const values = [
    ...toRows("p50", p50),
    ...toRows("p95", p95),
    ...toRows("p99", p99),
  ];
  const thresholdRows = args.p95ThresholdMs
    ? values.map((row) => ({ ...row, thresholdMs: args.p95ThresholdMs }))
    : [];

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Aggregate voice.user_to_bot_latency percentiles - ${args.range}${args.characterId ? ` (${args.characterId})` : ""}`,
    data: { values },
    layer: [
      {
        mark: { type: "line", point: true },
        encoding: {
          x: { field: "bucketStart", type: "temporal", title: "Time" },
          y: { field: "value", type: "quantitative", title: "Latency (ms)" },
          color: {
            field: "percentile",
            type: "nominal",
            sort: ["p50", "p95", "p99"],
            title: "Percentile",
          },
          tooltip: [
            { field: "bucketStart", type: "temporal", title: "Bucket" },
            { field: "percentile", title: "Percentile" },
            { field: "value", title: "Latency (ms)" },
            { field: "sampleCount", title: "Samples" },
          ],
        },
      },
      ...(args.p95ThresholdMs
        ? [
            {
              data: { values: thresholdRows },
              mark: { type: "rule", strokeDash: [6, 4], color: "#d62728" },
              encoding: {
                y: {
                  field: "thresholdMs",
                  type: "quantitative",
                  title: "Latency (ms)",
                },
              },
            },
          ]
        : []),
    ],
    width: 760,
    height: 360,
  };

  process.stdout.write(JSON.stringify(spec, null, 2) + "\n");
}

main().catch((err: Error) => {
  process.stderr.write(`error: ${err.message}\n`);
  process.exit(1);
});
