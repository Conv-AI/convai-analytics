"""Latency facade — convenience wrappers over breakdown/timeseries."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ..measures import GroupBy, MetricNames, Segments, raw_value_percentile_measure
from ..types import BreakdownResponse, TimeseriesResponse

if TYPE_CHECKING:
    from ..client import ConvaiAnalytics


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

        Delegates to ``breakdown(measure='p95Value', group_by='processor',
        segment='endToEndTurnLatency')``.
        """
        return self._client.breakdown(
            measure=raw_value_percentile_measure(percentile),  # type: ignore[arg-type]
            group_by=GroupBy.PROCESSOR,
            segment=Segments.END_TO_END_TURN_LATENCY,
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

        Delegates to ``timeseries(measure='p95Value',
        metric_name='voice.user_to_bot_latency')``.
        """
        return self._client.timeseries(
            measure=raw_value_percentile_measure(percentile),  # type: ignore[arg-type]
            metric_name=MetricNames.VOICE_USER_TO_BOT_LATENCY,
            granularity=granularity,
            **filters,
        )
