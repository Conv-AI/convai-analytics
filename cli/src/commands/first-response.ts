import type { Command } from "commander";
import { ConvaiAnalytics } from "@convai/analytics";
import type {
  FirstResponseGroupBy,
  FirstResponseLatencyKind,
  RelativeRange,
  TurnScope,
} from "@convai/analytics";

type Opts = Record<string, string | number | undefined>;

export function registerFirstResponse(program: Command): void {
  const cmd = program
    .command("first-response")
    .description("Character-first, mode-specific first-response SLA analytics.");

  cmd
    .command("summary")
    .description("P50/P95/P99 first-response latency for one character.")
    .requiredOption("--character-id <id>", "Character id")
    .option("--mode <mode>", "Observed mode, e.g. voice_to_voice_animation")
    .option("--turn-scope <scope>", "all | warm | cold", "all")
    .option("--latency-kind <kind>", "primary | first_text | first_voice | first_animation | all_modalities_ready", "primary")
    .option("--range <range>", "Relative range", "last_24h")
    .action(async function (this: Command, opts: Opts) {
      const client = clientFrom(this);
      printJson(
        await client.firstResponse.summary({
          characterId: String(opts.characterId),
          mode: stringOpt(opts.mode),
          turnScope: opts.turnScope as TurnScope,
          latencyKind: opts.latencyKind as FirstResponseLatencyKind,
          range: opts.range as RelativeRange,
        }),
        this.parent!.parent!.opts().pretty,
      );
    });

  cmd
    .command("timeseries")
    .description("Bucketed P50/P95/P99 first-response latency for one character.")
    .requiredOption("--character-id <id>", "Character id")
    .option("--mode <mode>", "Observed mode")
    .option("--group-by <dim>", "Optional group: mode | breakdown_kind | stage | settings_hash | turn_scope | provider | model | status | character_id")
    .option("--turn-scope <scope>", "all | warm | cold", "all")
    .option("--latency-kind <kind>", "primary | first_text | first_voice | first_animation | all_modalities_ready", "primary")
    .option("--granularity <g>", "minute | hour | day", "hour")
    .option("--range <range>", "Relative range", "last_24h")
    .action(async function (this: Command, opts: Opts) {
      const client = clientFrom(this);
      printJson(
        await client.firstResponse.timeseries({
          characterId: String(opts.characterId),
          mode: stringOpt(opts.mode),
          groupBy: opts.groupBy as FirstResponseGroupBy | undefined,
          turnScope: opts.turnScope as TurnScope,
          latencyKind: opts.latencyKind as FirstResponseLatencyKind,
          granularity: opts.granularity as "minute" | "hour" | "day",
          range: opts.range as RelativeRange,
        }),
        this.parent!.parent!.opts().pretty,
      );
    });

  cmd
    .command("breakdown")
    .description("Grouped first-response latency for one character.")
    .requiredOption("--character-id <id>", "Character id")
    .option("--group-by <dim>", "mode | breakdown_kind | stage | settings_hash | turn_scope | provider | model | status | character_id", "mode")
    .option("--mode <mode>", "Observed mode")
    .option("--turn-scope <scope>", "all | warm | cold", "all")
    .option("--latency-kind <kind>", "primary | first_text | first_voice | first_animation | all_modalities_ready", "primary")
    .option("--range <range>", "Relative range", "last_24h")
    .option("--limit <n>", "Max rows", Number)
    .action(async function (this: Command, opts: Opts) {
      const client = clientFrom(this);
      printJson(
        await client.firstResponse.breakdown({
          characterId: String(opts.characterId),
          groupBy: opts.groupBy as FirstResponseGroupBy,
          mode: stringOpt(opts.mode),
          turnScope: opts.turnScope as TurnScope,
          latencyKind: opts.latencyKind as FirstResponseLatencyKind,
          range: opts.range as RelativeRange,
          limit: typeof opts.limit === "number" && Number.isFinite(opts.limit) ? opts.limit : undefined,
        }),
        this.parent!.parent!.opts().pretty,
      );
    });

  cmd
    .command("markers")
    .description("Settings-change markers for one character's first-response latency.")
    .requiredOption("--character-id <id>", "Character id")
    .option("--mode <mode>", "Observed mode")
    .option("--turn-scope <scope>", "all | warm | cold", "all")
    .option("--latency-kind <kind>", "primary | first_text | first_voice | first_animation | all_modalities_ready", "primary")
    .option("--range <range>", "Relative range", "last_24h")
    .action(async function (this: Command, opts: Opts) {
      const client = clientFrom(this);
      printJson(
        await client.firstResponse.markers({
          characterId: String(opts.characterId),
          mode: stringOpt(opts.mode),
          turnScope: opts.turnScope as TurnScope,
          latencyKind: opts.latencyKind as FirstResponseLatencyKind,
          range: opts.range as RelativeRange,
        }),
        this.parent!.parent!.opts().pretty,
      );
    });

  cmd
    .command("settings")
    .description("Fetch one sanitized latency settings snapshot.")
    .argument("<settings-hash>", "Settings hash")
    .option("--character-id <id>", "Optional character id filter")
    .option("--range <range>", "Relative range", "last_30d")
    .action(async function (this: Command, settingsHash: string, opts: Opts) {
      const client = clientFrom(this);
      printJson(
        await client.firstResponse.settings(settingsHash, {
          characterId: stringOpt(opts.characterId),
          range: opts.range as RelativeRange,
        }),
        this.parent!.parent!.opts().pretty,
      );
    });

  cmd
    .command("interaction")
    .description("Additive first-response waterfall for one interaction id.")
    .argument("<interaction-id>", "Interaction id")
    .action(async function (this: Command, interactionId: string) {
      const client = clientFrom(this);
      printJson(
        await client.firstResponse.interaction(interactionId),
        this.parent!.parent!.opts().pretty,
      );
    });
}

function clientFrom(command: Command): ConvaiAnalytics {
  const root = command.parent!.parent!;
  return new ConvaiAnalytics({
    apiKey: root.opts().apiKey,
    baseUrl: root.opts().baseUrl,
  });
}

function stringOpt(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function printJson(value: unknown, pretty: boolean): void {
  process.stdout.write(JSON.stringify(value, null, pretty ? 2 : 0) + "\n");
}
