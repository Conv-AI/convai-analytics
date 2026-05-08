"""Convenience-facade tests. Each facade is pure delegation over
``breakdown`` / ``timeseries``, so the tests assert the right outbound
query params show up for the canonical question each facade answers."""

from __future__ import annotations

from urllib.parse import parse_qs, urlsplit

from pytest_httpx import HTTPXMock

from convai_analytics import ConvaiAnalytics
from tests.conftest import SAMPLE_BREAKDOWN, SAMPLE_TIMESERIES


def _q(httpx_mock: HTTPXMock) -> dict[str, str]:
    return {k: v[0] for k, v in parse_qs(urlsplit(str(httpx_mock.get_request().url)).query).items()}


def test_latency_by_component(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(json=SAMPLE_BREAKDOWN)
    client.latency.by_component(percentile="p95", character_id="char_a", range="last_24h")
    q = _q(httpx_mock)
    assert q["measure"] == "p95_value"
    assert q["group_by"] == "processor"
    assert q["segment"] == "end_to_end_turn_latency"
    assert q["character_id"] == "char_a"


def test_latency_over_time(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(json=SAMPLE_TIMESERIES)
    client.latency.over_time(percentile="p95", granularity="hour", range="last_7d")
    q = _q(httpx_mock)
    assert urlsplit(str(httpx_mock.get_request().url)).path == "/v1/analytics/timeseries"
    assert q["measure"] == "p95_value"
    assert q["metric_name"] == "voice.user_to_bot_latency"
    assert q["granularity"] == "hour"


def test_providers_compare_tts(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(json=SAMPLE_BREAKDOWN)
    client.providers.compare(component="tts", percentile="p99")
    q = _q(httpx_mock)
    assert q["measure"] == "p99_value"
    assert q["group_by"] == "voice_provider"
    assert q["segment"] == "tts_metrics"


def test_providers_compare_llm(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(json=SAMPLE_BREAKDOWN)
    client.providers.compare(component="llm")
    q = _q(httpx_mock)
    assert q["group_by"] == "provider"
    assert q["segment"] == "llm_metrics"


def test_errors_summary(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(json=SAMPLE_BREAKDOWN)
    client.errors.summary()
    q = _q(httpx_mock)
    assert q["measure"] == "count"
    assert q["group_by"] == "processor"
    assert q["metric_name_prefix"] == "error."


def test_errors_over_time(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(json=SAMPLE_TIMESERIES)
    client.errors.over_time(granularity="day")
    q = _q(httpx_mock)
    assert urlsplit(str(httpx_mock.get_request().url)).path == "/v1/analytics/timeseries"
    assert q["measure"] == "count"
    assert q["metric_name_prefix"] == "error."
    assert q["granularity"] == "day"


def test_usage_summary(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(json=SAMPLE_BREAKDOWN)
    client.usage.summary()
    q = _q(httpx_mock)
    assert q["measure"] == "unique_sessions"
    assert q["group_by"] == "character_id"


def test_usage_interactions(client: ConvaiAnalytics, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(json=SAMPLE_BREAKDOWN)
    client.usage.interactions(group_by="experienceId")
    q = _q(httpx_mock)
    assert q["measure"] == "unique_turns"
    assert q["group_by"] == "experience_id"
