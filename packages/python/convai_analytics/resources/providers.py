"""Providers facade — provider/model comparison helpers."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ..types import BreakdownResponse

if TYPE_CHECKING:
    from ..client import ConvaiAnalytics


class ProvidersFacade:
    def __init__(self, client: ConvaiAnalytics) -> None:
        self._client = client

    def compare(
        self,
        *,
        component: str = "llm",
        percentile: str = "p95",
        **filters: Any,
    ) -> BreakdownResponse:
        """"Compare LLM provider p95 latency over the last 7 days."

        Delegates to ``breakdown(group_by='provider', segment=<component>Metrics)``.
        """
        return self._client.breakdown(
            measure=f"turn{percentile.upper()}",
            group_by="voiceProvider" if component == "tts" else "provider",
            segment=f"{component}Metrics",
            **filters,
        )
