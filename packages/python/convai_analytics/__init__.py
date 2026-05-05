"""Convai analytics Python SDK.

Top-level entry point — most users only need:

    from convai_analytics import ConvaiAnalytics
    client = ConvaiAnalytics(api_key=...)
"""

from .client import ConvaiAnalytics
from .errors import (
    AuthenticationError,
    ConvaiAnalyticsError,
    NotFoundError,
    PlanInsufficientError,
    PlanRequiredError,
    RateLimitError,
    ServerError,
    ValidationError,
)
from .types import (
    BreakdownResponse,
    CatalogResponse,
    ComponentSpan,
    InteractionTrace,
    SessionDetail,
    SessionListResponse,
    SessionSummary,
    SessionTimelineEvent,
    SummaryResponse,
    TimeseriesResponse,
)

__version__ = "0.0.1"

__all__ = [
    "AuthenticationError",
    "BreakdownResponse",
    "CatalogResponse",
    "ComponentSpan",
    "ConvaiAnalytics",
    "ConvaiAnalyticsError",
    "InteractionTrace",
    "NotFoundError",
    "PlanInsufficientError",
    "PlanRequiredError",
    "RateLimitError",
    "ServerError",
    "SessionDetail",
    "SessionListResponse",
    "SessionSummary",
    "SessionTimelineEvent",
    "SummaryResponse",
    "TimeseriesResponse",
    "ValidationError",
]
