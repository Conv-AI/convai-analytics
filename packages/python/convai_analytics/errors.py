"""Typed exception hierarchy for the analytics API."""

from __future__ import annotations

from typing import Any


class ConvaiAnalyticsError(Exception):
    """Base class for all SDK exceptions raised on non-2xx responses."""

    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.details = details or {}


class AuthenticationError(ConvaiAnalyticsError):
    """401 — API key missing or invalid."""


class PlanRequiredError(ConvaiAnalyticsError):
    """402 — caller's plan does not include analytics API access."""


class PlanInsufficientError(ConvaiAnalyticsError):
    """403 — caller has access but the endpoint requires a higher tier."""


class NotFoundError(ConvaiAnalyticsError):
    """404 — resource not found (or not owned by the caller's account)."""


class ValidationError(ConvaiAnalyticsError):
    """422 — request parameters failed validation."""


class RateLimitError(ConvaiAnalyticsError):
    """429 — per-plan rate limit exceeded. ``retry_after`` is in seconds."""

    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        retry_after: int | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(status, code, message, details)
        self.retry_after = retry_after


class ServerError(ConvaiAnalyticsError):
    """5xx — backend failure. Safe to retry with backoff."""


class NotYetSupportedError(ConvaiAnalyticsError):
    """Raised pre-flight when an SDK method targets an endpoint the analytics
    API has not shipped yet. ``status`` is 0 — never leaves the client."""

    def __init__(self, endpoint: str, planned_phase: str) -> None:
        message = (
            f"{endpoint} is not yet implemented by the analytics API "
            f"(planned: {planned_phase}). Track rollout at "
            f"https://github.com/Conv-AI/convai-analytics-api."
        )
        super().__init__(
            0,
            "not_yet_supported",
            message,
            {"endpoint": endpoint, "planned_phase": planned_phase},
        )
        self.endpoint = endpoint
        self.planned_phase = planned_phase


class InvalidRangeError(ConvaiAnalyticsError):
    """Raised pre-flight when a ``range`` argument is not one of the allowed tokens."""

    def __init__(self, received: str, allowed: tuple[str, ...]) -> None:
        message = f"Invalid range '{received}'. Allowed: {', '.join(allowed)}."
        super().__init__(
            0,
            "invalid_range",
            message,
            {"received": received, "allowed": list(allowed)},
        )
        self.received = received
        self.allowed = allowed


def error_from_response(
    status: int,
    payload: dict[str, Any],
    retry_after: int | None = None,
) -> ConvaiAnalyticsError:
    err = payload.get("error") or {"code": "unknown_error", "message": str(payload)}
    code = err.get("code", "unknown_error")
    message = err.get("message", "Unknown error")
    details = err.get("details")

    if status == 401:
        return AuthenticationError(status, code, message, details)
    if status == 402:
        return PlanRequiredError(status, code, message, details)
    if status == 403:
        return PlanInsufficientError(status, code, message, details)
    if status == 404:
        return NotFoundError(status, code, message, details)
    if status == 422:
        return ValidationError(status, code, message, details)
    if status == 429:
        return RateLimitError(status, code, message, retry_after, details)
    if status >= 500:
        return ServerError(status, code, message, details)
    return ConvaiAnalyticsError(status, code, message, details)
