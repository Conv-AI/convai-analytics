"""Usage facade — account/character/experience usage analytics."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ..measures import GroupBy, Measures
from ..types import BreakdownResponse

if TYPE_CHECKING:
    from ..client import ConvaiAnalytics


class UsageFacade:
    def __init__(self, client: ConvaiAnalytics) -> None:
        self._client = client

    def summary(
        self,
        *,
        group_by: str = GroupBy.CHARACTER_ID,
        **filters: Any,
    ) -> BreakdownResponse:
        """"How many sessions / unique end users / interactions did I have, by character?"

        Delegates to ``breakdown(measure='uniqueSessions', group_by=...)``.
        """
        return self._client.breakdown(
            measure=Measures.UNIQUE_SESSIONS,
            group_by=group_by,
            **filters,
        )

    def interactions(
        self,
        *,
        group_by: str = GroupBy.CHARACTER_ID,
        **filters: Any,
    ) -> BreakdownResponse:
        """"How many interactions per character?" """
        return self._client.breakdown(
            measure=Measures.UNIQUE_TURNS,
            group_by=group_by,
            **filters,
        )
