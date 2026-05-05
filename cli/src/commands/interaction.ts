import type { Command } from "commander";
import { ConvaiAnalytics } from "@convai/analytics";

export function registerInteraction(program: Command): void {
  program
    .command("interaction")
    .description("Look up a single interaction (trace) by id.")
    .argument("<id>", "Interaction id")
    .action(async function (this: Command, id: string) {
      const root = this.parent!;
      const client = new ConvaiAnalytics({
        apiKey: root.opts().apiKey,
        baseUrl: root.opts().baseUrl,
      });
      const trace = await client.interactions.get(id);
      process.stdout.write(JSON.stringify(trace, null, root.opts().pretty ? 2 : 0) + "\n");
    });
}
