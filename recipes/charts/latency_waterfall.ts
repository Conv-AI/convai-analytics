/**
 * latency_waterfall.ts
 *
 * Question: "Show me the component-by-component breakdown for one interaction."
 *
 * Input:  --interaction <id>  the interaction id to render
 * Output: Vega-Lite JSON spec to stdout (default), or a PNG to --output if given.
 *
 * Calls: client.interactions.get(interactionId)
 *
 * Run:
 *   npx tsx recipes/charts/latency_waterfall.ts --interaction int_8a31abcd1234
 *   npx tsx recipes/charts/latency_waterfall.ts --interaction int_8a31abcd1234 --output trace.png
 */

import { ConvaiAnalytics, type ComponentSpan } from "@convai/analytics";

interface Args {
  interaction: string;
  output?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--interaction") args.interaction = argv[++i];
    else if (argv[i] === "--output") args.output = argv[++i];
  }
  if (!args.interaction) {
    process.stderr.write("error: --interaction <id> is required\n");
    process.exit(2);
  }
  return args as Args;
}

function buildVegaSpec(
  interactionId: string,
  spans: ComponentSpan[],
): Record<string, unknown> {
  // Normalize start times to ms-since-trace-start so the waterfall is anchored at 0.
  // Drop spans without a usable start; backend marks `startTime` nullable for
  // metrics that don't have a true span start.
  const timed = spans.filter(
    (s): s is ComponentSpan & { startTime: string } =>
      typeof s.startTime === "string",
  );
  if (timed.length === 0) return { mark: "bar", data: { values: [] } };
  const t0 = Math.min(...timed.map((s) => Date.parse(s.startTime)));
  const data = timed.map((s) => ({
    processor: s.processor ?? "?",
    start: Date.parse(s.startTime) - t0,
    end: typeof s.endTime === "string" ? Date.parse(s.endTime) - t0 : null,
    durationMs: s.durationMs ?? 0,
    status: s.status ?? "ok",
    provider: s.provider ?? "",
  }));

  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Trace ${interactionId}`,
    data: { values: data },
    mark: "bar",
    encoding: {
      y: { field: "processor", type: "nominal", sort: "x", title: null },
      x: { field: "start", type: "quantitative", title: "ms since trace start" },
      x2: { field: "end" },
      color: {
        field: "status",
        type: "nominal",
        scale: {
          domain: ["ok", "error", "timeout", "cancelled"],
          range: ["#3b82f6", "#ef4444", "#f59e0b", "#9ca3af"],
        },
      },
      tooltip: [
        { field: "processor", title: "Component" },
        { field: "durationMs", title: "Duration (ms)" },
        { field: "provider", title: "Provider" },
        { field: "status", title: "Status" },
      ],
    },
    width: 720,
    height: { step: 28 },
  };
}

async function main(): Promise<void> {
  const { interaction, output } = parseArgs(process.argv.slice(2));
  const client = new ConvaiAnalytics();
  const trace = await client.interactions.get(interaction);
  const spec = buildVegaSpec(interaction, trace.spans);

  if (!output) {
    process.stdout.write(JSON.stringify(spec, null, 2) + "\n");
    return;
  }

  // Render to PNG via vl-convert (optional dep — install separately).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional dep
    const vlc = await import("vl-convert" as string);
    const png = await (vlc as { vegaLiteToPng: (s: unknown) => Promise<Buffer> })
      .vegaLiteToPng(spec);
    const fs = await import("node:fs/promises");
    await fs.writeFile(output, png);
    process.stderr.write(`wrote ${output}\n`);
  } catch (e) {
    process.stderr.write(
      `error: PNG output requires 'vl-convert' to be installed.\n` +
      `Install with: npm install vl-convert\n` +
      `Or omit --output to print the Vega-Lite JSON spec.\n` +
      `(${(e as Error).message})\n`,
    );
    process.exit(1);
  }
}

main().catch((err: Error) => {
  process.stderr.write(`error: ${err.message}\n`);
  process.exit(1);
});
