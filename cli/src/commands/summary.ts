import type { Command } from "commander";
import { ConvaiAnalytics } from "@convai/analytics";

export function registerSummary(program: Command): void {
  program
    .command("summary")
    .description("Top-level KPIs for an account / window.")
    .option("--range <range>", "Relative range: last_15m | last_1h | last_24h | last_7d | last_30d", "last_24h")
    .option("--character-id <id>", "Filter to one character")
    .option("--app-key <key>", "Filter to one app key")
    .option("--experience-id <id>", "Filter to one experience")
    .action(async function (this: Command, opts: Record<string, string | undefined>) {
      const root = this.parent!;
      const client = new ConvaiAnalytics({
        apiKey: root.opts().apiKey,
        baseUrl: root.opts().baseUrl,
      });
      const result = await client.summary({
        range: opts.range as "last_24h",
        characterId: opts.characterId,
        appKey: opts.appKey,
        experienceId: opts.experienceId,
      });
      printJson(result, root.opts().pretty);
    });
}

function printJson(value: unknown, pretty: boolean): void {
  process.stdout.write(JSON.stringify(value, null, pretty ? 2 : 0) + "\n");
}
