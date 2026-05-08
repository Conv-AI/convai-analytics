"""Endpoint tests — one per SDK method, using ``pytest-httpx`` to stub
the wire. Asserts URL, method, headers, query params (snake_case on the
wire), and (for POST) the JSON body. Response shape is a canned camelCase
payload that mirrors what the backend emits."""

from __future__ import annotations

from urllib.parse import parse_qs, urlsplit

import pytest
from pytest_httpx import HTTPXMock

from convai_analytics import (
    ConvaiAnalytics,
    PlanInsufficientError,
    PlanRequiredError,
    RateLimitError,
)
from tests.conftest import (
    API_KEY,
    BASE_URL,
    SAMPLE_BREAKDOWN,
    SAMPLE_CATALOG,
    SAMPLE_CUBE_QUERY,
    SAMPLE_INTERACTION,
    SAMPLE_REGRESSION,
    SAMPLE_SESSION_DETAIL,
    SAMPLE_SESSION_LIST,
    SAMPLE_SUMMARY,
    SAMPLE_TIMESERIES,
)


def _querydict(url: str) -> dict[str, str]:
    """Decode a URL's query string into ``{key: first_value}``."""
    return {k: v[0] for k, v in parse_qs(urlsplit(url).query).items()}


def _assert_call(request, *, method: str, path: str) -> None:
    assert request.method == method
    assert request.url.path == path
    assert request.headers["CONVAI-API-KEY"] == API_KEY
    assert request.headers["Accept"] == "application/json"


# ---------- summary ----------


def test_summary_get_with_filters(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        url=f"{BASE_URL}/summary?range=last_24h&character_id=npc_warrior_42&app_key=app_x",
        json=SAMPLE_SUMMARY,
    )
    result = client.summary(range="last_24h", character_id="npc_warrior_42", app_key="app_x")
    requests = httpx_mock.get_requests()
    assert len(requests) == 1
    _assert_call(requests[0], method="GET", path="/v1/analytics/summary")
    assert result.sessions == 100
    assert result.p95_end_to_end_ms == 450


