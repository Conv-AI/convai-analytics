"""Interactions resource — single-trace lookup by interaction id."""

from __future__ import annotations

from typing import TYPE_CHECKING

from ..errors import NotYetSupportedError
from ..types import InteractionTrace

if TYPE_CHECKING:
    from ..client import ConvaiAnalytics


class Interactions:
    def __init__(self, client: ConvaiAnalytics) -> None:
        self._client = client

    def get(self, interaction_id: str) -> InteractionTrace:
        """``GET /v1/analytics/interactions/{id}`` — full component waterfall.

        The agent-friendly entry point for "explain this trace" and
        "generate a waterfall for this interaction" prompts.
        """
        del interaction_id
        raise NotYetSupportedError("/interactions/{id}", "API Phase 2")
