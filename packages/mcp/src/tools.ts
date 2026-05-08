import type {
  ConvaiAnalytics,
  CubeQuery,
  Percentile,
  RegressionDetectionParams,
  RelativeRange,
  SessionListParams,
  SummaryParams,
  TimeseriesParams,
} from "@convai/analytics";
import type { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { z } from "zod/v4";

import {
  activeSessionConcurrencyChart,
  characterUsageChart,
  componentLatencyChart,
  droppedPersistChart,
  errorBreakdownChart,
  errorTrendChart,
  estimateConcurrency,
  interactionWaterfallChart,
  latencyHeatmapChart,
  latencyMeasure,
  latencyPercentileChart,
  latencyRows,
  latencyThresholdChart,
  llmModelLatencyChart,
  peakConcurrencyChart,
  sessionDurationScatterChart,
  summaryReliabilityChart,
  ttsProviderChart,
  usageRows,
  usageTrendsChart,
  type LatencyPercentile,
  type VegaLiteSpec,
} from "./charts.js";

type AnalyticsClient = ConvaiAnalytics;
type ToolArgs = Record<string, unknown>;

export interface AnalyticsTool {
  name: string;
  title: string;
  description: string;
  inputSchema: ZodRawShapeCompat;
  handler: (client: AnalyticsClient, args: ToolArgs) => Promise<unknown>;
}

const RELATIVE_RANGES = ["last_15m", "last_1h", "last_6h", "last_24h", "last_7d", "last_30d"] as const;
const GRANULARITIES = ["minute", "hour", "day"] as const;
const LATENCY_PERCENTILES = ["p50", "p95", "p99"] as const;
const USAGE_METRICS = ["uniqueSessions", "uniqueTurns", "uniqueEndUsers"] as const;
const PROVIDER_COMPONENTS = ["llm", "tts", "asr", "neurosync"] as const;

const range = z.enum(RELATIVE_RANGES).default("last_24h").describe("Relative time range.");
const granularity = z.enum(GRANULARITIES).default("hour").describe("Bucket size for trend charts.");
const dayGranularity = z.enum(GRANULARITIES).default("day").describe("Bucket size for trend charts.");
const optionalId = z.string().min(1).optional();
const limit = z.number().int().min(1).max(500).default(25);
const percentile = z.enum(LATENCY_PERCENTILES).default("p95");
const p95Threshold = z.number().positive().default(3000);

const commonFilters = {
  range,
  appKey: optionalId.describe("Optional Convai app key filter."),
  characterId: optionalId.describe("Optional character filter."),
  experienceId: optionalId.describe("Optional experience filter."),
  endUserId: optionalId.describe("Optional end-user filter."),
  provider: optionalId.describe("Optional provider filter."),
  model: optionalId.describe("Optional model filter."),
  processor: optionalId.describe("Optional processor filter."),
  status: optionalId.describe("Optional status filter."),
};

const sessionFilters = {
  range,
  appKey: optionalId.describe("Optional Convai app key filter."),
  characterId: optionalId.describe("Optional character filter."),
  experienceId: optionalId.describe("Optional experience filter."),
  endUserId: optionalId.describe("Optional end-user filter."),
};

function pickString(args: ToolArgs, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function pickNumber(args: ToolArgs, key: string): number | undefined {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function pickRange(args: ToolArgs): RelativeRange {
  return (pickString(args, "range") ?? "last_24h") as RelativeRange;
}

function baseParams(args: ToolArgs): TimeseriesParams {
  return {
    range: pickRange(args),
    appKey: pickString(args, "appKey"),
    characterId: pickString(args, "characterId"),
    experienceId: pickString(args, "experienceId"),
    endUserId: pickString(args, "endUserId"),
    provider: pickString(args, "provider"),
    model: pickString(args, "model"),
    processor: pickString(args, "processor") as TimeseriesParams["processor"],
    status: pickString(args, "status") as TimeseriesParams["status"],
  };
}

function summaryParams(args: ToolArgs): SummaryParams {
  return {
    range: pickRange(args),
    appKey: pickString(args, "appKey"),
    characterId: pickString(args, "characterId"),
    experienceId: pickString(args, "experienceId"),
  };
}

function sessionListParams(args: ToolArgs): SessionListParams {
  return {
    range: pickRange(args),
    appKey: pickString(args, "appKey"),
    characterId: pickString(args, "characterId"),
    experienceId: pickString(args, "experienceId"),
    endUserId: pickString(args, "endUserId"),
    sort: (pickString(args, "sort") ?? "recent") as SessionListParams["sort"],
    limit: pickNumber(args, "limit") ?? 25,
    cursor: pickString(args, "cursor"),
  };
}

async function getLatencySeries(
  client: AnalyticsClient,
  args: ToolArgs,
  selectedPercentile: LatencyPercentile,
) {
  return client.timeseries({
    ...baseParams(args),
    measure: latencyMeasure(selectedPercentile),
    metricName: "voice.user_to_bot_latency",
    granularity: (pickString(args, "granularity") ?? "hour") as TimeseriesParams["granularity"],
  });
}

async function getUsageSeries(client: AnalyticsClient, args: ToolArgs, measure: string) {
  return client.timeseries({
    ...baseParams(args),
    measure,
    granularity: (pickString(args, "granularity") ?? "day") as TimeseriesParams["granularity"],
  });
}

function topBreakdownRows(rows: { value?: number | null; sampleCount?: number | null }[], topN: number) {
  return [...rows]
    .filter((row) => row.value !== null && row.value !== undefined)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, topN);
}

function reliabilityTrendsChart(
  errorTrend: Awaited<ReturnType<AnalyticsClient["errors"]["overTime"]>>,
  droppedTrend: Awaited<ReturnType<AnalyticsClient["timeseries"]>>,
  rangeLabel: string,
): VegaLiteSpec {
  const values = [
    ...errorTrend.points.map((point) => ({ ...point, metric: "errors" })),
    ...droppedTrend.points.map((point) => ({ ...point, metric: "dropped error-persist events" })),
  ];
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Reliability trends - ${rangeLabel}`,
    data: { values },
    mark: { type: "line", point: true },
    encoding: {
      x: { field: "bucketStart", type: "temporal", title: "Time" },
      y: { field: "value", type: "quantitative", title: "Count" },
      color: { field: "metric", type: "nominal", title: "Signal" },
      tooltip: [
        { field: "bucketStart", type: "temporal", title: "Bucket" },
        { field: "metric", title: "Signal" },
        { field: "value", title: "Count" },
      ],
    },
    width: 760,
    height: 320,
  };
}

async function findTraceableInteraction(client: AnalyticsClient, args: ToolArgs) {
  const sessionId = pickString(args, "sessionId");
  if (sessionId) {
    const detail = await client.sessions.get(sessionId);
    const interactionEvent = detail.events.find((event) => event.interactionId);
    if (!interactionEvent?.interactionId) {
      return { detail, interactionId: undefined };
    }
    return { detail, interactionId: interactionEvent.interactionId };
  }

  const sessions = await client.sessions.list({
    ...sessionListParams({ ...args, sort: "slowest", limit: pickNumber(args, "limit") ?? 25 }),
    sort: "slowest",
  });
  for (const session of sessions.sessions) {
    const detail = await client.sessions.get(session.sessionId);
    const interactionEvent = [...detail.events]
      .filter((event) => event.interactionId)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
    if (interactionEvent?.interactionId) {
      return { session, detail, interactionId: interactionEvent.interactionId };
    }
  }

  return { sessions, interactionId: undefined };
}

export const ANALYTICS_TOOLS: AnalyticsTool[] = [
  {
    name: "get_summary",
    title: "Get Analytics Summary",
    description: "Answer account-level questions like how many sessions, interactions, unique end users, errors, and headline latency percentiles happened in a time range.",
    inputSchema: {
      range,
      appKey: commonFilters.appKey,
      characterId: commonFilters.characterId,
      experienceId: commonFilters.experienceId,
    },
    handler: (client, args) => client.summary(summaryParams(args)),
  },
  {
    name: "get_metrics_catalog",
    title: "Get Metrics Catalog",
    description: "List the public metrics this account can query so an agent can choose the right latency, reliability, usage, provider, or model metric.",
    inputSchema: {},
    handler: (client) => client.catalog(),
  },
  {
    name: "list_sessions",
    title: "List Sessions",
    description: "Find recent, longest, or slowest sessions for the caller's account before drilling into a session timeline or interaction trace.",
    inputSchema: {
      ...sessionFilters,
      sort: z.enum(["recent", "longest", "slowest"]).default("recent"),
      limit: z.number().int().min(1).max(100).default(25),
      cursor: optionalId.describe("Opaque pagination cursor returned by the previous call."),
    },
    handler: (client, args) => client.sessions.list(sessionListParams(args)),
  },
  {
    name: "get_session_timeline",
    title: "Get Session Timeline",
    description: "Show the timeline of metrics and interaction ids inside one session, useful for explaining why a session felt slow.",
    inputSchema: {
      sessionId: z.string().min(1).describe("Convai session id."),
    },
    handler: (client, args) => client.sessions.get(pickString(args, "sessionId")!),
  },
  {
    name: "get_interaction_trace",
    title: "Get Interaction Trace",
    description: "Show the per-request component spans for one interaction id, including processor/provider/model durations where available.",
    inputSchema: {
      interactionId: z.string().min(1).describe("Convai interaction id."),
    },
    handler: (client, args) => client.interactions.get(pickString(args, "interactionId")!),
  },
  {
    name: "get_p95_latency_over_time",
    title: "Get P95 Latency Over Time",
    description: "Answer whether p95 end-to-end voice latency is getting better or worse over time.",
    inputSchema: { ...commonFilters, granularity },
    handler: (client, args) => getLatencySeries(client, args, "p95"),
  },
  {
    name: "get_latency_percentile_series",
    title: "Get Latency Percentile Series",
    description: "Fetch one raw P50/P95/P99 end-to-end latency timeseries for custom analysis or charting.",
    inputSchema: { ...commonFilters, granularity, percentile },
    handler: (client, args) =>
      getLatencySeries(client, args, (pickString(args, "percentile") ?? "p95") as LatencyPercentile),
  },
  {
    name: "get_latency_percentile_chart",
    title: "Generate Latency Percentile Chart",
    description: "Generate a Vega-Lite line chart for aggregate P50/P95/P99 latency distribution over time for production readiness sign-off.",
    inputSchema: { ...commonFilters, granularity },
    handler: async (client, args) => {
      const [p50, p95, p99] = await Promise.all([
        getLatencySeries(client, args, "p50"),
        getLatencySeries(client, args, "p95"),
        getLatencySeries(client, args, "p99"),
      ]);
      const values = [
        ...latencyRows("p50", p50),
        ...latencyRows("p95", p95),
        ...latencyRows("p99", p99),
      ];
      return { spec: latencyPercentileChart(values, pickRange(args)), series: { p50, p95, p99 } };
    },
  },
  {
    name: "get_latency_threshold_chart",
    title: "Generate P95 Threshold Chart",
    description: "Generate a Vega-Lite chart showing p95 latency against a production-readiness threshold.",
    inputSchema: { ...commonFilters, granularity, thresholdMs: p95Threshold },
    handler: async (client, args) => {
      const series = await getLatencySeries(client, args, "p95");
      const thresholdMs = pickNumber(args, "thresholdMs") ?? 3000;
      return {
        spec: latencyThresholdChart(latencyRows("p95", series), pickRange(args), thresholdMs),
        series,
        thresholdMs,
      };
    },
  },
  {
    name: "get_latency_heatmap_chart",
    title: "Generate Latency Heatmap",
    description: "Generate a Vega-Lite heatmap of p95 latency by day and UTC hour to spot systemic slow windows.",
    inputSchema: { ...commonFilters, granularity },
    handler: async (client, args) => {
      const series = await getLatencySeries(client, args, "p95");
      return { spec: latencyHeatmapChart(series, pickRange(args)), series };
    },
  },
  {
    name: "get_component_latency_breakdown",
    title: "Get Component Latency Breakdown",
    description: "Answer which processor/component is contributing most to p95 end-to-end latency.",
    inputSchema: { ...commonFilters, percentile },
    handler: (client, args) =>
      client.latency.byComponent({
        ...baseParams(args),
        percentile: (pickString(args, "percentile") ?? "p95") as Percentile,
      }),
  },
  {
    name: "generate_component_latency_chart",
    title: "Generate Component Latency Chart",
    description: "Generate a Vega-Lite bar chart showing p95 latency by processor/component.",
    inputSchema: { ...commonFilters, percentile },
    handler: async (client, args) => {
      const breakdown = await client.latency.byComponent({
        ...baseParams(args),
        percentile: (pickString(args, "percentile") ?? "p95") as Percentile,
      });
      return { spec: componentLatencyChart(breakdown, pickRange(args)), breakdown };
    },
  },
  {
    name: "find_component_latency_bottlenecks",
    title: "Find Component Latency Bottlenecks",
    description: "Rank the top latency offenders by component so an agent can explain likely bottlenecks.",
    inputSchema: { ...commonFilters, percentile, topN: z.number().int().min(1).max(20).default(5) },
    handler: async (client, args) => {
      const breakdown = await client.latency.byComponent({
        ...baseParams(args),
        percentile: (pickString(args, "percentile") ?? "p95") as Percentile,
      });
      const topN = pickNumber(args, "topN") ?? 5;
      return { top: topBreakdownRows(breakdown.rows, topN), breakdown };
    },
  },
  {
    name: "generate_interaction_waterfall",
    title: "Generate Interaction Waterfall",
    description: "Generate a Vega-Lite waterfall chart for one interaction id's per-component latency breakdown.",
    inputSchema: {
      interactionId: z.string().min(1).describe("Convai interaction id."),
    },
    handler: async (client, args) => {
      const trace = await client.interactions.get(pickString(args, "interactionId")!);
      return { spec: interactionWaterfallChart(trace), trace };
    },
  },
  {
    name: "explain_slow_session",
    title: "Explain Slow Session",
    description: "Find a traceable slow interaction in a session or slow-session list and return the session timeline, trace, top span, and waterfall chart.",
    inputSchema: {
      ...sessionFilters,
      sessionId: optionalId.describe("Optional specific session id. If omitted, the tool scans slow sessions."),
      limit: z.number().int().min(1).max(50).default(25),
    },
    handler: async (client, args) => {
      const target = await findTraceableInteraction(client, args);
      if (!target.interactionId) {
        return {
          message: "No interaction id was available in the scanned session timelines.",
          target,
        };
      }
      const trace = await client.interactions.get(target.interactionId);
      const topSpan = [...trace.spans].sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))[0];
      return {
        ...target,
        trace,
        topSpan,
        spec: interactionWaterfallChart(trace),
      };
    },
  },
  {
    name: "get_error_trend",
    title: "Get Error Trend",
    description: "Answer whether errors are rising or falling over time.",
    inputSchema: { ...commonFilters, granularity: dayGranularity },
    handler: (client, args) =>
      client.errors.overTime({
        ...baseParams(args),
        granularity: (pickString(args, "granularity") ?? "day") as TimeseriesParams["granularity"],
      }),
  },
  {
    name: "generate_error_trend_chart",
    title: "Generate Error Trend Chart",
    description: "Generate a Vega-Lite line chart showing errors over time.",
    inputSchema: { ...commonFilters, granularity: dayGranularity },
    handler: async (client, args) => {
      const series = await client.errors.overTime({
        ...baseParams(args),
        granularity: (pickString(args, "granularity") ?? "day") as TimeseriesParams["granularity"],
      });
      return { spec: errorTrendChart(series, pickRange(args)), series };
    },
  },
  {
    name: "get_error_breakdown",
    title: "Get Error Breakdown",
    description: "Break down errors by processor/component to identify reliability hotspots.",
    inputSchema: {
      ...commonFilters,
      groupBy: z.string().default("processor"),
      limit,
    },
    handler: (client, args) =>
      client.breakdown({
        ...baseParams(args),
        measure: "count",
        metricNamePrefix: "error.",
        groupBy: pickString(args, "groupBy") ?? "processor",
        limit: pickNumber(args, "limit") ?? 25,
      }),
  },
  {
    name: "generate_error_breakdown_chart",
    title: "Generate Error Breakdown Chart",
    description: "Generate a Vega-Lite bar chart of errors by processor/component.",
    inputSchema: {
      ...commonFilters,
      groupBy: z.string().default("processor"),
      limit,
    },
    handler: async (client, args) => {
      const breakdown = await client.breakdown({
        ...baseParams(args),
        measure: "count",
        metricNamePrefix: "error.",
        groupBy: pickString(args, "groupBy") ?? "processor",
        limit: pickNumber(args, "limit") ?? 25,
      });
      return { spec: errorBreakdownChart(breakdown, pickRange(args)), breakdown };
    },
  },
  {
    name: "get_dropped_error_persist_trend",
    title: "Get Dropped Error Persist Trend",
    description: "Track dropped error-persistence events over time as a reliability signal.",
    inputSchema: { ...commonFilters, granularity: dayGranularity },
    handler: (client, args) =>
      client.timeseries({
        ...baseParams(args),
        measure: "count",
        metricName: "db.error_persist_dropped",
        granularity: (pickString(args, "granularity") ?? "day") as TimeseriesParams["granularity"],
      }),
  },
  {
    name: "generate_dropped_error_persist_chart",
    title: "Generate Dropped Error Persist Chart",
    description: "Generate a Vega-Lite trend chart for dropped error-persistence events.",
    inputSchema: { ...commonFilters, granularity: dayGranularity },
    handler: async (client, args) => {
      const series = await client.timeseries({
        ...baseParams(args),
        measure: "count",
        metricName: "db.error_persist_dropped",
        granularity: (pickString(args, "granularity") ?? "day") as TimeseriesParams["granularity"],
      });
      return { spec: droppedPersistChart(series, pickRange(args)), series };
    },
  },
  {
    name: "generate_reliability_summary_chart",
    title: "Generate Reliability Summary Chart",
    description: "Generate a Vega-Lite chart of interactions, sessions, errors, and error rate for a time range.",
    inputSchema: {
      range,
      appKey: commonFilters.appKey,
      characterId: commonFilters.characterId,
      experienceId: commonFilters.experienceId,
    },
    handler: async (client, args) => {
      const summary = await client.summary(summaryParams(args));
      return { spec: summaryReliabilityChart(summary, pickRange(args)), summary };
    },
  },
  {
    name: "generate_reliability_trends_chart",
    title: "Generate Reliability Trends Chart",
    description: "Generate a Vega-Lite trend chart that combines errors and dropped persistence events.",
    inputSchema: { ...commonFilters, granularity: dayGranularity },
    handler: async (client, args) => {
      const [errors, dropped] = await Promise.all([
        client.errors.overTime({
          ...baseParams(args),
          granularity: (pickString(args, "granularity") ?? "day") as TimeseriesParams["granularity"],
        }),
        client.timeseries({
          ...baseParams(args),
          measure: "count",
          metricName: "db.error_persist_dropped",
          granularity: (pickString(args, "granularity") ?? "day") as TimeseriesParams["granularity"],
        }),
      ]);
      return { spec: reliabilityTrendsChart(errors, dropped, pickRange(args)), series: { errors, dropped } };
    },
  },
  {
    name: "get_usage_trends",
    title: "Get Usage Trends",
    description: "Fetch sessions, interactions, and unique end users over time for usage trend analysis.",
    inputSchema: {
      ...commonFilters,
      granularity: dayGranularity,
      metrics: z.array(z.enum(USAGE_METRICS)).default(["uniqueSessions", "uniqueTurns", "uniqueEndUsers"]),
    },
    handler: async (client, args) => {
      const metrics = (args.metrics as string[] | undefined) ?? [...USAGE_METRICS];
      const entries = await Promise.all(metrics.map(async (metric) => [metric, await getUsageSeries(client, args, metric)]));
      return Object.fromEntries(entries);
    },
  },
  {
    name: "generate_usage_trends_chart",
    title: "Generate Usage Trends Chart",
    description: "Generate a Vega-Lite chart for sessions, interactions, and unique end users over time.",
    inputSchema: { ...commonFilters, granularity: dayGranularity },
    handler: async (client, args) => {
      const [sessions, interactions, endUsers] = await Promise.all([
        getUsageSeries(client, args, "uniqueSessions"),
        getUsageSeries(client, args, "uniqueTurns"),
        getUsageSeries(client, args, "uniqueEndUsers"),
      ]);
      const values = [
        ...usageRows("sessions", sessions),
        ...usageRows("interactions", interactions),
        ...usageRows("unique end users", endUsers),
      ];
      return { spec: usageTrendsChart(values, pickRange(args)), series: { sessions, interactions, endUsers } };
    },
  },
  {
    name: "get_character_usage_leaderboard",
    title: "Get Character Usage Leaderboard",
    description: "Rank characters by session volume for the selected time range.",
    inputSchema: { ...sessionFilters, limit },
    handler: (client, args) =>
      client.breakdown({
        ...baseParams(args),
        measure: "uniqueSessions",
        groupBy: "characterId",
        limit: pickNumber(args, "limit") ?? 25,
      }),
  },
  {
    name: "generate_character_usage_chart",
    title: "Generate Character Usage Chart",
    description: "Generate a Vega-Lite leaderboard chart of sessions by character.",
    inputSchema: { ...sessionFilters, limit },
    handler: async (client, args) => {
      const breakdown = await client.breakdown({
        ...baseParams(args),
        measure: "uniqueSessions",
        groupBy: "characterId",
        limit: pickNumber(args, "limit") ?? 25,
      });
      return { spec: characterUsageChart(breakdown, pickRange(args)), breakdown };
    },
  },
  {
    name: "generate_session_duration_scatter",
    title: "Generate Session Duration Scatter",
    description: "Generate a Vega-Lite scatter plot of session duration versus interactions, colored by p95 latency.",
    inputSchema: {
      ...sessionFilters,
      sort: z.enum(["recent", "longest", "slowest"]).default("slowest"),
      limit: z.number().int().min(1).max(100).default(25),
    },
    handler: async (client, args) => {
      const sessions = await client.sessions.list(sessionListParams(args));
      return { spec: sessionDurationScatterChart(sessions.sessions, pickRange(args)), sessions };
    },
  },
  {
    name: "estimate_active_session_concurrency",
    title: "Estimate Active Session Concurrency",
    description: "Estimate active session and LiveKit room pressure from session start/end/duration telemetry.",
    inputSchema: {
      ...sessionFilters,
      limit: z.number().int().min(1).max(100).default(100),
      bucketMinutes: z.number().int().min(1).max(60).default(5),
    },
    handler: async (client, args) => {
      const sessions = await client.sessions.list({
        ...sessionListParams({ ...args, sort: "recent", limit: pickNumber(args, "limit") ?? 100 }),
        sort: "recent",
      });
      const bucketMinutes = pickNumber(args, "bucketMinutes") ?? 5;
      const rows = estimateConcurrency(sessions.sessions, bucketMinutes);
      const peak = rows.reduce((max, row) => Math.max(max, row.activeSessions), 0);
      return { rows, peak, bucketMinutes, sessions };
    },
  },
  {
    name: "generate_active_session_concurrency_chart",
    title: "Generate Active Session Concurrency Chart",
    description: "Generate a Vega-Lite area chart estimating active sessions over time.",
    inputSchema: {
      ...sessionFilters,
      limit: z.number().int().min(1).max(100).default(100),
      bucketMinutes: z.number().int().min(1).max(60).default(5),
    },
    handler: async (client, args) => {
      const sessions = await client.sessions.list({
        ...sessionListParams({ ...args, sort: "recent", limit: pickNumber(args, "limit") ?? 100 }),
        sort: "recent",
      });
      const rows = estimateConcurrency(sessions.sessions, pickNumber(args, "bucketMinutes") ?? 5);
      return { spec: activeSessionConcurrencyChart(rows, pickRange(args)), rows, sessions };
    },
  },
  {
    name: "generate_peak_concurrency_chart",
    title: "Generate Peak Concurrency Chart",
    description: "Generate a Vega-Lite chart showing estimated active sessions with a peak concurrency annotation.",
    inputSchema: {
      ...sessionFilters,
      limit: z.number().int().min(1).max(100).default(100),
      bucketMinutes: z.number().int().min(1).max(60).default(5),
    },
    handler: async (client, args) => {
      const sessions = await client.sessions.list({
        ...sessionListParams({ ...args, sort: "recent", limit: pickNumber(args, "limit") ?? 100 }),
        sort: "recent",
      });
      const rows = estimateConcurrency(sessions.sessions, pickNumber(args, "bucketMinutes") ?? 5);
      const peak = rows.reduce((max, row) => Math.max(max, row.activeSessions), 0);
      return { spec: peakConcurrencyChart(rows, pickRange(args)), rows, peak, sessions };
    },
  },
  {
    name: "get_tts_provider_attribution",
    title: "Get TTS Provider Attribution",
    description: "Show which TTS voice providers contributed samples in the selected time range.",
    inputSchema: { ...commonFilters, limit: z.number().int().min(1).max(100).default(10) },
    handler: (client, args) =>
      client.breakdown({
        ...baseParams(args),
        measure: "count",
        metricName: "tts.voice_provider",
        groupBy: "voiceProvider",
        limit: pickNumber(args, "limit") ?? 10,
      }),
  },
  {
    name: "generate_tts_provider_chart",
    title: "Generate TTS Provider Chart",
    description: "Generate a Vega-Lite chart of TTS provider attribution.",
    inputSchema: { ...commonFilters, limit: z.number().int().min(1).max(100).default(10) },
    handler: async (client, args) => {
      const breakdown = await client.breakdown({
        ...baseParams(args),
        measure: "count",
        metricName: "tts.voice_provider",
        groupBy: "voiceProvider",
        limit: pickNumber(args, "limit") ?? 10,
      });
      return { spec: ttsProviderChart(breakdown, pickRange(args)), breakdown };
    },
  },
  {
    name: "get_llm_model_latency",
    title: "Get LLM Model Latency",
    description: "Rank LLM models by p95 latency to spot model-driven latency issues.",
    inputSchema: { ...commonFilters, limit: z.number().int().min(1).max(100).default(10) },
    handler: (client, args) =>
      client.breakdown({
        ...baseParams(args),
        measure: "p95Value",
        metricNamePrefix: "LLMService.",
        groupBy: "model",
        limit: pickNumber(args, "limit") ?? 10,
      }),
  },
  {
    name: "generate_llm_model_latency_chart",
    title: "Generate LLM Model Latency Chart",
    description: "Generate a Vega-Lite chart ranking LLM models by p95 latency.",
    inputSchema: { ...commonFilters, limit: z.number().int().min(1).max(100).default(10) },
    handler: async (client, args) => {
      const breakdown = await client.breakdown({
        ...baseParams(args),
        measure: "p95Value",
        metricNamePrefix: "LLMService.",
        groupBy: "model",
        limit: pickNumber(args, "limit") ?? 10,
      });
      return { spec: llmModelLatencyChart(breakdown, pickRange(args)), breakdown };
    },
  },
  {
    name: "compare_providers",
    title: "Compare Providers",
    description: "Compare provider or model latency for LLM, TTS, ASR, or NeuroSync components.",
    inputSchema: {
      ...commonFilters,
      component: z.enum(PROVIDER_COMPONENTS).default("llm"),
      percentile: z.enum(["p50", "p75", "p90", "p95", "p99"]).default("p95"),
    },
    handler: (client, args) =>
      client.providers.compare({
        ...baseParams(args),
        component: (pickString(args, "component") ?? "llm") as "llm" | "tts" | "asr" | "neurosync",
        percentile: (pickString(args, "percentile") ?? "p95") as Percentile,
      }),
  },
  {
    name: "detect_regressions",
    title: "Detect Regressions",
    description: "Plan-gated. Detect whether latency regressed in the current window compared with a baseline window.",
    inputSchema: {
      measure: z.string().default("voice.user_to_bot_latency"),
      baselineRange: z.enum(RELATIVE_RANGES).default("last_7d"),
      currentRange: z.enum(RELATIVE_RANGES).default("last_24h"),
      groupBy: z.string().default("overall"),
      threshold: z.number().min(0).max(10).default(0.15),
    },
    handler: (client, args) =>
      client.regressionDetection({
        measure: pickString(args, "measure") ?? "voice.user_to_bot_latency",
        baselineRange: (pickString(args, "baselineRange") ?? "last_7d") as RegressionDetectionParams["baselineRange"],
        currentRange: (pickString(args, "currentRange") ?? "last_24h") as RegressionDetectionParams["currentRange"],
        groupBy: pickString(args, "groupBy") ?? "overall",
        threshold: pickNumber(args, "threshold") ?? 0.15,
      }),
  },
  {
    name: "advanced_query",
    title: "Advanced Query",
    description: "Plan-gated. Run an advanced analytics query through the public API for questions not covered by curated tools.",
    inputSchema: {
      query: z.record(z.string(), z.unknown()).describe("Public analytics query body accepted by the API."),
    },
    handler: (client, args) => client.query(args.query as CubeQuery),
  },
];
