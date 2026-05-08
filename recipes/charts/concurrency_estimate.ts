/**
 * concurrency_estimate.ts
 *
 * Question: "Estimate concurrent active sessions / LiveKit room pressure over time."
 *
 * Input:  --range <r>  --bucket-minutes <n>
 * Output: Vega-Lite line chart spec to stdout
 *
 * Calls: client.sessions.list({ sort: "recent", limit: 100 }) and buckets session
 * start/end times locally. This is a customer-visible proxy until the API
 * exposes first-class stream/room concurrency metrics.
 */

import {
  ConvaiAnalytics,
  type RelativeRange,
  type SessionSummary,
} from "@convai/analytics";

interface Args {
  range: RelativeRange;
  bucketMinutes: number;
}

interface ConcurrencyRow {
  bucketStart: string;
  activeSessions: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { range: "last_24h", bucketMinutes: 5 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--range") args.range = argv[++i] as RelativeRange;
    else if (argv[i] === "--bucket-minutes") args.bucketMinutes = Number(argv[++i]);
  }
  return args;
}

function estimateConcurrency(
  sessions: SessionSummary[],
  bucketMinutes: number,
): ConcurrencyRow[] {
  const bucketMs = bucketMinutes * 60_000;
  const bounds = sessions.flatMap((session) => {
    if (!session.startTime) return [];
    const start = Date.parse(session.startTime);
    const end = session.endTime
      ? Date.parse(session.endTime)
      : start + Math.max(session.durationSec, bucketMinutes * 60) * 1000;
    return [start, end].filter(Number.isFinite);
  });
  if (bounds.length === 0) return [];

  const start = Math.floor(Math.min(...bounds) / bucketMs) * bucketMs;
  const end = Math.ceil(Math.max(...bounds) / bucketMs) * bucketMs;
  const rows: ConcurrencyRow[] = [];

  for (let bucket = start; bucket <= end; bucket += bucketMs) {
    const activeSessions = sessions.filter((session) => {
      if (!session.startTime) return false;
      const sessionStart = Date.parse(session.startTime);
      const sessionEnd = session.endTime
        ? Date.parse(session.endTime)
        : sessionStart + Math.max(session.durationSec, bucketMinutes * 60) * 1000;
      return sessionStart < bucket + bucketMs && sessionEnd > bucket;
    }).length;
    rows.push({ bucketStart: new Date(bucket).toISOString(), activeSessions });
  }

  return rows;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const client = new ConvaiAnalytics();
  const response = await client.sessions.list({
    range: args.range,
    sort: "recent",
    limit: 100,
  });
  const values = estimateConcurrency(response.sessions, args.bucketMinutes);

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Estimated active sessions / LiveKit room pressure - ${args.range}`,
    data: { values },
    mark: { type: "area", line: true, point: true, opacity: 0.35 },
    encoding: {
      x: { field: "bucketStart", type: "temporal", title: "Time" },
      y: { field: "activeSessions", type: "quantitative", title: "Active sessions" },
      tooltip: [
        { field: "bucketStart", type: "temporal", title: "Bucket" },
        { field: "activeSessions", title: "Active sessions" },
      ],
    },
    width: 760,
    height: 320,
  };

  process.stdout.write(JSON.stringify(spec, null, 2) + "\n");
}

main().catch((err: Error) => {
  process.stderr.write(`error: ${err.message}\n`);
  process.exit(1);
});
