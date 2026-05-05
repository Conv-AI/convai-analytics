"""Latency facade — convenience wrappers over breakdown/timeseries."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ..types import BreakdownResponse, TimeseriesResponse

if TYPE_CHECKING:
    from ..client import ConvaiAnalytics


def _percentile_measure(p: str) -> str:
    """Cube measure names: turnP50, turnP75, turnP90, turnP95, turnP99."""
    return f"turn{p.upper()}"


class LatencyFacade:
    def __init__(self, client: ConvaiAnalytics) -> None:
        self._client = client

    def by_component(
        self,
        *,
        percentile: str = "p95",
        **filters: Any,
    ) -> BreakdownResponse:
        """"Which component contributes most to my p95 end-to-end latency?"

        Delegates to ``breakdown(measure='turnP95', group_by='processor',
        segment='endToEndTurnLatency')``.
        """
        return self._client.breakdown(
            measure=_percentile_measure(percentile),
            group_by="processor",
            segment="endToEndTurnLatency",
            **filters,
        )

    def over_time(
        self,
        *,
        percentile: str = "p95",
        granularity: str | None = None,
        **filters: Any,
    ) -> TimeseriesResponse:
        """"Plot p95 end-to-end latency over time."

        Delegates to ``timeseries(measure='turnP95',
        metric_name='voice.user_to_bot_latency')``.
        """
        return self._client.timeseries(
            measure=_percentile_measure(percentile),
            metric_name="voice.user_to_bot_latency",
            granularity=granularity,
            **filters,
        )
