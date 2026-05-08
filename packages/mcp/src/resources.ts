import type { ConvaiAnalytics } from "@convai/analytics";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type ClientFactory = () => ConvaiAnalytics;

export const RESOURCE_URIS = [
  "convai://analytics/docs/concepts",
  "convai://analytics/docs/metrics-reference",
  "convai://analytics/docs/authentication",
  "convai://analytics/catalog",
] as const;

const RESOURCE_TEXT: Record<string, string> = {
  "convai://analytics/docs/concepts": `# Convai Analytics Concepts

Convai Analytics is account-scoped telemetry for production character experiences. Use it to answer customer questions about sessions, interactions, latency, reliability, provider/model performance, character usage, and end-user reach.

The headline latency metric is voice.user_to_bot_latency. It measures end-to-end latency from the end-user audio input side to the first bot audio byte. Use P50/P95/P99 for aggregate latency distribution, and interaction traces for per-request breakdowns.

Core entities:
- A session is a user-character conversation window.
- An interaction is a single request/response turn inside a session.
- A component span is one processor/provider/model portion of an interaction, such as LLM, TTS, STT, VAD, NeuroSync, transport, memory, or moderation.
- Unique end users are available when the application sends a stable end_user_id, for example through speaker id integration.

Prefer curated MCP tools for common questions. Use advanced_query only when a question cannot be answered by summary, timeseries, breakdown, sessions, interactions, or the convenience tools.`,
  "convai://analytics/docs/metrics-reference": `# Convai Analytics Metrics Reference

Common metrics and measures:
- voice.user_to_bot_latency: headline end-to-end latency for user to first bot audio byte.
- db.error_persist_dropped: dropped error-persistence event count.
- tts.voice_provider: TTS provider attribution.
- LLMService.*: LLM model/provider latency family.

Common measures:
- count: sample count or event count.
- uniqueSessions: distinct sessions.
- uniqueTurns: distinct interactions/turns.
- uniqueEndUsers: distinct end users when end_user_id is supplied.
- p50Value, p95Value, p99Value: raw value percentiles for latency metrics.

Common dimensions:
- processor, provider, voiceProvider, model, characterId, appKey, experienceId, endUserId, status.

For production readiness, start with get_latency_percentile_chart, get_latency_threshold_chart, get_component_latency_breakdown, and get_error_trend.`,
  "convai://analytics/docs/authentication": `# Convai Analytics Authentication

Set CONVAI_API_KEY to a Convai API key for the account you want to analyze. The MCP server sends this key only to the public Convai Analytics API through the public TypeScript SDK.

Optional environment:
- CONVAI_ANALYTICS_BASE_URL: override the analytics API base URL. Leave unset for production.

Security constraints:
- The MCP server does not accept account overrides, service credentials, database URLs, or other internal access paths.
- Account isolation is enforced by the Convai Analytics API from the API key.
- Tool results should never echo CONVAI_API_KEY.`,
};

export function registerResources(server: McpServer, clientFactory: ClientFactory): void {
  server.registerResource(
    "analytics-concepts",
    "convai://analytics/docs/concepts",
    {
      title: "Convai Analytics Concepts",
      description: "Customer-safe overview of analytics entities, latency concepts, and query patterns.",
      mimeType: "text/markdown",
    },
    async (uri) => ({ contents: [{ uri: uri.href, text: RESOURCE_TEXT[uri.href] ?? "" }] }),
  );

  server.registerResource(
    "metrics-reference",
    "convai://analytics/docs/metrics-reference",
    {
      title: "Convai Analytics Metrics Reference",
      description: "Customer-safe metric names, measures, and dimensions used by the MCP tools.",
      mimeType: "text/markdown",
    },
    async (uri) => ({ contents: [{ uri: uri.href, text: RESOURCE_TEXT[uri.href] ?? "" }] }),
  );

  server.registerResource(
    "authentication",
    "convai://analytics/docs/authentication",
    {
      title: "Convai Analytics Authentication",
      description: "How CONVAI_API_KEY is used and which credentials are intentionally unsupported.",
      mimeType: "text/markdown",
    },
    async (uri) => ({ contents: [{ uri: uri.href, text: RESOURCE_TEXT[uri.href] ?? "" }] }),
  );

  server.registerResource(
    "catalog",
    "convai://analytics/catalog",
    {
      title: "Account Metrics Catalog",
      description: "Metrics catalog fetched from the caller's account when CONVAI_API_KEY is available.",
      mimeType: "application/json",
    },
    async (uri) => {
      try {
        const catalog = await clientFactory().catalog();
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(catalog, null, 2),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ error: message }, null, 2),
            },
          ],
        };
      }
    },
  );
}
