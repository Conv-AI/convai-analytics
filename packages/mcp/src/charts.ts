import type {
  BreakdownResponse,
  InteractionTrace,
  SessionSummary,
  SummaryResponse,
  TimeseriesResponse,
} from "@convai/analytics";

export interface VegaLiteSpec {
  $schema: "https://vega.github.io/schema/vega-lite/v5.json";
  title?: string;
  data?: { values: unknown[] };
  mark?: unknown;
  encoding?: Record<string, unknown>;
  layer?: unknown[];
  width?: number;
  height?: number | { step: number };
  transform?: unknown[];
  config?: Record<string, unknown>;
}

export type LatencyPercentile = "p50" | "p95" | "p99";

export interface ConcurrencyRow {
  bucketStart: string;
  activeSessions: number;
}

export function latencyMeasure(percentile: LatencyPercentile): "p50Value" | "p95Value" | "p99Value" {
  switch (percentile) {
    case "p50":
      return "p50Value";
    case "p95":
      return "p95Value";
    case "p99":
      return "p99Value";
  }
}

export function latencyRows(percentile: LatencyPercentile, series: TimeseriesResponse): unknown[] {
  return series.points.map((point) => ({
    bucketStart: point.bucketStart,
    percentile,
    value: point.value,
    sampleCount: series.meta.sampleCount,
  }));
}

export function usageRows(metric: string, series: TimeseriesResponse): unknown[] {
  return series.points.map((point) => ({
    bucketStart: point.bucketStart,
    metric,
    value: point.value,
    sampleCount: series.meta.sampleCount,
  }));
}

export function latencyPercentileChart(values: unknown[], range: string): VegaLiteSpec {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Aggregate voice.user_to_bot_latency percentiles - ${range}`,
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
  };
}

export function latencyThresholdChart(
  values: unknown[],
  range: string,
  thresholdMs: number,
): VegaLiteSpec {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `p95 production-readiness threshold - ${range}`,
    data: {
      values: values.map((row) => ({ ...(row as Record<string, unknown>), thresholdMs })),
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
  };
}

export function latencyHeatmapChart(series: TimeseriesResponse, range: string): VegaLiteSpec {
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
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `p95 latency heatmap - ${range}`,
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
  };
}

export function componentLatencyChart(breakdown: BreakdownResponse, range: string): VegaLiteSpec {
  const values = [...breakdown.rows].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `p95 latency by component - ${range}`,
    data: { values },
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
  };
}

export function interactionWaterfallChart(trace: InteractionTrace): VegaLiteSpec {
  const values = trace.spans.map((span, index) => ({
    index,
    processor: span.processor ?? span.metricName ?? `span ${index + 1}`,
    provider: span.provider,
    model: span.model,
    status: span.status,
    durationMs: span.durationMs,
  }));
  return {
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
  };
}

export function errorTrendChart(series: TimeseriesResponse, range: string): VegaLiteSpec {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Error trend - ${range}`,
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
  };
}

export function errorBreakdownChart(breakdown: BreakdownResponse, range: string): VegaLiteSpec {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Errors by component - ${range}`,
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
  };
}

export function droppedPersistChart(series: TimeseriesResponse, range: string): VegaLiteSpec {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Dropped error-persist events - ${range}`,
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
  };
}

export function summaryReliabilityChart(summary: SummaryResponse, range: string): VegaLiteSpec {
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
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Summary reliability - ${range}`,
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
  };
}

export function usageTrendsChart(values: unknown[], range: string): VegaLiteSpec {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Usage trends - ${range}`,
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
  };
}

export function characterUsageChart(breakdown: BreakdownResponse, range: string): VegaLiteSpec {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Sessions by character - ${range}`,
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
  };
}

export function sessionDurationScatterChart(sessions: SessionSummary[], range: string): VegaLiteSpec {
  const values = sessions.map((session) => ({
    sessionId: session.sessionId,
    startTime: session.startTime,
    durationSec: session.durationSec,
    interactionCount: session.interactionCount,
    p95EndToEndMs: session.p95EndToEndMs,
  }));
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Session duration vs interactions - ${range}`,
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
  };
}

export function estimateConcurrency(
  sessions: SessionSummary[],
  bucketMinutes: number,
): ConcurrencyRow[] {
  const bucketMs = bucketMinutes * 60_000;
  const bounds = sessions.flatMap((session) => {
    if (!session.startTime) return [];
    const start = Date.parse(session.startTime);
    const end = session.endTime
      ? Date.parse(session.endTime)
      : start + Math.max(session.durationSec ?? 0, bucketMinutes * 60) * 1000;
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
        : sessionStart + Math.max(session.durationSec ?? 0, bucketMinutes * 60) * 1000;
      return sessionStart < bucket + bucketMs && sessionEnd > bucket;
    }).length;
    rows.push({ bucketStart: new Date(bucket).toISOString(), activeSessions });
  }
  return rows;
}

export function activeSessionConcurrencyChart(values: ConcurrencyRow[], range: string): VegaLiteSpec {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Estimated active sessions / LiveKit room pressure - ${range}`,
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
  };
}

export function peakConcurrencyChart(values: ConcurrencyRow[], range: string): VegaLiteSpec {
  const peak = values.reduce((max, row) => Math.max(max, row.activeSessions), 0);
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `Peak active sessions - ${range}`,
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
  };
}

export function ttsProviderChart(breakdown: BreakdownResponse, range: string): VegaLiteSpec {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `TTS provider attribution - ${range}`,
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
  };
}

export function llmModelLatencyChart(breakdown: BreakdownResponse, range: string): VegaLiteSpec {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: `LLM model p95 latency - ${range}`,
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
  };
}
