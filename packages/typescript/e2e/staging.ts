import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import {
  ConvaiAnalytics,
  ConvaiAnalyticsError,
  PlanInsufficientError,
  PlanRequiredError,
  RateLimitError,
} from "../src/index.js";
import type {
  BreakdownResponse,
  CatalogResponse,
  ComponentSpan,
  CubeQueryResponse,
  InteractionTrace,
  RelativeRange,
  RegressionDetectionResponse,
  SessionDetail,
  SessionListResponse,
  SessionSummary,
  SummaryResponse,
  TimeseriesPoint,
  TimeseriesResponse,
} from "../src/index.js";

const DEFAULT_BASE_URL = "https://analytics-api-stg.convai.com/v1/analytics";
const ALLOWED_RANGES: readonly RelativeRange[] = [
  "last_15m",
  "last_1h",
  "last_6h",
  "last_24h",
  "last_7d",
  "last_30d",
];
const DEFAULT_RANGE = parseRelativeRange(process.env.CONVAI_ANALYTICS_E2E_RANGE ?? "last_24h");
const REQUEST_DELAY_MS = Number(process.env.CONVAI_ANALYTICS_E2E_DELAY_MS ?? "1000");
const REQUIRE_DATA = process.env.CONVAI_ANALYTICS_E2E_REQUIRE_DATA !== "0";
const DEFAULT_CHART_DIR = join(process.cwd(), "e2e", "artifacts");

type Outcome = "pass" | "skip" | "fail";

interface Result {
  name: string;
  outcome: Outcome;
  detail: string;
}

interface TestContext {
  client: ConvaiAnalytics;
  baseUrl: string;
  chartDir: string;
  results: Result[];
  summary?: SummaryResponse;
  catalog?: CatalogResponse;
  latencySeries?: Partial<Record<LatencyPercentile, TimeseriesResponse>>;
  componentLatency?: BreakdownResponse;
  sessions?: SessionListResponse;
  sessionDetail?: SessionDetail;
  interactionTrace?: InteractionTrace;
  errorTrend?: TimeseriesResponse;
  errorBreakdown?: BreakdownResponse;
  droppedPersistTrend?: TimeseriesResponse;
  statusBreakdown?: BreakdownResponse;
  usageSeries?: Partial<Record<UsageMetric, TimeseriesResponse>>;
  characterUsage?: BreakdownResponse;
  ttsProviderBreakdown?: BreakdownResponse;
  llmModelLatency?: BreakdownResponse;
}

type LatencyPercentile = "p50" | "p95" | "p99";
type UsageMetric = "uniqueSessions" | "uniqueTurns" | "uniqueEndUsers";

interface VegaLiteSpec {
  $schema: string;
  title?: string;
  data?: { values: unknown[] };
  mark?: unknown;
  layer?: unknown[];
  encoding?: Record<string, unknown>;
  width?: number;
  height?: unknown;
  transform?: unknown[];
}

interface ChartArtifact {
  filename: string;
  values: number;
}

interface ConcurrencyRow {
  bucketStart: string;
  activeSessions: number;
}

interface LatencyChartRow {
  bucketStart: string;
  percentile: LatencyPercentile;
  value: number | null | undefined;
  sampleCount: number;
}

interface UsageChartRow {
  bucketStart: string;
  metric: string;
  value: number | null | undefined;
  sampleCount: number;
}

interface DrilldownTarget {
  session: SessionSummary;
  detail: SessionDetail;
  interactionId: string;
}

class SkipTest extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkipTest";
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.CONVAI_API_KEY;
  if (!apiKey) {
    throw new Error("CONVAI_API_KEY is required for staging E2E.");
  }

  const baseUrl = (process.env.CONVAI_ANALYTICS_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const client = new ConvaiAnalytics({ apiKey, baseUrl, timeoutMs: 45_000 });
  const chartDir = process.env.CONVAI_ANALYTICS_E2E_CHART_DIR ?? DEFAULT_CHART_DIR;
  await mkdir(chartDir, { recursive: true });
  const ctx: TestContext = { client, baseUrl, chartDir, results: [] };

  await run(ctx, "health and readiness are green", () => healthChecks(baseUrl));
  await run(ctx, "summary answers usage and reach", () => summaryQuestion(ctx));
  await run(ctx, "catalog exposes queryable metrics", () => catalogQuestion(ctx));
  await run(ctx, "headline p95 latency over time", () => headlineLatencyQuestion(ctx));
  await run(ctx, "character latency breakdown", () => characterLatencyQuestion(ctx));
  await run(ctx, "latency facade maps to backend-native tokens", () => latencyFacadeQuestion(ctx));
  await run(ctx, "slow session and interaction drilldown", () => drilldownQuestion(ctx));
  await run(ctx, "NeuroSync animation metrics", () => neuroSyncQuestion(ctx));
  await run(ctx, "TTS provider attribution", () => ttsProviderQuestion(ctx));
  await run(ctx, "error trend shape is stable", () => errorTrendQuestion(ctx));
  await run(ctx, "advanced LLM bottleneck query is gated or works", () => advancedLlmQuestion(client));
  await run(ctx, "regression detection is gated or works", () => regressionQuestion(client));
  await run(ctx, "raw p50 latency series is chartable", () => rawLatencyPercentileQuestion(ctx, "p50"));
  await run(ctx, "raw p95 latency series is chartable", () => rawLatencyPercentileQuestion(ctx, "p95"));
  await run(ctx, "raw p99 latency series is chartable", () => rawLatencyPercentileQuestion(ctx, "p99"));
  await run(ctx, "aggregate latency percentile band chart is generated", () => latencyPercentileBandChart(ctx));
  await run(ctx, "production-readiness p95 threshold chart is generated", () => latencyThresholdChart(ctx));
  await run(ctx, "latency hour heatmap chart is generated", () => latencyHeatmapChart(ctx));
  await run(ctx, "component latency chart is generated", () => componentLatencyChart(ctx));
  await run(ctx, "component latency top offender is identifiable", () => componentTopOffenderQuestion(ctx));
  await run(ctx, "interaction waterfall chart is generated", () => interactionWaterfallChart(ctx));
  await run(ctx, "error trend chart is generated", () => errorTrendChart(ctx));
  await run(ctx, "error component breakdown chart is generated", () => errorBreakdownChart(ctx));
  await run(ctx, "dropped error-persist chart is generated", () => droppedPersistChart(ctx));
  await run(ctx, "summary reliability chart is generated", () => summaryReliabilityChart(ctx));
  await run(ctx, "daily sessions usage trend is generated", () => usageTrendQuestion(ctx, "uniqueSessions"));
  await run(ctx, "daily interactions trend is generated", () => usageTrendQuestion(ctx, "uniqueTurns"));
  await run(ctx, "daily unique end users trend is generated", () => usageTrendQuestion(ctx, "uniqueEndUsers"));
  await run(ctx, "multi-metric usage chart is generated", () => usageMultiMetricChart(ctx));
  await run(ctx, "character usage leaderboard chart is generated", () => characterUsageChart(ctx));
  await run(ctx, "session duration scatter chart is generated", () => sessionDurationScatterChart(ctx));
  await run(ctx, "active session concurrency is estimated", () => concurrencyEstimateQuestion(ctx));
  await run(ctx, "active session concurrency chart is generated", () => concurrencyChart(ctx));
  await run(ctx, "peak concurrency annotation chart is generated", () => peakConcurrencyChart(ctx));
  await run(ctx, "TTS provider attribution chart is generated", () => ttsProviderChart(ctx));
  await run(ctx, "LLM model latency chart is generated", () => llmModelLatencyChart(ctx));

  printSummary(ctx.results);
  const failed = ctx.results.filter((r) => r.outcome === "fail");
  if (failed.length > 0) process.exitCode = 1;
}

