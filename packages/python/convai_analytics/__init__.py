"""Convai analytics Python SDK.

Top-level entry point — most users only need:

    from convai_analytics import ConvaiAnalytics
    client = ConvaiAnalytics(api_key=...)
"""

# `__version__` is defined before the imports because `client.py` imports it
# back via `from . import __version__` — defining it after the re-exports
# would create a circular import.
__version__ = "0.2.0"

from .client import ConvaiAnalytics
from .errors import (
    AuthenticationError,
    ConvaiAnalyticsError,
    InvalidRangeError,
    NotFoundError,
    NotYetSupportedError,
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

__all__ = [
    "AuthenticationError",
    "BreakdownResponse",
    "CatalogResponse",
    "ComponentSpan",
    "ConvaiAnalytics",
    "ConvaiAnalyticsError",
    "InteractionTrace",
    "InvalidRangeError",
    "NotFoundError",
    "NotYetSupportedError",
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
