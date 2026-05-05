"""Sessions resource — list and per-session detail."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ..errors import NotYetSupportedError
from ..types import SessionDetail, SessionListResponse

if TYPE_CHECKING:
    from ..client import ConvaiAnalytics


class Sessions:
    def __init__(self, client: ConvaiAnalytics) -> None:
        self._client = client

    def list(self, **params: Any) -> SessionListResponse:
        """``GET /v1/analytics/sessions`` — paginated session list."""
        del params
        raise NotYetSupportedError("/sessions", "API Phase 2")

    def get(self, session_id: str) -> SessionDetail:
        """``GET /v1/analytics/sessions/{id}`` — full per-session timeline."""
        del session_id
        raise NotYetSupportedError("/sessions/{id}", "API Phase 2")