async function run(
  ctx: TestContext,
  name: string,
  fn: () => Promise<string>,
): Promise<void> {
  try {
    const detail = await fn();
    ctx.results.push({ name, outcome: "pass", detail });
  } catch (err) {
    if (err instanceof SkipTest) {
      ctx.results.push({ name, outcome: "skip", detail: err.message });
      return;
    }
    ctx.results.push({ name, outcome: "fail", detail: describeError(err) });
  } finally {
    if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
  }
}

async function healthChecks(baseUrl: string): Promise<string> {
  const root = serviceRoot(baseUrl);
  const [health, ready] = await Promise.all([
    fetch(new URL("/healthz", root)),
    fetch(new URL("/readyz", root)),
  ]);
  assert(health.ok, `/healthz returned ${health.status}`);
  assert(ready.ok, `/readyz returned ${ready.status}`);
  return `health=${health.status}, ready=${ready.status}`;
}

async function summaryQuestion(ctx: TestContext): Promise<string> {
  const summary = await getSummary(ctx);
  assertSummary(summary);
  if (REQUIRE_DATA) {
    assert(summary.sessions > 0, `expected sessions for ${DEFAULT_RANGE}`);
    assert(summary.interactions > 0, `expected interactions for ${DEFAULT_RANGE}`);
    assert(summary.uniqueEndUsers > 0, `expected unique end users for ${DEFAULT_RANGE}`);
    assert(summary.meta.sampleCount > 0, `expected summary samples for ${DEFAULT_RANGE}`);
  }
  return [
    `sessions=${summary.sessions}`,
    `interactions=${summary.interactions}`,
    `uniqueEndUsers=${summary.uniqueEndUsers}`,
    `sampleCount=${summary.meta.sampleCount}`,
  ].join(", ");
}

async function catalogQuestion(ctx: TestContext): Promise<string> {
  const catalog = await getCatalog(ctx);
  assertCatalog(catalog);
  const names = new Set(catalog.metrics.map((m) => m.metricName));
  assert(names.has("voice.user_to_bot_latency"), "catalog missing voice.user_to_bot_latency");
  return `metrics=${catalog.metrics.length}, includes voice.user_to_bot_latency`;
}

async function headlineLatencyQuestion(ctx: TestContext): Promise<string> {
  const series = await getLatencySeries(ctx, "p95");
  assertTimeseries(series);
  const nonNull = series.points.filter((p) => p.value !== null && p.value !== undefined).length;
  if (REQUIRE_DATA) {
    assert(series.meta.sampleCount > 0, `expected latency samples for ${DEFAULT_RANGE}`);
    assert(nonNull > 0, `expected at least one latency value for ${DEFAULT_RANGE}`);
  }
  return `points=${series.points.length}, values=${nonNull}, sampleCount=${series.meta.sampleCount}`;
}

async function characterLatencyQuestion(ctx: TestContext): Promise<string> {
  const breakdown = await withRateLimitRetry(() =>
    ctx.client.breakdown({
      range: DEFAULT_RANGE,
      measure: "p95Value",
      metricName: "voice.user_to_bot_latency",
      groupBy: "characterId",
      limit: 10,
    }),
  );
  assertBreakdown(breakdown);
  if (REQUIRE_DATA) {
    assert(breakdown.rows.length > 0, `expected character latency rows for ${DEFAULT_RANGE}`);
    assert(breakdown.meta.sampleCount > 0, `expected character latency samples for ${DEFAULT_RANGE}`);
  }
  return `rows=${breakdown.rows.length}, sampleCount=${breakdown.meta.sampleCount}`;
}

async function latencyFacadeQuestion(ctx: TestContext): Promise<string> {
  const breakdown = await getComponentLatency(ctx);
  assertBreakdown(breakdown);
  if (REQUIRE_DATA) {
    assert(breakdown.rows.length > 0, `expected component latency rows for ${DEFAULT_RANGE}`);
    assert(breakdown.meta.sampleCount > 0, `expected component latency samples for ${DEFAULT_RANGE}`);
  }
  return `rows=${breakdown.rows.length}, sampleCount=${breakdown.meta.sampleCount}`;
}

