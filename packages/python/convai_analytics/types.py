"""Pydantic models for the analytics API responses.

Response shapes are re-exported from ``_generated.py`` (auto-generated from
``openapi/convai-analytics-api.json``). Param shapes (``RelativeRange``,
``Percentile``, ``Processor``, ``Status``, ``CommonFilters``) are
hand-written: they intentionally narrow the raw OpenAPI query-string
surface to the subset the backend actually honors today.

Field names are ``snake_case`` (Python idiomatic). Generated models accept
both ``snake_case`` and ``camelCase`` payloads via ``populate_by_name=True``
+ alias generation, so ``model_validate`` works on the camelCase JSON the
backend emits as well as on the snake_case dicts ``client.py``'s
``_deep_snake`` produces.
"""

from __future__ import annotations

from typing import Literal

from ._generated import BreakdownResponse as BreakdownResponse
from ._generated import BreakdownRow as BreakdownRow
from ._generated import CatalogResponse as CatalogResponse
from ._generated import ComponentSpan as ComponentSpan
from ._generated import CubeFilter as CubeFilter
from ._generated import CubeQueryRequest as CubeQueryRequest
from ._generated import CubeQueryResponse as CubeQueryResponse
from ._generated import CubeTimeDimension as CubeTimeDimension
from ._generated import EffectiveRange as EffectiveRange
from ._generated import InteractionTrace as InteractionTrace
from ._generated import MetricDefinition as MetricDefinition
from ._generated import RegressionResponse as RegressionDetectionResponse
from ._generated import RegressionRow as RegressionDetectionRow
from ._generated import ResponseMeta as ResponseMeta
from ._generated import SessionDetail as SessionDetail
from ._generated import SessionListResponse as SessionListResponse
from ._generated import SessionSummary as SessionSummary
from ._generated import SessionTimelineEvent as SessionTimelineEvent
from ._generated import SummaryResponse as SummaryResponse
from ._generated import TimeseriesPoint as TimeseriesPoint
from ._generated import TimeseriesResponse as TimeseriesResponse

# Hand-written enum types — narrower than the raw OpenAPI string types
# so that mypy/IDE completions show the actual allowed values.
RelativeRange = Literal["last_15m", "last_1h", "last_6h", "last_24h", "last_7d", "last_30d"]
Percentile = Literal["p50", "p75", "p90", "p95", "p99"]
Status = Literal["ok", "error", "timeout", "cancelled"]
Processor = Literal[
    "asr",
    "vad",
    "stt",
    "llm",
    "knowledge_bank",
    "memory",
    "tts",
    "neurosync",
    "transport",
    "dynamic_context",
    "moderation",
    "emotion",
]

__all__ = [
    "BreakdownResponse",
    "BreakdownRow",
    "CatalogResponse",
    "ComponentSpan",
    "CubeFilter",
    "CubeQueryRequest",
    "CubeQueryResponse",
    "CubeTimeDimension",
    "EffectiveRange",
    "InteractionTrace",
    "MetricDefinition",
    "Percentile",
    "Processor",
    "RegressionDetectionResponse",
    "RegressionDetectionRow",
    "RelativeRange",
    "ResponseMeta",
    "SessionDetail",
    "SessionListResponse",
    "SessionSummary",
    "SessionTimelineEvent",
    "Status",
    "SummaryResponse",
    "TimeseriesPoint",
    "TimeseriesResponse",
]
