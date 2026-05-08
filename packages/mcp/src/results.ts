import {
  AuthenticationError,
  ConvaiAnalyticsError,
  PlanInsufficientError,
  PlanRequiredError,
  RateLimitError,
  ValidationError,
} from "@convai/analytics";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface ToolErrorPayload {
  error: {
    type: string;
    message: string;
    status?: number;
    code?: string;
    requiredPlan?: string;
    retryAfter?: number;
  };
}

export function jsonResult(payload: unknown): CallToolResult {
  const structuredContent = isRecord(payload) ? payload : { result: payload };
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent,
  };
}

export function errorResult(err: unknown): CallToolResult {
  const payload = toToolErrorPayload(err);
  return {
    content: [{ type: "text", text: formatToolError(payload) }],
    structuredContent: payload as unknown as Record<string, unknown>,
    isError: true,
  };
}

export function requireApiKey(env: NodeJS.ProcessEnv): string {
  const apiKey = env.CONVAI_API_KEY;
  if (!apiKey) {
    throw new Error("CONVAI_API_KEY is required to query Convai analytics.");
  }
  return apiKey;
}

function toToolErrorPayload(err: unknown): ToolErrorPayload {
  if (err instanceof PlanRequiredError || err instanceof PlanInsufficientError) {
    const requiredPlan = inferRequiredPlan(err);
    return {
      error: {
        type: err.name,
        status: err.status,
        code: err.code,
        message: `${sanitize(err.message)} Required plan: ${requiredPlan}.`,
        requiredPlan,
      },
    };
  }

  if (err instanceof AuthenticationError || err instanceof ValidationError) {
    return {
      error: {
        type: err.name,
        status: err.status,
        code: err.code,
        message: sanitize(err.message),
      },
    };
  }

  if (err instanceof RateLimitError) {
    return {
      error: {
        type: err.name,
        status: err.status,
        code: err.code,
        message: sanitize(err.message),
        retryAfter: err.retryAfter,
      },
    };
  }

  if (err instanceof ConvaiAnalyticsError) {
    return {
      error: {
        type: err.name,
        status: err.status,
        code: err.code,
        message: sanitize(err.message),
      },
    };
  }

  if (err instanceof Error) {
    return { error: { type: err.name || "Error", message: sanitize(err.message) } };
  }

  return { error: { type: "Error", message: sanitize(String(err)) } };
}

function inferRequiredPlan(err: PlanRequiredError | PlanInsufficientError): string {
  const details = err.details ?? {};
  const value =
    details.required_plan ??
    details.requiredPlan ??
    details.plan ??
    details.minimum_plan ??
    details.minimumPlan;
  if (typeof value === "string" && value.length > 0) return value;
  return err instanceof PlanRequiredError ? "Scale or higher" : "Business or higher";
}

function formatToolError(payload: ToolErrorPayload): string {
  const { error } = payload;
  const status = error.status ? ` ${error.status}` : "";
  const code = error.code ? ` ${error.code}` : "";
  return `${error.type}${status}${code}: ${error.message}`;
}

function sanitize(message: string): string {
  const apiKey = process.env.CONVAI_API_KEY;
  let clean = message;
  if (apiKey) clean = clean.split(apiKey).join("[redacted]");
  return clean.replace(/(api[_-]?key=)[^&\s]+/gi, "$1[redacted]");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
