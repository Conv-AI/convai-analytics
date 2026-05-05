import type { Command } from "commander";

/**
 * `convai-analytics chart <kind> ...` — shells out to the canonical recipe
 * scripts in `recipes/charts/` rather than re-implementing chart logic in
 * the CLI. The recipes are the source of truth; the CLI is a discovery
 * surface.
 *
 * For now this is a stub that prints the recipe path the user should run.
 * Phase 2 wires in a chart runner that imports each recipe directly.
 */
export function registerChart(program: Command): void {
  program
    .command("chart <kind>")
    .description("Generate a chart. Kind: waterfall | p95-over-time | component-breakdown")
    .option("--interaction <id>", "Interaction id (for: waterfall)")
    .option("--session <id>", "Session id (for: session-timeline)")
    .option("--character-id <id>", "Character id (for: p95-over-time, component-breakdown)")
    .option("--range <range>", "Relative range", "last_24h")
    .option("--output <path>", "Output file (PNG or HTML depending on recipe)")
    .action((kind: string, _opts: Record<string, string | undefined>) => {
      const recipeMap: Record<string, string> = {
        waterfall: "recipes/charts/latency_waterfall.ts",
        "p95-over-time": "recipes/charts/p95_over_time.ts",
        "component-breakdown": "recipes/charts/component_breakdown.ts",
        "session-timeline": "recipes/charts/session_timeline.py",
      };
      const recipe = recipeMap[kind];
      if (!recipe) {
        process.stderr.write(
          `error: unknown chart kind '${kind}'. Available: ${Object.keys(recipeMap).join(", ")}\n`,
        );
        process.exit(2);
      }
      process.stdout.write(
        `Run the recipe directly:\n  npx tsx ${recipe} ...\n` +
          `(or for Python recipes: uv run ${recipe} ...)\n` +
          `\nSee ${recipe} for argument details.\n`,
      );
    });
}
