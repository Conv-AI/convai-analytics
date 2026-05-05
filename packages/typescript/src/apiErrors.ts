/**
 * Typed exception hierarchy for the analytics API. The HTTP transport in
 * `client.ts` raises one of these on every non-2xx response so callers can
 * `instanceof` rather than parse status codes.
 */

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class ConvaiAnalyticsError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ConvaiAnalyticsError";
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
  }
}

export class AuthenticationError extends ConvaiAnalyticsError {
  constructor(payload: ApiErrorPayload) {
    super(401, payload);
    this.name = "AuthenticationError";
  }
}

/** 402 — caller's plan does not include analytics API access at all. */
export class PlanRequiredError extends ConvaiAnalyticsError {
  constructor(payload: ApiErrorPayload) {
    super(402, payload);
    this.name = "PlanRequiredError";
  }
}

/** 403 — caller has API access but the specific endpoint requires a higher tier. */
export class PlanInsufficientError extends ConvaiAnalyticsError {
  constructor(payload: ApiErrorPayload) {
    super(403, payload);
    this.name = "PlanInsufficientError";
  }
}

export class NotFoundError extends ConvaiAnalyticsError {
  constructor(payload: ApiErrorPayload) {
    super(404, payload);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends ConvaiAnalyticsError {
  constructor(payload: ApiErrorPayload) {
    super(422, payload);
    this.name = "ValidationError";
  }
}

export class RateLimitError extends ConvaiAnalyticsError {
  /** Seconds the caller should wait before retrying, parsed from `Retry-After`. */
  readonly retryAfter?: number;

  constructor(payload: ApiErrorPayload, retryAfter?: number) {
    super(429, payload);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class ServerError extends ConvaiAnalyticsError {
  constructor(status: number, payload: ApiErrorPayload) {
    super(status, payload);
    this.name = "ServerError";
  }
}

export function errorFromResponse(
  status: number,
  payload: ApiErrorPayload,
  retryAfter?: number,
): ConvaiAnalyticsError {
  switch (status) {
    case 401:
      return new AuthenticationError(payload);
    case 402:
      return new PlanRequiredError(payload);
    case 403:
      return new PlanInsufficientError(payload);
    case 404:
      return new NotFoundError(payload);
    case 422:
      return new ValidationError(payload);
    case 429:
      return new RateLimitError(payload, retryAfter);
    default:
      if (status >= 500) return new ServerError(status, payload);
      return new ConvaiAnalyticsError(status, payload);
  }
}
