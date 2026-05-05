"""Errors facade — error analytics convenience wrappers.

Module is named ``errors_facade`` to avoid colliding with the top-level
``errors`` module that defines exception classes.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ..types import BreakdownResponse, TimeseriesResponse

if TYPE_CHECKING:
    from ..client import ConvaiAnalytics


class ErrorsFacade:
    def __init__(self, client: ConvaiAnalytics) -> None:
        self._client = client

    def summary(
        self,
        *,
        group_by: str = "processor",
        **filters: Any,
    ) -> BreakdownResponse:
        """"How many errors did I have, broken down by component?"

        Delegates to ``breakdown(measure='count', metric_name_prefix='error.')``.
        """
        return self._client.breakdown(
            measure="count",
            group_by=group_by,
            metric_name_prefix="error.",
            **filters,
        )

    def over_time(
        self,
        *,
        granularity: str | None = None,
        **filters: Any,
    ) -> TimeseriesResponse:
        """"Plot error count over time."

        Delegates to ``timeseries(measure='count', metric_name_prefix='error.')``.
        """
        return self._client.timeseries(
            measure="count",
            metric_name_prefix="error.",
            granularity=granularity,
            **filters,
        )
