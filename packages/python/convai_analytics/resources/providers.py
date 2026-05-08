"""Providers facade — provider/model comparison helpers."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Literal

from ..measures import GroupBy, Segments, raw_value_percentile_measure
from ..types import BreakdownResponse

if TYPE_CHECKING:
    from ..client import ConvaiAnalytics


Component = Literal["llm", "tts", "asr", "neurosync"]

_COMPONENT_TO_SEGMENT: dict[Component, str] = {
    "llm": Segments.LLM_METRICS,
    "tts": Segments.TTS_METRICS,
    "asr": Segments.ASR_METRICS,
    "neurosync": Segments.NEUROSYNC_METRICS,
}


class ProvidersFacade:
    def __init__(self, client: ConvaiAnalytics) -> None:
        self._client = client

    def compare(
        self,
        *,
        component: Component = "llm",
        percentile: str = "p95",
        **filters: Any,
    ) -> BreakdownResponse:
        """"Compare LLM provider p95 latency over the last 7 days."

        Delegates to ``breakdown(group_by=provider|voiceProvider,
        segment=<component>Metrics)``.
        """
        return self._client.breakdown(
            measure=raw_value_percentile_measure(percentile),  # type: ignore[arg-type]
            # TTS uses `voiceProvider`; everything else uses `provider`.
            group_by=GroupBy.VOICE_PROVIDER if component == "tts" else GroupBy.PROVIDER,
            segment=_COMPONENT_TO_SEGMENT[component],
            **filters,
        )
