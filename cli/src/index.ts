#!/usr/bin/env node
/**
 * convai-analytics CLI entrypoint.
 *
 * Subcommands map 1:1 to SDK calls; output is JSON by default (pipe-friendly)
 * with a `--pretty` flag for human reading. Exit codes are non-zero on any
 * SDK error so the CLI composes cleanly in shell scripts.
 */

import { Command } from "commander";
import { registerSummary } from "./commands/summary.js";
import { registerTimeseries } from "./commands/timeseries.js";
import { registerSessions } from "./commands/sessions.js";
import { registerInteraction } from "./commands/interaction.js";
import { registerChart } from "./commands/chart.js";
import { registerFirstResponse } from "./commands/first-response.js";

const program = new Command();

program
  .name("convai-analytics")
  .description("Query the Convai analytics API from the command line.")
  .version("0.0.1")
  .option("--api-key <key>", "API key (defaults to CONVAI_API_KEY env var)")
  .option(
    "--base-url <url>",
    "API base URL (defaults to CONVAI_ANALYTICS_BASE_URL env var or https://analytics-api.convai.com/v1/analytics)",
  )
  .option("--pretty", "Pretty-print JSON output", false);

registerSummary(program);
registerTimeseries(program);
registerSessions(program);
registerInteraction(program);
registerFirstResponse(program);
registerChart(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  // SDK errors carry .status and .code; print a useful one-liner and exit 1.
  if (err && typeof err === "object" && "status" in err && "code" in err) {
    const e = err as { status: number; code: string; message: string };
    process.stderr.write(`error: ${e.code} (HTTP ${e.status}): ${e.message}\n`);
  } else {
    process.stderr.write(`error: ${(err as Error)?.message ?? String(err)}\n`);
  }
  process.exit(1);
});
