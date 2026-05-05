import type { Command } from "commander";
import { ConvaiAnalytics } from "@convai/analytics";

export function registerSessions(program: Command): void {
  const sessions = program
    .command("session")
    .description("Look up a single session timeline by id.")
    .argument("<id>", "Session id")
    .action(async function (this: Command, id: string) {
      const root = this.parent!;
      const client = new ConvaiAnalytics({
        apiKey: root.opts().apiKey,
        baseUrl: root.opts().baseUrl,
      });
      const result = await client.sessions.get(id);
      process.stdout.write(JSON.stringify(result, null, root.opts().pretty ? 2 : 0) + "\n");
    });

  program
    .command("sessions")
    .description("List sessions in a time window.")
    .option("--range <range>", "Relative range", "last_24h")
    .option("--character-id <id>", "Filter to one character")
    .option("--sort <sort>", "recent | longest | slowest", "recent")
    .option("--limit <n>", "Max sessions to return", "20")
    .action(async function (this: Command, opts: Record<string, string | undefined>) {
      const root = this.parent!;
      const client = new ConvaiAnalytics({
        apiKey: root.opts().apiKey,
        baseUrl: root.opts().baseUrl,
      });
      const result = await client.sessions.list({
        range: opts.range as "last_24h",
        characterId: opts.characterId,
        sort: opts.sort as "recent",
        limit: opts.limit ? Number(opts.limit) : undefined,
      });
      process.stdout.write(JSON.stringify(result, null, root.opts().pretty ? 2 : 0) + "\n");
    });

  // Silence unused-binding lint
  void sessions;
}
