"""Cube vocabulary the SDK passes to the backend.

``Measures``, ``Segments``, and ``GroupBy`` mirror the keys the backend's
``MEASURE_MAP`` / ``SEGMENT_MAP`` / ``GROUP_BY_MAP`` tables in
``convai-analytics-api/src/convai_analytics_api/routes/_common.py``
resolve. Resource facades use these constants instead of hardcoding the
strings — a typo here surfaces as a Python ``AttributeError`` rather
than a 400 from the backend.

If the backend renames a measure / segment / group-by, bump the
corresponding constant here and tests will catch downstream callers.
"""

from __future__ import annotations

from typing import Final

from .types import Percentile


class Measures:
    """Cube measures the backend understands."""

    # Counts
    COUNT: Final = "count"
    UNIQUE_SESSIONS: Final = "uniqueSessions"
    UNIQUE_TURNS: Final = "uniqueTurns"
    UNIQUE_END_USERS: Final = "uniqueEndUsers"
    ERROR_COUNT: Final = "errorCount"
    # Aggregates over `value`
    AVG_VALUE: Final = "avgValue"
    P50_VALUE: Final = "p50Value"
    P95_VALUE: Final = "p95Value"
    P99_VALUE: Final = "p99Value"
    # End-to-end turn-latency percentiles
    TURN_P50: Final = "turnP50"
    TURN_P75: Final = "turnP75"
    TURN_P90: Final = "turnP90"
    TURN_P95: Final = "turnP95"
    TURN_P99: Final = "turnP99"


def percentile_measure(p: Percentile) -> str:
    """Convert a `Percentile` (`'p95'`) to its Cube measure (`'turnP95'`)."""
    return {
        "p50": Measures.TURN_P50,
        "p75": Measures.TURN_P75,
        "p90": Measures.TURN_P90,
        "p95": Measures.TURN_P95,
        "p99": Measures.TURN_P99,
    }[p]


def raw_value_percentile_measure(p: Percentile) -> str:
    """Convert a percentile to the raw ``value`` percentile measure."""
    if p == "p50":
        return Measures.P50_VALUE
    if p == "p95":
        return Measures.P95_VALUE
    if p == "p99":
        return Measures.P99_VALUE
    return percentile_measure(p)


class Segments:
    """Cube segments — scope a query to a metric family."""

    END_TO_END_TURN_LATENCY: Final = "endToEndTurnLatency"
    ASR_METRICS: Final = "asrMetrics"
    LLM_METRICS: Final = "llmMetrics"
    TTS_METRICS: Final = "ttsMetrics"
    NEUROSYNC_METRICS: Final = "neurosyncMetrics"


class GroupBy:
    """``group_by`` tokens accepted by ``/timeseries`` and ``/breakdown``."""

    PROCESSOR: Final = "processor"
    PROVIDER: Final = "provider"
    VOICE_PROVIDER: Final = "voiceProvider"
    MODEL: Final = "model"
    CHARACTER_ID: Final = "characterId"
    APP_KEY: Final = "appKey"
    EXPERIENCE_ID: Final = "experienceId"
    SESSION_ID: Final = "sessionId"
    STATUS: Final = "status"
    METRIC_NAME: Final = "metricName"
    ERROR_CODE: Final = "errorCode"


class MetricNames:
    """Well-known ``metric_name`` values."""

    VOICE_USER_TO_BOT_LATENCY: Final = "voice.user_to_bot_latency"


class MetricNamePrefixes:
    """Well-known ``metric_name_prefix`` filters."""

    ERROR: Final = "error."
    LLM: Final = "llm."
    TTS: Final = "tts."
    ASR: Final = "asr."
    NEUROSYNC: Final = "neurosync."