def test_summary_drops_undefined(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(json=SAMPLE_SUMMARY)
    client.summary(range="last_24h", character_id=None)
    q = _querydict(str(httpx_mock.get_request().url))
    assert q == {"range": "last_24h"}


# ---------- timeseries ----------


def test_timeseries_with_filters(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(json=SAMPLE_TIMESERIES)
    result = client.timeseries(
        measure="p95",
        granularity="hour",
        range="last_7d",
        group_by="processor",
        metric_name="voice.user_to_bot_latency",
        character_id="char_a",
    )
    request = httpx_mock.get_request()
    _assert_call(request, method="GET", path="/v1/analytics/timeseries")
    q = _querydict(str(request.url))
    assert q == {
        "measure": "p95",
        "granularity": "hour",
        "range": "last_7d",
        "group_by": "processor",
        "metric_name": "voice.user_to_bot_latency",
        "character_id": "char_a",
    }
    assert result.measure == "count"
    assert len(result.points) == 2


# ---------- breakdown ----------


def test_breakdown_with_filters(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(json=SAMPLE_BREAKDOWN)
    result = client.breakdown(
        measure="count",
        group_by="processor",
        range="last_24h",
        limit=10,
        metric_name_prefix="error.",
        character_id="char_a",
        provider="openai",
        status="error",
    )
    q = _querydict(str(httpx_mock.get_request().url))
    assert q == {
        "measure": "count",
        "group_by": "processor",
        "range": "last_24h",
        "limit": "10",
        "metric_name_prefix": "error.",
        "character_id": "char_a",
        "provider": "openai",
        "status": "error",
    }
    assert len(result.rows) == 2
    assert result.rows[0].group == "llm"


# ---------- catalog ----------


def test_catalog_no_params(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(json=SAMPLE_CATALOG)
    result = client.catalog()
    request = httpx_mock.get_request()
    _assert_call(request, method="GET", path="/v1/analytics/metrics/catalog")
    assert urlsplit(str(request.url)).query == ""
    assert result.metrics[0].metric_name == "voice.user_to_bot_latency"


# ---------- sessions.list (cursor pagination) ----------


def test_sessions_list_cursor_round_trip(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    # Page 1: no cursor, server returns next_cursor.
    httpx_mock.add_response(json=SAMPLE_SESSION_LIST)
    page1 = client.sessions.list(range="last_24h", limit=25)
    req1 = httpx_mock.get_requests()[0]
    q1 = _querydict(str(req1.url))
    assert q1 == {"range": "last_24h", "limit": "25"}
    assert "cursor" not in q1
    assert page1.next_cursor == "cur_second_page"

    # Page 2: feed next_cursor back.
    second_page = {**SAMPLE_SESSION_LIST, "sessions": [], "nextCursor": None}
    httpx_mock.add_response(json=second_page)
    page2 = client.sessions.list(range="last_24h", limit=25, cursor=page1.next_cursor)
    req2 = httpx_mock.get_requests()[1]
    q2 = _querydict(str(req2.url))
    assert q2 == {"range": "last_24h", "limit": "25", "cursor": "cur_second_page"}
    assert page2.next_cursor is None
    assert page2.sessions == []


# ---------- sessions.get ----------


def test_sessions_get(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(json=SAMPLE_SESSION_DETAIL)
    result = client.sessions.get("s_first")
    request = httpx_mock.get_request()
    _assert_call(request, method="GET", path="/v1/analytics/sessions/s_first")
    assert result.session_id == "s_first"
    assert len(result.events) == 1


# ---------- interactions.get ----------


def test_interactions_get(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(json=SAMPLE_INTERACTION)
    result = client.interactions.get("int_1")
    _assert_call(
        httpx_mock.get_request(),
        method="GET",
        path="/v1/analytics/interactions/int_1",
    )
    assert result.interaction_id == "int_1"
    assert len(result.spans) == 1
    assert result.spans[0].processor == "asr"


# ---------- regression-detection (plan-gated) ----------


def test_regression_detection_with_params(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(json=SAMPLE_REGRESSION)
    result = client.regression_detection(
        measure="voice.user_to_bot_latency",
        baseline_range="last_7d",
        current_range="last_24h",
        group_by="provider",
        threshold=0.2,
    )
    q = _querydict(str(httpx_mock.get_request().url))
    assert q == {
        "measure": "voice.user_to_bot_latency",
        "baseline_range": "last_7d",
        "current_range": "last_24h",
        "group_by": "provider",
        "threshold": "0.2",
    }
    assert result.rows[0].significant is True


def test_regression_detection_403_plan_insufficient(
    client: ConvaiAnalytics, httpx_mock: HTTPXMock,
) -> None:
    httpx_mock.add_response(
        status_code=403,
        json={
            "error": {
                "code": "plan_below_required",
                "message": "Endpoint requires plan 'business' (current: 'scale').",
                "details": {"required_plan": "business", "current_plan": "scale"},
            },
        },
    )
    with pytest.raises(PlanInsufficientError) as exc_info:
        client.regression_detection()
    assert exc_info.value.status == 403
    assert exc_info.value.code == "plan_below_required"


# ---------- query (POST) ----------


def test_query_post_json_body(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(json=SAMPLE_CUBE_QUERY)
    result = client.query(
        {
            "measures": ["SessionMetrics.uniqueSessions"],
            "dimensions": ["SessionMetrics.characterId"],
            "limit": 100,
        },
    )
    request = httpx_mock.get_request()
    _assert_call(request, method="POST", path="/v1/analytics/query")
    assert request.headers["Content-Type"] == "application/json"
    expected_body = (
        b'{"measures":["SessionMetrics.uniqueSessions"],'
        b'"dimensions":["SessionMetrics.characterId"],"limit":100}'
    )
    assert request.read() == expected_body
    assert len(result.data) == 1


def test_query_402_plan_required(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        status_code=402,
        json={
            "error": {
                "code": "plan_required",
                "message": "Analytics API requires the scale plan or higher.",
                "details": {"required_plan": "scale", "current_plan": "starter"},
            },
        },
    )
    with pytest.raises(PlanRequiredError) as exc_info:
        client.query({"measures": ["SessionMetrics.uniqueSessions"], "limit": 1})
    assert exc_info.value.status == 402
    assert exc_info.value.details == {"required_plan": "scale", "current_plan": "starter"}


# ---------- 429 → RateLimitError ----------


def test_429_rate_limit_retry_after(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        status_code=429,
        headers={"Retry-After": "30"},
        json={"error": {"code": "rate_limited", "message": "Slow down."}},
    )
    with pytest.raises(RateLimitError) as exc_info:
        client.summary(range="last_24h")
    assert exc_info.value.retry_after == 30
