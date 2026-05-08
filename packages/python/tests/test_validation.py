"""Pre-flight validation — `InvalidRangeError`, missing-argument errors,
and the `summary` unknown-kwarg rejection. Asserts no HTTP request is
made when validation fails."""

from __future__ import annotations

import pytest
from pytest_httpx import HTTPXMock

from convai_analytics import (
    ConvaiAnalytics,
    ConvaiAnalyticsError,
    InvalidRangeError,
)


def test_summary_rejects_unknown_range(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    with pytest.raises(InvalidRangeError) as exc_info:
        client.summary(range="last_45m")
    assert isinstance(exc_info.value, ConvaiAnalyticsError)
    assert "last_45m" in str(exc_info.value)
    assert httpx_mock.get_requests() == []


def test_summary_rejects_unknown_kwargs(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    with pytest.raises(ValueError, match="unsupported parameter"):
        client.summary(range="last_24h", end_user_id="u_1")
    assert httpx_mock.get_requests() == []


def test_timeseries_rejects_unknown_range(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    with pytest.raises(InvalidRangeError):
        client.timeseries(range="last_3m", measure="count")
    assert httpx_mock.get_requests() == []


def test_breakdown_rejects_unknown_range(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    with pytest.raises(InvalidRangeError):
        client.breakdown(range="last_99h", measure="count", group_by="processor")
    assert httpx_mock.get_requests() == []


def test_regression_rejects_unknown_baseline(
    client: ConvaiAnalytics, httpx_mock: HTTPXMock,
) -> None:
    with pytest.raises(InvalidRangeError):
        client.regression_detection(baseline_range="last_99h")
    with pytest.raises(InvalidRangeError):
        client.regression_detection(current_range="last_3m")
    assert httpx_mock.get_requests() == []


def test_sessions_get_missing_id(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    with pytest.raises(ConvaiAnalyticsError, match="session_id is required"):
        client.sessions.get("")
    assert httpx_mock.get_requests() == []


def test_interactions_get_missing_id(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    with pytest.raises(ConvaiAnalyticsError, match="interaction_id is required"):
        client.interactions.get("")
    assert httpx_mock.get_requests() == []


def test_query_missing_body(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    with pytest.raises(ConvaiAnalyticsError, match="must be a dict"):
        client.query(None)  # type: ignore[arg-type]
    assert httpx_mock.get_requests() == []