async function drilldownQuestion(ctx: TestContext): Promise<string> {
  const { session, detail, interactionId } = await getDrilldownTarget(ctx);
  const trace = await withRateLimitRetry(() => ctx.client.interactions.get(interactionId));
  assert(trace.interactionId === interactionId, "interaction id mismatch");
  assert(Array.isArray(trace.spans), "interaction spans must be an array");
  ctx.interactionTrace = trace;
  const latencyLike = trace.spans.filter(isLatencyLikeSpan).length;
  assert(trace.spans.length > 0, "interaction trace must include spans");
  return [
    `session=${session.sessionId}`,
    `events=${detail.events.length}`,
    `spans=${trace.spans.length}`,
    `latencyLikeSpans=${latencyLike}`,
  ].join(", ");
}

async function neuroSyncQuestion(ctx: TestContext): Promise<string> {
  const series = await withRateLimitRetry(() =>
    ctx.client.timeseries({
      range: DEFAULT_RANGE,
      measure: "avg",
      metricName: "neurosync.output_fps",
      granularity: "day",
    }),
  );
  assertTimeseries(series);
  return `points=${series.points.length}, sampleCount=${series.meta.sampleCount}`;
}

async function ttsProviderQuestion(ctx: TestContext): Promise<string> {
  const breakdown = await getTtsProviderBreakdown(ctx);
  assertBreakdown(breakdown);
  return `rows=${breakdown.rows.length}, sampleCount=${breakdown.meta.sampleCount}`;
}

async function errorTrendQuestion(ctx: TestContext): Promise<string> {
  const series = await getErrorTrend(ctx);
  assertTimeseries(series);
  return `points=${series.points.length}, sampleCount=${series.meta.sampleCount}`;
}

async function advancedLlmQuestion(client: ConvaiAnalytics): Promise<string> {
  try {
    const response = await withRateLimitRetry(() =>
      client.query({
        measures: ["SessionMetrics.p95Value", "SessionMetrics.count"],
        dimensions: ["SessionMetrics.model"],
        filters: [
          {
            member: "SessionMetrics.metricName",
            operator: "contains",
            values: ["LLMService.ttfb"],
          },
        ],
        timeDimensions: [
          {
            dimension: "SessionMetrics.eventTime",
            dateRange: "last 30 days",
          },
        ],
        limit: 10,
        order: { "SessionMetrics.p95Value": "desc" },
      }),
    );
    assertCubeResponse(response);
    return `advanced query rows=${response.data.length}`;
  } catch (err) {
    if (isPlanGate(err)) return `${err.name} (${err.status})`;
    throw err;
  }
}

async function regressionQuestion(client: ConvaiAnalytics): Promise<string> {
  try {
    const response = await withRateLimitRetry(() =>
      client.regressionDetection({
        baselineRange: "last_30d",
        currentRange: "last_7d",
        measure: "voice.user_to_bot_latency",
      }),
    );
    assertRegression(response);
    return `regression rows=${response.rows.length}`;
  } catch (err) {
    if (isPlanGate(err)) return `${err.name} (${err.status})`;
    throw err;
  }
}

async function rawLatencyPercentileQuestion(
  ctx: TestContext,
  percentile: LatencyPercentile,
): Promise<string> {
  const series = await getLatencySeries(ctx, percentile);
  assertTimeseries(series);
  const values = countNonNullPoints(series.points);
  if (REQUIRE_DATA) {
    assert(series.meta.sampleCount > 0, `expected ${percentile} latency samples for ${DEFAULT_RANGE}`);
    assert(values > 0, `expected ${percentile} latency values for ${DEFAULT_RANGE}`);
  }
  return `points=${series.points.length}, values=${values}, sampleCount=${series.meta.sampleCount}`;
}

