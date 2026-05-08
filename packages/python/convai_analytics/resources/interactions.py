"""Interactions resource — single-trace lookup by interaction id.

The agent-friendly entry point for "explain this trace" and
"generate a waterfall for this interaction" prompts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from ..errors import ConvaiAnalyticsError
from ..types import InteractionTrace

if TYPE_CHECKING:
    from ..client import ConvaiAnalytics


class Interactions:
    def __init__(self, client: ConvaiAnalytics) -> None:
        self._client = client

    def get(self, interaction_id: str) -> InteractionTrace:
        """``GET /v1/analytics/interactions/{id}`` — full component waterfall."""
        if not interaction_id:
            raise ConvaiAnalyticsError(
                0,
                "missing_argument",
                "interactions.get(interaction_id): interaction_id is required",
            )
        return InteractionTrace.model_validate(
            self._client._get(f"/interactions/{interaction_id}", {}),
        )
