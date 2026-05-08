"""Sessions resource — list and per-session detail.

Pagination model: opaque ``cursor`` returned by the previous ``.list()``
response under ``next_cursor``. Pass it back as ``cursor`` on the next
call. The cursor is base64-encoded server-side; do not interpret.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ..errors import ConvaiAnalyticsError
from ..types import SessionDetail, SessionListResponse

if TYPE_CHECKING:
    from ..client import ConvaiAnalytics


class Sessions:
    def __init__(self, client: ConvaiAnalytics) -> None:
        self._client = client

    def list(self, **params: Any) -> SessionListResponse:
        """``GET /v1/analytics/sessions`` — paginated session list with headline numbers.

        Common kwargs: ``range``, ``sort`` (``recent | longest | slowest``,
        default ``recent``), ``limit`` (1-100, default 25), ``cursor``,
        ``character_id``, ``app_key``, ``experience_id``, ``end_user_id``.
        """
        return SessionListResponse.model_validate(self._client._get("/sessions", params))

    def get(self, session_id: str) -> SessionDetail:
        """``GET /v1/analytics/sessions/{id}`` — full per-session timeline."""
        if not session_id:
            raise ConvaiAnalyticsError(
                0,
                "missing_argument",
                "sessions.get(session_id): session_id is required",
            )
        # Path is interpolated directly; httpx URL-encodes the value.
        return SessionDetail.model_validate(
            self._client._get(f"/sessions/{session_id}", {}),
        )
