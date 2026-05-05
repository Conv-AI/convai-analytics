import type { Command } from "commander";
import { ConvaiAnalytics } from "@convai/analytics";

export function registerTimeseries(program: Command): void {
  program
    .command("timeseries")
    .description("Time series for any measure × granularity.")
    .requiredOption("--measure <name>", "Cube measure name, e.g. turnP95, count, avgValue")
    .option("--metric-name <name>", "Filter to one metric_name (e.g. voice.user_to_bot_latency)")
    .option("--granularity <g>", "minute | hour | day", "hour")
    .option("--range <range>", "Relative range", "last_24h")
    .option("--character-id <id>", "Filter to one character")
    .option("--group-by <dim>", "Optional group-by dimension")
    .action(async function (this: Command, opts: Record<string, string | undefined>) {
      const root = this.parent!;
      const client = new ConvaiAnalytics({
        apiKey: root.opts().apiKey,
        baseUrl: root.opts().baseUrl,
      });
      const result = await client.timeseries({
        measure: opts.measure!,
        metricName: opts.metricName,
        granularity: opts.granularity as "hour",
        range: opts.range as "last_24h",
        characterId: opts.characterId,
        groupBy: opts.groupBy,
      });
      process.stdout.write(JSON.stringify(result, null, root.opts().pretty ? 2 : 0) + "\n");
    });
}