async function latencyPercentileBandChart(ctx: TestContext): Promise<string> {
  const values = [
    ...latencyChartRows("p50", await getLatencySeries(ctx, "p50")),
    ...latencyChartRows("p95", await getLatencySeries(ctx, "p95")),
    ...latencyChartRows("p99", await getLatencySeries(ctx, "p99")),
  ];
  const artifact = await writeChartSpec(ctx, "latency-percentile-band.vl.json", {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Aggregate voice.user_to_bot_latency percentiles - ${DEFAULT_RANGE}`,
    data: { values },
    mark: { type: "line", point: true },
    encoding: {
      x: { field: "bucketStart", type: "temporal", title: "Time" },
      y: { field: "value", type: "quantitative", title: "Latency (ms)" },
      color: { field: "percentile", type: "nominal", title: "Percentile" },
      tooltip: [
        { field: "bucketStart", type: "temporal", title: "Bucket" },
        { field: "percentile", title: "Percentile" },
        { field: "value", title: "Latency (ms)" },
        { field: "sampleCount", title: "Samples" },
      ],
    },
    width: 760,
    height: 360,
  });
  return `${artifact.filename}, rows=${artifact.values}`;
}

async function latencyThresholdChart(ctx: TestContext): Promise<string> {
  const thresholdMs = Number(process.env.CONVAI_ANALYTICS_E2E_P95_THRESHOLD_MS ?? "3000");
  const values = latencyChartRows("p95", await getLatencySeries(ctx, "p95"));
  const artifact = await writeChartSpec(ctx, "latency-p95-threshold.vl.json", {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `p95 production-readiness threshold - ${DEFAULT_RANGE}`,
    data: {
      values: values.map((row) => ({ ...row, thresholdMs })),
    },
    layer: [
      {
        mark: { type: "line", point: true },
        encoding: {
          x: { field: "bucketStart", type: "temporal", title: "Time" },
          y: { field: "value", type: "quantitative", title: "p95 (ms)" },
          tooltip: [
            { field: "bucketStart", type: "temporal", title: "Bucket" },
            { field: "value", title: "p95 (ms)" },
            { field: "sampleCount", title: "Samples" },
          ],
        },
      },
      {
        mark: { type: "rule", strokeDash: [6, 4], color: "#d62728" },
        encoding: {
          y: { field: "thresholdMs", type: "quantitative", title: "p95 (ms)" },
        },
      },
    ],
    width: 760,
    height: 320,
  });
  return `${artifact.filename}, rows=${artifact.values}, thresholdMs=${thresholdMs}`;
}

async function latencyHeatmapChart(ctx: TestContext): Promise<string> {
  const series = await getLatencySeries(ctx, "p95");
  const values = series.points.map((point) => {
    const date = new Date(point.bucketStart);
    return {
      bucketStart: point.bucketStart,
      day: date.toISOString().slice(0, 10),
      hourUtc: date.getUTCHours(),
      value: point.value,
      sampleCount: series.meta.sampleCount,
    };
  });
  const artifact = await writeChartSpec(ctx, "latency-p95-hour-heatmap.vl.json", {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `p95 latency heatmap - ${DEFAULT_RANGE}`,
    data: { values },
    mark: "rect",
    encoding: {
      x: { field: "hourUtc", type: "ordinal", title: "Hour UTC" },
      y: { field: "day", type: "ordinal", title: "Day" },
      color: { field: "value", type: "quantitative", title: "p95 (ms)" },
      tooltip: [
        { field: "bucketStart", type: "temporal", title: "Bucket" },
        { field: "value", title: "p95 (ms)" },
        { field: "sampleCount", title: "Samples" },
      ],
    },
    width: 720,
    height: { step: 24 },
  });
  return `${artifact.filename}, rows=${artifact.values}`;
}

async function componentLatencyChart(ctx: TestContext): Promise<string> {
  const breakdown = await getComponentLatency(ctx);
  const rows = [...breakdown.rows].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const artifact = await writeChartSpec(ctx, "component-latency-breakdown.vl.json", {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `p95 latency by component - ${DEFAULT_RANGE}`,
    data: { values: rows },
    mark: "bar",
    encoding: {
      y: { field: "group", type: "nominal", sort: "-x", title: "Component" },
      x: { field: "value", type: "quantitative", title: "p95 (ms)" },
      tooltip: [
        { field: "group", title: "Component" },
        { field: "value", title: "p95 (ms)" },
        { field: "sampleCount", title: "Samples" },
      ],
    },
    width: 560,
    height: { step: 28 },
  });
  return `${artifact.filename}, rows=${artifact.values}`;
}

async function componentTopOffenderQuestion(ctx: TestContext): Promise<string> {
  const breakdown = await getComponentLatency(ctx);
  const top = [...breakdown.rows]
    .filter((row) => row.value !== null && row.value !== undefined)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  if (!top) {
    if (REQUIRE_DATA) throw new Error(`expected component latency rows for ${DEFAULT_RANGE}`);
    throw new SkipTest(`no component latency rows for ${DEFAULT_RANGE}`);
  }
  return `top=${top.group}, p95=${top.value}, samples=${top.sampleCount}`;
}

async function interactionWaterfallChart(ctx: TestContext): Promise<string> {
  const trace = await getInteractionTrace(ctx);
  const values = trace.spans.map((span, index) => ({
    index,
    processor: span.processor ?? span.metricName ?? `span ${index + 1}`,
    provider: span.provider,
    model: span.model,
    status: span.status,
    durationMs: span.durationMs,
  }));
  const artifact = await writeChartSpec(ctx, "interaction-latency-waterfall.vl.json", {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Interaction latency waterfall - ${trace.interactionId}`,
    data: { values },
    mark: "bar",
    encoding: {
      y: { field: "processor", type: "nominal", sort: "x", title: "Span" },
      x: { field: "durationMs", type: "quantitative", title: "Duration (ms)" },
      color: { field: "status", type: "nominal", title: "Status" },
      tooltip: [
        { field: "processor", title: "Processor" },
        { field: "provider", title: "Provider" },
        { field: "model", title: "Model" },
        { field: "durationMs", title: "Duration (ms)" },
      ],
    },
    width: 620,
    height: { step: 28 },
  });
  return `${artifact.filename}, spans=${artifact.values}`;
}

async function errorTrendChart(ctx: TestContext): Promise<string> {
  const series = await getErrorTrend(ctx);
  const artifact = await writeChartSpec(ctx, "error-trend.vl.json", {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Error trend - ${DEFAULT_RANGE}`,
    data: { values: series.points },
    mark: { type: "line", point: true },
    encoding: {
      x: { field: "bucketStart", type: "temporal", title: "Time" },
      y: { field: "value", type: "quantitative", title: "Errors" },
      tooltip: [
        { field: "bucketStart", type: "temporal", title: "Bucket" },
        { field: "value", title: "Errors" },
      ],
    },
    width: 720,
    height: 300,
  }, { requireValues: false });
  return `${artifact.filename}, points=${artifact.values}`;
}

async function errorBreakdownChart(ctx: TestContext): Promise<string> {
  const breakdown = await getErrorBreakdown(ctx);
  const artifact = await writeChartSpec(ctx, "error-component-breakdown.vl.json", {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Errors by component - ${DEFAULT_RANGE}`,
    data: { values: breakdown.rows },
    mark: "bar",
    encoding: {
      y: { field: "group", type: "nominal", sort: "-x", title: "Component" },
      x: { field: "sampleCount", type: "quantitative", title: "Error samples" },
      tooltip: [
        { field: "group", title: "Component" },
        { field: "sampleCount", title: "Error samples" },
      ],
    },
    width: 560,
    height: { step: 28 },
  }, { requireValues: false });
  return `${artifact.filename}, rows=${artifact.values}`;
}

