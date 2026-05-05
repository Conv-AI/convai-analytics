"""Sessions resource — list and per-session detail."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ..types import SessionDetail, SessionListResponse

if TYPE_CHECKING:
    from ..client import ConvaiAnalytics


class Sessions:
    def __init__(self, client: ConvaiAnalytics) -> None:
        self._client = client

    def list(self, **params: Any) -> SessionListResponse:
        """``GET /v1/analytics/sessions`` — paginated session list."""
        return SessionListResponse.model_validate(self._client._get("/sessions", params))

    def get(self, session_id: str) -> SessionDetail:
        """``GET /v1/analytics/sessions/{id}`` — full per-session timeline."""
        if not session_id:
            raise ValueError("sessions.get: session_id is required")
        return SessionDetail.model_validate(
            self._client._get(f"/sessions/{session_id}", {}),
        )
