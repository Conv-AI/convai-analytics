/**
 * reliability_trends.ts
 *
 * Question: "Show reliability signals over time: errors and dropped error-persist events."
 *
 * Input:  --range <r>  --granularity <hour|day>
 * Output: Vega-Lite multi-line chart spec to stdout
 *
 * Calls: client.errors.overTime(...) and client.timeseries(metricName="db.error_persist_dropped")
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
}

interface ChartRow {
  bucketStart: string;
  signal: "all error metrics" | "dropped error persistence";
  value: number | null | undefined;
  sampleCount: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { range: "last_7d", granularity: "day" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--range") args.range = argv[++i] as RelativeRange;
    else if (argv[i] === "--granularity") args.granularity = argv[++i] as "hour" | "day";
  }
  return args;
}

function toRows(signal: ChartRow["signal"], response: TimeseriesResponse): ChartRow[] {
  return response.points.map((point: TimeseriesPoint) => ({
    bucketStart: point.bucketStart,
    signal,
    value: point.value,
    sampleCount: response.meta.sampleCount,
  }));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const client = new ConvaiAnalytics();
  const [errors, dropped] = await Promise.all([
    client.errors.overTime({ range: args.range, granularity: args.granularity }),
    client.timeseries({
      range: args.range,
      granularity: args.granularity,
      measure: "count",
      metricName: "db.error_persist_dropped",
    }),
  ]);

  const values = [
    ...toRows("all error metrics", errors),
    ...toRows("dropped error persistence", dropped),
  ];

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Reliability signals - ${args.range}`,
    data: { values },
    mark: { type: "line", point: true },
    encoding: {
      x: { field: "bucketStart", type: "temporal", title: "Time" },
      y: { field: "value", type: "quantitative", title: "Events" },
      color: { field: "signal", type: "nominal", title: "Signal" },
      tooltip: [
        { field: "bucketStart", type: "temporal", title: "Bucket" },
        { field: "signal", title: "Signal" },
        { field: "value", title: "Events" },
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