async function droppedPersistChart(ctx: TestContext): Promise<string> {
  const series = await getDroppedPersistTrend(ctx);
  const artifact = await writeChartSpec(ctx, "dropped-error-persist.vl.json", {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Dropped error-persist events - ${DEFAULT_RANGE}`,
    data: { values: series.points },
    mark: { type: "line", point: true },
    encoding: {
      x: { field: "bucketStart", type: "temporal", title: "Time" },
      y: { field: "value", type: "quantitative", title: "Events" },
      tooltip: [
        { field: "bucketStart", type: "temporal", title: "Bucket" },
        { field: "value", title: "Events" },
      ],
    },
    width: 720,
    height: 300,
  }, { requireValues: false });
  return `${artifact.filename}, points=${artifact.values}`;
}

async function summaryReliabilityChart(ctx: TestContext): Promise<string> {
  const summary = await getSummary(ctx);
  const values = [
    { signal: "interactions", value: summary.interactions },
    { signal: "sessions", value: summary.sessions },
    { signal: "errors", value: summary.errorCount },
    {
      signal: "error rate percent",
      value: summary.interactions > 0
        ? (summary.errorCount / summary.interactions) * 100
        : 0,
    },
  ];
  const artifact = await writeChartSpec(ctx, "summary-reliability.vl.json", {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Summary reliability - ${DEFAULT_RANGE}`,
    data: { values },
    mark: "bar",
    encoding: {
      x: { field: "signal", type: "nominal", title: "Signal" },
      y: { field: "value", type: "quantitative", title: "Value" },
      tooltip: [
        { field: "signal", title: "Signal" },
        { field: "value", title: "Value" },
      ],
    },
    width: 520,
    height: 300,
  });
  return `${artifact.filename}, rows=${artifact.values}`;
}

async function usageTrendQuestion(ctx: TestContext, metric: UsageMetric): Promise<string> {
  const series = await getUsageSeries(ctx, metric);
  assertTimeseries(series);
  if (REQUIRE_DATA) {
    assert(series.meta.sampleCount > 0, `expected usage samples for ${metric}`);
  }
  return `metric=${metric}, points=${series.points.length}, sampleCount=${series.meta.sampleCount}`;
}

async function usageMultiMetricChart(ctx: TestContext): Promise<string> {
  const values = [
    ...usageChartRows("sessions", await getUsageSeries(ctx, "uniqueSessions")),
    ...usageChartRows("interactions", await getUsageSeries(ctx, "uniqueTurns")),
    ...usageChartRows("unique end users", await getUsageSeries(ctx, "uniqueEndUsers")),
  ];
  const artifact = await writeChartSpec(ctx, "usage-trends.vl.json", {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Usage trends - ${DEFAULT_RANGE}`,
    data: { values },
    mark: { type: "line", point: true },
    encoding: {
      x: { field: "bucketStart", type: "temporal", title: "Time" },
      y: { field: "value", type: "quantitative", title: "Count" },
      color: { field: "metric", type: "nominal", title: "Metric" },
      tooltip: [
        { field: "bucketStart", type: "temporal", title: "Bucket" },
        { field: "metric", title: "Metric" },
        { field: "value", title: "Count" },
      ],
    },
    width: 760,
    height: 340,
  });
  return `${artifact.filename}, rows=${artifact.values}`;
}

async function characterUsageChart(ctx: TestContext): Promise<string> {
  const breakdown = await getCharacterUsage(ctx);
  const artifact = await writeChartSpec(ctx, "character-usage-leaderboard.vl.json", {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Sessions by character - ${DEFAULT_RANGE}`,
    data: { values: breakdown.rows },
    mark: "bar",
    encoding: {
      y: { field: "group", type: "nominal", sort: "-x", title: "Character" },
      x: { field: "sampleCount", type: "quantitative", title: "Session samples" },
      tooltip: [
        { field: "group", title: "Character" },
        { field: "sampleCount", title: "Samples" },
      ],
    },
    width: 620,
    height: { step: 24 },
  });
  return `${artifact.filename}, rows=${artifact.values}`;
}

async function sessionDurationScatterChart(ctx: TestContext): Promise<string> {
  const sessions = await getSessions(ctx);
  const values = sessions.sessions.map((session) => ({
    sessionId: session.sessionId,
    startTime: session.startTime,
    durationSec: session.durationSec,
    interactionCount: session.interactionCount,
    p95EndToEndMs: session.p95EndToEndMs,
  }));
  const artifact = await writeChartSpec(ctx, "session-duration-scatter.vl.json", {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Session duration vs interactions - ${DEFAULT_RANGE}`,
    data: { values },
    mark: { type: "circle", size: 90, opacity: 0.75 },
    encoding: {
      x: { field: "durationSec", type: "quantitative", title: "Duration (sec)" },
      y: { field: "interactionCount", type: "quantitative", title: "Interactions" },
      color: { field: "p95EndToEndMs", type: "quantitative", title: "p95 latency (ms)" },
      tooltip: [
        { field: "sessionId", title: "Session" },
        { field: "startTime", type: "temporal", title: "Start" },
        { field: "durationSec", title: "Duration (sec)" },
        { field: "interactionCount", title: "Interactions" },
        { field: "p95EndToEndMs", title: "p95 (ms)" },
      ],
    },
    width: 620,
    height: 340,
  });
  return `${artifact.filename}, sessions=${artifact.values}`;
}

async function concurrencyEstimateQuestion(ctx: TestContext): Promise<string> {
  const sessions = await getSessions(ctx);
  const rows = estimateConcurrency(sessions.sessions, 5);
  if (REQUIRE_DATA) assert(rows.length > 0, "expected concurrency buckets");
  const peak = rows.reduce((max, row) => Math.max(max, row.activeSessions), 0);
  return `buckets=${rows.length}, peakActiveSessions=${peak}`;
}

async function concurrencyChart(ctx: TestContext): Promise<string> {
  const sessions = await getSessions(ctx);
  const values = estimateConcurrency(sessions.sessions, 5);
  const artifact = await writeChartSpec(ctx, "active-session-concurrency.vl.json", {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Estimated active sessions / LiveKit room pressure - ${DEFAULT_RANGE}`,
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
  });
  return `${artifact.filename}, buckets=${artifact.values}`;
}

