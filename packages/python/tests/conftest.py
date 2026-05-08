"""Shared fixtures for the analytics SDK test suite.

Uses ``pytest-httpx`` to stub the HTTP transport — every test injects a
``HTTPXMock`` and the test asserts on what the SDK actually wrote to the
wire (URL, method, headers, query params, body).
"""

from __future__ import annotations

from typing import Any

import pytest
from pytest_httpx import HTTPXMock

from convai_analytics import ConvaiAnalytics

BASE_URL = "https://example.test/v1/analytics"
API_KEY = "ck_test_fake"


@pytest.fixture
def client(httpx_mock: HTTPXMock) -> ConvaiAnalytics:
    """A `ConvaiAnalytics` bound to a stub backend at `BASE_URL`."""
    del httpx_mock  # Forces the stub to be active even when no .add_response is called.
    return ConvaiAnalytics(api_key=API_KEY, base_url=BASE_URL)


# ---------- Canned responses (camelCase, matching backend wire format) ----------

META: dict[str, Any] = {
    "freshnessAt": "2026-05-05T16:00:00+00:00",
    "sampleCount": 100,
    "effectiveRange": {
        "startTime": "2026-05-04T16:00:00+00:00",
        "endTime": "2026-05-05T16:00:00+00:00",
    },
    "backend": "cube",
    "cacheHit": False,
}

SAMPLE_SUMMARY: dict[str, Any] = {
    "sessions": 100,
    "uniqueEndUsers": 42,
    "interactions": 250,
    "errorCount": 3,
    "p50EndToEndMs": 120.5,
    "p95EndToEndMs": 450.0,
    "p99EndToEndMs": 800.0,
    "meta": META,
}

SAMPLE_TIMESERIES: dict[str, Any] = {
    "measure": "count",
    "granularity": "hour",
    "points": [
        {"bucketStart": "2026-05-05T15:00:00+00:00", "value": 12, "group": None},
        {"bucketStart": "2026-05-05T16:00:00+00:00", "value": 18, "group": None},
    ],
    "meta": META,
}

SAMPLE_BREAKDOWN: dict[str, Any] = {
    "measure": "count",
    "groupBy": "processor",
    "rows": [
        {"group": "llm", "value": 100, "sampleCount": 100},
        {"group": "tts", "value": 80, "sampleCount": 80},
    ],
    "meta": META,
}

SAMPLE_CATALOG: dict[str, Any] = {
    "metrics": [
        {
            "metricName": "voice.user_to_bot_latency",
            "metricType": "UserBotLatencyMetricsData",
            "unit": "ms",
            "description": "End-to-end latency.",
            "visibility": "public",
            "supportsPercentiles": True,
        },
    ],
    "meta": META,
}

SAMPLE_SESSION_LIST: dict[str, Any] = {
    "sessions": [
        {
            "sessionId": "s_first",
            "characterId": "char_a",
            "appKey": "app_x",
            "experienceId": None,
            "startTime": "2026-05-05T15:00:00+00:00",
            "endTime": "2026-05-05T15:30:00+00:00",
            "durationSec": 1800,
            "interactionCount": 25,
            "p95EndToEndMs": 420,
            "errorCount": 0,
        },
    ],
    "nextCursor": "cur_second_page",
    "meta": META,
}

SAMPLE_SESSION_DETAIL: dict[str, Any] = {
    "sessionId": "s_first",
    "characterId": "char_a",
    "appKey": "app_x",
    "experienceId": None,
    "startTime": "2026-05-05T15:00:00+00:00",
    "endTime": "2026-05-05T15:30:00+00:00",
    "events": [
        {
            "eventTime": "2026-05-05T15:00:01+00:00",
            "metricName": "voice.user_to_bot_latency",
            "metricType": "UserBotLatencyMetricsData",
            "processor": None,
            "interactionId": "int_1",
            "status": "ok",
            "value": 410,
            "attributes": None,
        },
    ],
    "meta": META,
}

SAMPLE_INTERACTION: dict[str, Any] = {
    "interactionId": "int_1",
    "sessionId": "s_first",
    "characterId": "char_a",
    "appKey": "app_x",
    "endUserId": None,
    "interactionType": "voice_turn",
    "startTime": "2026-05-05T15:00:00+00:00",
    "endTime": "2026-05-05T15:00:00.41+00:00",
    "totalDurationMs": 410,
    "terminalStatus": "ok",
    "failureStage": None,
    "spans": [
        {
            "processor": "asr",
            "startTime": "2026-05-05T15:00:00+00:00",
            "endTime": "2026-05-05T15:00:00.1+00:00",
            "durationMs": 100,
            "status": "ok",
            "provider": "deepgram",
            "model": None,
            "errorCode": None,
            "attributes": None,
        },
    ],
    "meta": META,
}

SAMPLE_REGRESSION: dict[str, Any] = {
    "rows": [
        {
            "group": "all",
            "baselineValue": 400,
            "currentValue": 480,
            "relativeChange": 0.2,
            "sampleCount": 250,
            "significant": True,
        },
    ],
    "meta": META,
}

SAMPLE_CUBE_QUERY: dict[str, Any] = {
    "data": [{"SessionMetrics.uniqueSessions": 100}],
    "meta": META,
}
