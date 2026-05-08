"""Pre-flight validator for ``client.query(...)`` — mirrors the
constraints the backend's ``/v1/analytics/query`` enforces. Each test
asserts the right ``code`` is on the thrown error and that no HTTP
request escapes."""

from __future__ import annotations

import pytest
from pytest_httpx import HTTPXMock

from convai_analytics import ConvaiAnalytics, ConvaiAnalyticsError
from tests.conftest import SAMPLE_CUBE_QUERY


def _expect_code(fn, expected_code: str) -> ConvaiAnalyticsError:
    with pytest.raises(ConvaiAnalyticsError) as exc_info:
        fn()
    assert exc_info.value.code == expected_code
    return exc_info.value


def test_empty_query(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    _expect_code(lambda: client.query({}), "empty_query")
    assert httpx_mock.get_requests() == []


def test_query_too_wide(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    measures = [f"SessionMetrics.measure{i}" for i in range(13)]
    err = _expect_code(
        lambda: client.query({"measures": measures}),
        "query_too_wide",
    )
    assert err.details["total"] == 13
    assert err.details["max"] == 12
    assert httpx_mock.get_requests() == []


def test_invalid_member_in_measures(
    client: ConvaiAnalytics, httpx_mock: HTTPXMock,
) -> None:
    _expect_code(
        lambda: client.query({"measures": ["BadModel.x"]}),
        "invalid_member",
    )
    assert httpx_mock.get_requests() == []


def test_invalid_member_in_filter(
    client: ConvaiAnalytics, httpx_mock: HTTPXMock,
) -> None:
    _expect_code(
        lambda: client.query({
            "measures": ["SessionMetrics.uniqueSessions"],
            "filters": [
                {"member": "Other.field", "operator": "equals", "values": ["a"]},
            ],
        }),
        "invalid_member",
    )
    assert httpx_mock.get_requests() == []


def test_invalid_member_in_time_dimension(
    client: ConvaiAnalytics, httpx_mock: HTTPXMock,
) -> None:
    _expect_code(
        lambda: client.query({
            "measures": ["SessionMetrics.uniqueSessions"],
            "timeDimensions": [
                {"dimension": "Wrong.eventTime", "granularity": "hour"},
            ],
        }),
        "invalid_member",
    )
    assert httpx_mock.get_requests() == []


def test_forbidden_granularity(
    client: ConvaiAnalytics, httpx_mock: HTTPXMock,
) -> None:
    _expect_code(
        lambda: client.query({
            "measures": ["SessionMetrics.uniqueSessions"],
            "timeDimensions": [
                {"dimension": "SessionMetrics.eventTime", "granularity": "second"},
            ],
        }),
        "forbidden_granularity",
    )
    assert httpx_mock.get_requests() == []


@pytest.mark.parametrize("limit", [0, -1, 6_000])
def test_invalid_limit(
    client: ConvaiAnalytics, httpx_mock: HTTPXMock, limit: int,
) -> None:
    _expect_code(
        lambda: client.query({
            "measures": ["SessionMetrics.uniqueSessions"],
            "limit": limit,
        }),
        "invalid_limit",
    )
    assert httpx_mock.get_requests() == []


def test_well_formed_query_passes_through(
    client: ConvaiAnalytics, httpx_mock: HTTPXMock,
) -> None:
    httpx_mock.add_response(json=SAMPLE_CUBE_QUERY)
    client.query({
        "measures": ["SessionMetrics.uniqueSessions"],
        "dimensions": ["SessionMetrics.characterId"],
        "timeDimensions": [
            {"dimension": "SessionMetrics.eventTime", "granularity": "hour"},
        ],
        "limit": 100,
    })
    assert len(httpx_mock.get_requests()) == 1