async function peakConcurrencyChart(ctx: TestContext): Promise<string> {
  const sessions = await getSessions(ctx);
  const values = estimateConcurrency(sessions.sessions, 5);
  const peak = values.reduce((max, row) => Math.max(max, row.activeSessions), 0);
  const artifact = await writeChartSpec(ctx, "peak-concurrency-annotation.vl.json", {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Peak active sessions - ${DEFAULT_RANGE}`,
    data: { values: values.map((row) => ({ ...row, peak })) },
    layer: [
      {
        mark: { type: "line", point: true },
        encoding: {
          x: { field: "bucketStart", type: "temporal", title: "Time" },
          y: { field: "activeSessions", type: "quantitative", title: "Active sessions" },
        },
      },
      {
        mark: { type: "rule", strokeDash: [6, 4], color: "#d62728" },
        encoding: {
          y: { field: "peak", type: "quantitative", title: "Active sessions" },
        },
      },
    ],
    width: 760,
    height: 300,
  });
  return `${artifact.filename}, peak=${peak}, buckets=${artifact.values}`;
}

async function ttsProviderChart(ctx: TestContext): Promise<string> {
  const breakdown = await getTtsProviderBreakdown(ctx);
  const artifact = await writeChartSpec(ctx, "tts-provider-attribution.vl.json", {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `TTS provider attribution - ${DEFAULT_RANGE}`,
    data: { values: breakdown.rows },
    mark: "bar",
    encoding: {
      y: { field: "group", type: "nominal", sort: "-x", title: "Voice provider" },
      x: { field: "sampleCount", type: "quantitative", title: "Samples" },
      tooltip: [
        { field: "group", title: "Voice provider" },
        { field: "sampleCount", title: "Samples" },
      ],
    },
    width: 560,
    height: { step: 28 },
  }, { requireValues: false });
  return `${artifact.filename}, rows=${artifact.values}`;
}

async function llmModelLatencyChart(ctx: TestContext): Promise<string> {
  const breakdown = await getLlmModelLatency(ctx);
  const artifact = await writeChartSpec(ctx, "llm-model-latency.vl.json", {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `LLM model p95 latency - ${DEFAULT_RANGE}`,
    data: { values: breakdown.rows },
    mark: "bar",
    encoding: {
      y: { field: "group", type: "nominal", sort: "-x", title: "Model" },
      x: { field: "value", type: "quantitative", title: "p95 (ms)" },
      tooltip: [
        { field: "group", title: "Model" },
        { field: "value", title: "p95 (ms)" },
        { field: "sampleCount", title: "Samples" },
      ],
    },
    width: 620,
    height: { step: 28 },
  }, { requireValues: false });
  return `${artifact.filename}, rows=${artifact.values}`;
}

async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!(err instanceof RateLimitError)) throw err;
    const waitMs = Math.max(err.retryAfter ?? 65, 2) * 1000;
    await sleep(waitMs);
    return await fn();
  }
}

async function getSummary(ctx: TestContext): Promise<SummaryResponse> {
  ctx.summary ??= await withRateLimitRetry(() => ctx.client.summary({ range: DEFAULT_RANGE }));
  return ctx.summary;
}

async function getCatalog(ctx: TestContext): Promise<CatalogResponse> {
  ctx.catalog ??= await withRateLimitRetry(() => ctx.client.catalog());
  return ctx.catalog;
}

async function getLatencySeries(
  ctx: TestContext,
  percentile: LatencyPercentile,
): Promise<TimeseriesResponse> {
  const cache = (ctx.latencySeries ??= {});
  if (!cache[percentile]) {
    cache[percentile] = await withRateLimitRetry(() =>
      ctx.client.timeseries({
        range: DEFAULT_RANGE,
        measure: latencyMeasure(percentile),
        metricName: "voice.user_to_bot_latency",
        granularity: "hour",
      }),
    );
  }
  return cache[percentile]!;
}

async function getComponentLatency(ctx: TestContext): Promise<BreakdownResponse> {
  ctx.componentLatency ??= await withRateLimitRetry(() =>
    ctx.client.latency.byComponent({ range: DEFAULT_RANGE }),
  );
  return ctx.componentLatency;
}

async function getSessions(ctx: TestContext): Promise<SessionListResponse> {
  ctx.sessions ??= await withRateLimitRetry(() =>
    ctx.client.sessions.list({ range: DEFAULT_RANGE, sort: "slowest", limit: 25 }),
  );
  return ctx.sessions;
}

async function getInteractionTrace(ctx: TestContext): Promise<InteractionTrace> {
  if (ctx.interactionTrace) return ctx.interactionTrace;
  const { interactionId } = await getDrilldownTarget(ctx);
  ctx.interactionTrace = await withRateLimitRetry(() => ctx.client.interactions.get(interactionId));
  return ctx.interactionTrace;
}

async function getDrilldownTarget(ctx: TestContext): Promise<DrilldownTarget> {
  const sessions = await getSessions(ctx);
  assertSessionList(sessions);
  if (sessions.sessions.length === 0) {
    if (REQUIRE_DATA) throw new Error(`expected sessions for ${DEFAULT_RANGE}`);
    throw new SkipTest(`no sessions for ${DEFAULT_RANGE}`);
  }

  const scannedSessionIds: string[] = [];
  for (const session of sessions.sessions) {
    const detail = ctx.sessionDetail?.sessionId === session.sessionId
      ? ctx.sessionDetail
      : await withRateLimitRetry(() => ctx.client.sessions.get(session.sessionId));
    assertSessionDetail(detail);
    scannedSessionIds.push(session.sessionId);
    const interactionId = detail.events.find((event) => event.interactionId)?.interactionId;
    if (interactionId) {
      ctx.sessionDetail = detail;
      return { session, detail, interactionId };
    }
    if (REQUEST_DELAY_MS > 0) await sleep(Math.min(REQUEST_DELAY_MS, 1_000));
  }

  const message = `no session with an interaction id in ${sessions.sessions.length} candidate timelines`;
  if (REQUIRE_DATA) throw new Error(`${message}: ${scannedSessionIds.join(", ")}`);
  throw new SkipTest(message);
}

async function getErrorTrend(ctx: TestContext): Promise<TimeseriesResponse> {
  ctx.errorTrend ??= await withRateLimitRetry(() =>
    ctx.client.errors.overTime({ range: DEFAULT_RANGE, granularity: "day" }),
  );
  return ctx.errorTrend;
}

async function getErrorBreakdown(ctx: TestContext): Promise<BreakdownResponse> {
  ctx.errorBreakdown ??= await withRateLimitRetry(() =>
    ctx.client.breakdown({
      range: DEFAULT_RANGE,
      measure: "count",
      metricNamePrefix: "error.",
      groupBy: "processor",
      limit: 20,
    }),
  );
  return ctx.errorBreakdown;
}

async function getDroppedPersistTrend(ctx: TestContext): Promise<TimeseriesResponse> {
  ctx.droppedPersistTrend ??= await withRateLimitRetry(() =>
    ctx.client.timeseries({
      range: DEFAULT_RANGE,
      measure: "count",
      metricName: "db.error_persist_dropped",
      granularity: "day",
    }),
  );
  return ctx.droppedPersistTrend;
}

async function getStatusBreakdown(ctx: TestContext): Promise<BreakdownResponse> {
  ctx.statusBreakdown ??= await withRateLimitRetry(() =>
    ctx.client.breakdown({
      range: DEFAULT_RANGE,
      measure: "count",
      groupBy: "status",
      limit: 20,
    }),
  );
  return ctx.statusBreakdown;
}

async function getUsageSeries(ctx: TestContext, metric: UsageMetric): Promise<TimeseriesResponse> {
  const cache = (ctx.usageSeries ??= {});
  if (!cache[metric]) {
    cache[metric] = await withRateLimitRetry(() =>
      ctx.client.timeseries({
        range: DEFAULT_RANGE,
        measure: metric,
        granularity: "day",
      }),
    );
  }
  return cache[metric]!;
}

async function getCharacterUsage(ctx: TestContext): Promise<BreakdownResponse> {
  ctx.characterUsage ??= await withRateLimitRetry(() =>
    ctx.client.breakdown({
      range: DEFAULT_RANGE,
      measure: "uniqueSessions",
      groupBy: "characterId",
      limit: 20,
    }),
  );
  return ctx.characterUsage;
}

async function getTtsProviderBreakdown(ctx: TestContext): Promise<BreakdownResponse> {
  ctx.ttsProviderBreakdown ??= await withRateLimitRetry(() =>
    ctx.client.breakdown({
      range: DEFAULT_RANGE,
      measure: "count",
      metricName: "tts.voice_provider",
      groupBy: "voiceProvider",
      limit: 10,
    }),
  );
  return ctx.ttsProviderBreakdown;
}

async function getLlmModelLatency(ctx: TestContext): Promise<BreakdownResponse> {
  ctx.llmModelLatency ??= await withRateLimitRetry(() =>
    ctx.client.breakdown({
      range: DEFAULT_RANGE,
      measure: "p95Value",
      metricNamePrefix: "LLMService.",
      groupBy: "model",
      limit: 10,
    }),
  );
  return ctx.llmModelLatency;
}

function latencyMeasure(percentile: LatencyPercentile): "p50Value" | "p95Value" | "p99Value" {
  switch (percentile) {
    case "p50":
      return "p50Value";
    case "p95":
      return "p95Value";
    case "p99":
      return "p99Value";
  }
}

function latencyChartRows(
  percentile: LatencyPercentile,
  series: TimeseriesResponse,
): LatencyChartRow[] {
  return series.points.map((point: TimeseriesPoint) => ({
    bucketStart: point.bucketStart,
    percentile,
    value: point.value,
    sampleCount: series.meta.sampleCount,
  }));
}

function usageChartRows(metric: string, series: TimeseriesResponse): UsageChartRow[] {
  return series.points.map((point: TimeseriesPoint) => ({
    bucketStart: point.bucketStart,
    metric,
    value: point.value,
    sampleCount: series.meta.sampleCount,
  }));
}

function estimateConcurrency(sessions: SessionSummary[], bucketMinutes: number): ConcurrencyRow[] {
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

async function writeChartSpec(
  ctx: TestContext,
  filename: string,
  spec: VegaLiteSpec,
  options: { requireValues?: boolean } = {},
): Promise<ChartArtifact> {
  assertChartSpec(spec);
  const values = countChartValues(spec);
  const requireValues = options.requireValues ?? true;
  if (REQUIRE_DATA && requireValues) assert(values > 0, `${filename} should include chart values`);
  await writeFile(join(ctx.chartDir, filename), JSON.stringify(spec, null, 2) + "\n");
  return { filename, values };
}

function assertChartSpec(spec: VegaLiteSpec): void {
  assert(
    spec.$schema === "https://vega.github.io/schema/vega-lite/v5.json",
    "chart spec must use Vega-Lite v5 schema",
  );
  assert(Boolean(spec.mark) || Array.isArray(spec.layer), "chart spec must have mark or layer");
  assert(countChartValues(spec) >= 0, "chart values must be countable");
  if (spec.mark) {
    assert(spec.encoding && typeof spec.encoding === "object", "marked chart must have encoding");
  }
}

function countChartValues(spec: VegaLiteSpec): number {
  let count = spec.data?.values.length ?? 0;
  for (const layer of spec.layer ?? []) {
    if (layer && typeof layer === "object" && "data" in layer) {
      const data = (layer as { data?: { values?: unknown[] } }).data;
      count += data?.values?.length ?? 0;
    }
  }
  return count;
}

function countNonNullPoints(points: TimeseriesPoint[]): number {
  return points.filter((point) => point.value !== null && point.value !== undefined).length;
}

function assertSummary(value: SummaryResponse): void {
  assertNonNegativeNumber(value.sessions, "summary.sessions");
  assertNonNegativeNumber(value.interactions, "summary.interactions");
  assertNonNegativeNumber(value.uniqueEndUsers, "summary.uniqueEndUsers");
  assertMeta(value.meta);
}

function assertCatalog(value: CatalogResponse): void {
  assert(Array.isArray(value.metrics), "catalog.metrics must be an array");
  assert(value.metrics.length > 0, "catalog must include at least one metric");
  assertMeta(value.meta);
}

function assertTimeseries(value: TimeseriesResponse): void {
  assert(Array.isArray(value.points), "timeseries.points must be an array");
  assert(["minute", "hour", "day"].includes(value.granularity), "invalid granularity");
  for (const point of value.points) {
    assert(typeof point.bucketStart === "string", "point.bucketStart must be a string");
    if (point.value !== null && point.value !== undefined) {
      assertNonNegativeNumber(point.value, "point.value");
    }
  }
  assertMeta(value.meta);
}

function assertBreakdown(value: BreakdownResponse): void {
  assert(Array.isArray(value.rows), "breakdown.rows must be an array");
  for (const row of value.rows) {
    assert(typeof row.group === "string", "breakdown row group must be a string");
    assertNonNegativeNumber(row.sampleCount, "breakdown row sampleCount");
    if (row.value !== null && row.value !== undefined) {
      assertNonNegativeNumber(row.value, "breakdown row value");
    }
  }
  assertMeta(value.meta);
}

function assertSessionList(value: SessionListResponse): void {
  assert(Array.isArray(value.sessions), "sessions.sessions must be an array");
  for (const session of value.sessions) {
    assert(typeof session.sessionId === "string", "sessionId must be a string");
    assertNonNegativeNumber(session.interactionCount, "session.interactionCount");
    assertNonNegativeNumber(session.durationSec, "session.durationSec");
  }
  assertMeta(value.meta);
}

function assertSessionDetail(value: SessionDetail): void {
  assert(typeof value.sessionId === "string", "session detail sessionId must be a string");
  assert(Array.isArray(value.events), "session detail events must be an array");
  assert(value.events.length > 0, "session detail should include events");
  for (const event of value.events) {
    assert(typeof event.metricName === "string", "event metricName must be a string");
    assert(typeof event.eventTime === "string", "event eventTime must be a string");
  }
  assertMeta(value.meta);
}

function assertCubeResponse(value: CubeQueryResponse): void {
  assert(Array.isArray(value.data), "query data must be an array");
  assertMeta(value.meta);
}

function assertRegression(value: RegressionDetectionResponse): void {
  assert(Array.isArray(value.rows), "regression rows must be an array");
  for (const row of value.rows) {
    assertNonNegativeNumber(row.sampleCount, "regression sampleCount");
  }
  assertMeta(value.meta);
}

function assertMeta(meta: { sampleCount: number; cacheHit: boolean; backend: string }): void {
  assertNonNegativeNumber(meta.sampleCount, "meta.sampleCount");
  assert(typeof meta.cacheHit === "boolean", "meta.cacheHit must be boolean");
  assert(meta.backend === "cube" || meta.backend === "bq", "meta.backend must be cube or bq");
}

function assertNonNegativeNumber(value: number, name: string): void {
  assert(typeof value === "number" && Number.isFinite(value), `${name} must be a finite number`);
  assert(value >= 0, `${name} must be non-negative`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isPlanGate(err: unknown): err is PlanRequiredError | PlanInsufficientError {
  return err instanceof PlanRequiredError || err instanceof PlanInsufficientError;
}

function isLatencyLikeSpan(span: ComponentSpan): boolean {
  const haystack = [
    span.metricName,
    span.metricType,
    span.processor,
    span.provider,
    span.model,
  ].filter(Boolean).join(" ").toLowerCase();
  return /(latency|duration|ttfb|processing|stt|tts|llm|neurosync|vad|audio|turn)/.test(haystack);
}

function parseRelativeRange(value: string): RelativeRange {
  if ((ALLOWED_RANGES as readonly string[]).includes(value)) return value as RelativeRange;
  throw new Error(
    `CONVAI_ANALYTICS_E2E_RANGE must be one of ${ALLOWED_RANGES.join(", ")}; got ${value}`,
  );
}

function serviceRoot(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function describeError(err: unknown): string {
  if (err instanceof ConvaiAnalyticsError) {
    return `${err.name} status=${err.status} code=${err.code}: ${err.message}`;
  }
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

function printSummary(results: Result[]): void {
  for (const result of results) {
    const label = result.outcome.toUpperCase().padEnd(4, " ");
    console.log(`${label} ${result.name} - ${result.detail}`);
  }

  const pass = results.filter((r) => r.outcome === "pass").length;
  const skip = results.filter((r) => r.outcome === "skip").length;
  const fail = results.filter((r) => r.outcome === "fail").length;
  console.log(`\nStaging E2E: ${pass} passed, ${skip} skipped, ${fail} failed`);
}

void main().catch((err) => {
  console.error(describeError(err));
  process.exitCode = 1;
});
