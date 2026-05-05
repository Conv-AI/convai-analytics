"""Pydantic models for the analytics API responses.

Hand-written for now; will be regenerated from the OpenAPI spec once
Phase 4 of ``convai-analytics-api`` lands real schemas. Field names are
``snake_case`` (Python idiomatic); the HTTP transport converts
``camelCase`` wire payloads to ``snake_case`` automatically.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

# ---------- shared ----------

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


class ResponseMeta(BaseModel):
    """Server-attached metadata on every response — explainability."""

    freshness_at: str
    sample_count: int
    effective_range: dict[str, str]
    backend: Literal["cube", "bq"] | None = None
    cache_hit: bool | None = None


# ---------- summary ----------


class SummaryResponse(BaseModel):
    sessions: int
    unique_end_users: int
    interactions: int
    error_count: int
    p50_end_to_end_ms: float
    p95_end_to_end_ms: float
    p99_end_to_end_ms: float
    meta: ResponseMeta


# ---------- timeseries ----------


class TimeseriesPoint(BaseModel):
    bucket_start: str
    group: str | None = None
    value: float | None


class TimeseriesResponse(BaseModel):
    measure: str
    granularity: Literal["minute", "hour", "day"]
    points: list[TimeseriesPoint]
    meta: ResponseMeta


# ---------- breakdown ----------


class BreakdownRow(BaseModel):
    group: str
    value: float | None
    sample_count: int


class BreakdownResponse(BaseModel):
    measure: str
    group_by: str
    rows: list[BreakdownRow]
    meta: ResponseMeta


# ---------- sessions ----------


class SessionSummary(BaseModel):
    session_id: str
    character_id: str
    app_key: str
    experience_id: str | None = None
    start_time: str
    end_time: str
    duration_sec: float
    interaction_count: int
    p95_end_to_end_ms: float
    error_count: int


class SessionListResponse(BaseModel):
    sessions: list[SessionSummary]
    next_cursor: str | None = None
    meta: ResponseMeta


class SessionTimelineEvent(BaseModel):
    event_time: str
    metric_name: str
    metric_type: str
    processor: Processor | None = None
    interaction_id: str | None = None
    status: Status | None = None
    value: float | None = None
    attributes: dict[str, Any] | None = None


class SessionDetail(BaseModel):
    session_id: str
    character_id: str
    app_key: str
    experience_id: str | None = None
    start_time: str
    end_time: str
    events: list[SessionTimelineEvent]
    meta: ResponseMeta


# ---------- interactions ----------


class ComponentSpan(BaseModel):
    processor: Processor
    start_time: str
    end_time: str
    duration_ms: float
    status: Status
    provider: str | None = None
    model: str | None = None
    error_code: str | None = None
    attributes: dict[str, Any] | None = None


class InteractionTrace(BaseModel):
    interaction_id: str
    session_id: str
    character_id: str
    app_key: str
    end_user_id: str | None = None
    interaction_type: str
    start_time: str
    end_time: str
    total_duration_ms: float
    terminal_status: Status
    failure_stage: Processor | None = None
    spans: list[ComponentSpan]
    meta: ResponseMeta


# ---------- catalog ----------


class MetricDefinition(BaseModel):
    metric_name: str
    metric_type: str
    unit: str | None = None
    description: str
    visibility: Literal["public", "enterprise", "internal"]
    supports_percentiles: bool


class CatalogResponse(BaseModel):
    metrics: list[MetricDefinition]
    meta: ResponseMeta


# ---------- advanced ----------


class RegressionDetectionRow(BaseModel):
    group: str
    baseline_value: float
    current_value: float
    relative_change: float
    significant: bool


class RegressionDetectionResponse(BaseModel):
    rows: list[RegressionDetectionRow]
    meta: ResponseMeta


class CubeQueryResponse(BaseModel):
    data: list[dict[str, Any]] = Field(default_factory=list)
    meta: ResponseMeta
