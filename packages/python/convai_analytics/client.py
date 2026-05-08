"""ConvaiAnalytics — main Python SDK entry point."""

from __future__ import annotations

import os
import re
from typing import Any

import httpx

from . import __version__ as _sdk_version
from .errors import (
    ConvaiAnalyticsError,
    InvalidRangeError,
    error_from_response,
)
from .resources.errors_facade import ErrorsFacade
from .resources.interactions import Interactions
from .resources.latency import LatencyFacade
from .resources.providers import ProvidersFacade
from .resources.sessions import Sessions
from .resources.usage import UsageFacade
from .types import (
    BreakdownResponse,
    CatalogResponse,
    CubeQueryResponse,
    RegressionDetectionResponse,
    SummaryResponse,
    TimeseriesResponse,
)

DEFAULT_BASE_URL = "https://analytics-api.convai.com/v1/analytics"

# Mirrors `_CUBE_RANGE_TOKENS` in convai-analytics-api/routes/_common.py.
# When the API gains absolute start/end support, drop the validator and
# widen the accepted summary kwargs.
_ALLOWED_RANGES: tuple[str, ...] = (
    "last_15m",
    "last_1h",
    "last_6h",
    "last_24h",
    "last_7d",
    "last_30d",
)
# Backend `/summary` only reads these. Other CommonFilters land alongside
# /timeseries and /breakdown.
_ALLOWED_SUMMARY_PARAMS = frozenset(
    {"range", "character_id", "app_key", "experience_id"},
)


def _validate_range(value: str | None) -> None:
    if value is None:
        return
    if value not in _ALLOWED_RANGES:
        raise InvalidRangeError(value, _ALLOWED_RANGES)


def _validate_summary_params(params: dict[str, Any]) -> None:
    _validate_range(params.get("range"))
    extra = sorted(set(params) - _ALLOWED_SUMMARY_PARAMS)
    if extra:
        raise ValueError(
            f"summary(): unsupported parameter(s) {extra}. "
            f"Allowed: {sorted(_ALLOWED_SUMMARY_PARAMS)}. "
            f"Use timeseries() / breakdown() for the broader filter surface.",
        )


# Constraints the backend's POST /v1/analytics/query enforces. We mirror
# them client-side so an obvious mistake (typo'd prefix, oversize query,
# forbidden granularity) raises *before* the round trip. The backend
# remains the source of truth — this validator is best-effort and exists
# to give agents fast, specific feedback.
_CUBE_MEMBER_PREFIX = "SessionMetrics."
_CUBE_MAX_TOTAL_MEMBERS = 12
_CUBE_FORBIDDEN_GRANULARITIES = frozenset({"second"})
_CUBE_LIMIT_MIN = 1
_CUBE_LIMIT_MAX = 5_000

_MEASURE_ALIASES = {
    "avgValue": "avg_value",
    "p50Value": "p50_value",
    "p95Value": "p95_value",
    "p99Value": "p99_value",
    "turnP50": "turn_p50",
    "turnP95": "turn_p95",
    "turnP99": "turn_p99",
    "turnMax": "turn_max",
    "uniqueSessions": "unique_sessions",
    "uniqueTurns": "unique_turns",
    "uniqueEndUsers": "unique_end_users",
    "errorCount": "error_count",
}

_GROUP_BY_ALIASES = {
    "voiceProvider": "voice_provider",
    "characterId": "character_id",
    "metricName": "metric_name",
    "metricType": "metric_type",
    "appKey": "app_key",
    "experienceId": "experience_id",
}

_SEGMENT_ALIASES = {
    "endToEndTurnLatency": "end_to_end_turn_latency",
    "neuroSyncTurnSummary": "neuro_sync_turn_summary",
    "customLatencyMetrics": "custom_latency_metrics",
    "userBotLatencyMetrics": "user_bot_latency_metrics",
    "smartTurnMetrics": "smart_turn_metrics",
    "sttMetrics": "stt_metrics",
    "vadMetrics": "vad_metrics",
    "ttsMetrics": "tts_metrics",
    "llmMetrics": "llm_metrics",
}


def _fail_query(
    code: str, message: str, details: dict[str, Any] | None = None,
) -> None:
    raise ConvaiAnalyticsError(0, code, message, details or {})


def _validate_cube_query(q: dict[str, Any]) -> None:
    measures = q.get("measures") or []
    dimensions = q.get("dimensions") or []
    segments = q.get("segments") or []
    filters = q.get("filters") or []
    time_dimensions = q.get("timeDimensions") or q.get("time_dimensions") or []

    total = len(measures) + len(dimensions) + len(segments)
    if total == 0:
        _fail_query(
            "empty_query",
            "Query must declare at least one measure, dimension, or segment.",
        )
    if total > _CUBE_MAX_TOTAL_MEMBERS:
        _fail_query(
            "query_too_wide",
            f"Query has {total} members; max is {_CUBE_MAX_TOTAL_MEMBERS}. "
            f"Reduce measures + dimensions + segments.",
            {"total": total, "max": _CUBE_MAX_TOTAL_MEMBERS},
        )

    for m in (*measures, *dimensions, *segments):
        if not isinstance(m, str) or not m.startswith(_CUBE_MEMBER_PREFIX):
            _fail_query(
                "invalid_member",
                f"members must start with {_CUBE_MEMBER_PREFIX!r} (got {m!r}).",
                {"member": m, "required_prefix": _CUBE_MEMBER_PREFIX},
            )

    for f in filters:
        member = f.get("member") if isinstance(f, dict) else None
        if not isinstance(member, str) or not member.startswith(_CUBE_MEMBER_PREFIX):
            _fail_query(
                "invalid_member",
                f"filter member must start with {_CUBE_MEMBER_PREFIX!r} (got {member!r}).",
                {"member": member, "required_prefix": _CUBE_MEMBER_PREFIX},
            )

    for td in time_dimensions:
        dim = td.get("dimension") if isinstance(td, dict) else None
        if not isinstance(dim, str) or not dim.startswith(_CUBE_MEMBER_PREFIX):
            _fail_query(
                "invalid_member",
                f"timeDimension dimension must start with {_CUBE_MEMBER_PREFIX!r} "
                f"(got {dim!r}).",
                {"member": dim, "required_prefix": _CUBE_MEMBER_PREFIX},
            )
        granularity = td.get("granularity") if isinstance(td, dict) else None
        if granularity in _CUBE_FORBIDDEN_GRANULARITIES:
            _fail_query(
                "forbidden_granularity",
                f"Granularity {granularity!r} is not permitted. "
                f"Forbidden: {sorted(_CUBE_FORBIDDEN_GRANULARITIES)}.",
                {"granularity": granularity},
            )

    limit = q.get("limit")
    if limit is not None and (
        not isinstance(limit, int)
        or limit < _CUBE_LIMIT_MIN
        or limit > _CUBE_LIMIT_MAX
    ):
        _fail_query(
            "invalid_limit",
            f"limit must be between {_CUBE_LIMIT_MIN} and {_CUBE_LIMIT_MAX} "
            f"(got {limit!r}).",
            {"limit": limit, "min": _CUBE_LIMIT_MIN, "max": _CUBE_LIMIT_MAX},
        )


def _normalize_query_value(key: str, value: Any) -> Any:
    if not isinstance(value, str):
        return value
    if key == "measure":
        return _MEASURE_ALIASES.get(value, value)
    if key == "group_by":
        return _GROUP_BY_ALIASES.get(value, value)
    if key == "segment":
        return _SEGMENT_ALIASES.get(value, value)
    return value


class ConvaiAnalytics:
    """Single-tenant client bound to one API key + base URL.

    Resources hang off as attributes; convenience facades wrap the lower-level
    resources with sensible defaults so coding agents have a named entry
    point per common question.
    """

    def __init__(
        self,
        api_key: str | None = None,
        *,
        base_url: str | None = None,
        timeout: float = 30.0,
        client: httpx.Client | None = None,
    ) -> None:
        resolved_key = api_key or os.environ.get("CONVAI_API_KEY")
        if not resolved_key:
            raise ValueError(
                "ConvaiAnalytics: api_key is required (pass it explicitly or "
                "set CONVAI_API_KEY).",
            )
        self._api_key = resolved_key
        self._base_url = (
            base_url or os.environ.get("CONVAI_ANALYTICS_BASE_URL") or DEFAULT_BASE_URL
        ).rstrip("/")
        self._timeout = timeout
        self._http = client or httpx.Client(
            timeout=timeout,
            headers={
                "CONVAI-API-KEY": self._api_key,
                "Accept": "application/json",
                "User-Agent": f"convai-analytics-py/{_sdk_version}",
            },
        )

        self.sessions = Sessions(self)
        self.interactions = Interactions(self)
        self.latency = LatencyFacade(self)
        self.providers = ProvidersFacade(self)
        self.errors = ErrorsFacade(self)
        self.usage = UsageFacade(self)

    # ---------- Direct REST mappings ----------

    def summary(self, **params: Any) -> SummaryResponse:
        """``GET /v1/analytics/summary`` — top-level KPIs over a window.

        Accepted kwargs: ``range`` (default ``last_24h``), ``character_id``,
        ``app_key``, ``experience_id``.
        """
        _validate_summary_params(params)
        return SummaryResponse.model_validate(self._get("/summary", params))

    def timeseries(self, **params: Any) -> TimeseriesResponse:
        """``GET /v1/analytics/timeseries`` — bucketed values for a measure.

        Common kwargs: ``measure`` (default ``count``), ``granularity``
        (``minute|hour|day``, default ``hour``), ``range``, ``group_by``,
        ``segment``, ``metric_name``, ``metric_name_prefix``, plus the
        standard filter dimensions (``character_id``, ``app_key``,
        ``experience_id``, ``end_user_id``, ``provider``, ``model``,
        ``processor``, ``status``).
        """
        _validate_range(params.get("range"))
        return TimeseriesResponse.model_validate(self._get("/timeseries", params))

    def breakdown(self, **params: Any) -> BreakdownResponse:
        """``GET /v1/analytics/breakdown`` — group-by aggregation for one measure.

        Common kwargs: ``measure`` (default ``count``), ``group_by``
        (default ``processor``), ``range``, ``limit`` (1-500, default 50),
        ``segment``, ``metric_name``, ``metric_name_prefix``, plus filter
        dimensions.
        """
        _validate_range(params.get("range"))
        return BreakdownResponse.model_validate(self._get("/breakdown", params))

    def catalog(self) -> CatalogResponse:
        """``GET /v1/analytics/metrics/catalog`` — metric names visible at your plan tier."""
        return CatalogResponse.model_validate(self._get("/metrics/catalog", {}))

    def regression_detection(self, **params: Any) -> RegressionDetectionResponse:
        """``GET /v1/analytics/regression-detection`` — rolling p95 regression vs baseline.

        Requires the ``business`` plan or higher (otherwise the request returns
        402/403 and the SDK raises ``PlanRequiredError`` / ``PlanInsufficientError``).
        Backed by the BigQuery escape hatch on the server.

        Common kwargs: ``measure`` (default ``voice.user_to_bot_latency``),
        ``baseline_range`` (default ``last_7d``), ``current_range``
        (default ``last_24h``), ``group_by`` (one of ``overall | app_key |
        character_id | experience_id | provider | voice_provider | model``,
        default ``overall``), ``threshold`` (0.0-10.0, default 0.15).
        """
        _validate_range(params.get("baseline_range"))
        _validate_range(params.get("current_range"))
        return RegressionDetectionResponse.model_validate(
            self._get("/regression-detection", params),
        )

    def query(self, cube_query: dict[str, Any]) -> CubeQueryResponse:
        """``POST /v1/analytics/query`` — restricted Cube passthrough.

        Requires ``business`` plan or higher. Use only when a hand-shaped
        query cannot be expressed via the named endpoints; prefer the named
        ones for forward compatibility.

        Backend constraints (validated client-side, then re-checked server-side):
        - All members (``measures``, ``dimensions``, ``segments``,
          ``filters[].member``, ``timeDimensions[].dimension``) must start
          with ``SessionMetrics.``.
        - Total ``len(measures) + len(dimensions) + len(segments)`` must be
          1-12.
        - ``timeDimensions[].granularity`` cannot be ``"second"``.
        - ``limit`` must be 1-5000 (default 1000).

        Violations raise a typed ``ConvaiAnalyticsError`` with ``code`` set
        to one of ``empty_query``, ``query_too_wide``, ``invalid_member``,
        ``forbidden_granularity``, or ``invalid_limit``.
        """
        if not isinstance(cube_query, dict):
            raise ConvaiAnalyticsError(
                0,
                "missing_argument",
                "query(cube_query): cube_query must be a dict.",
            )
        _validate_cube_query(cube_query)
        return CubeQueryResponse.model_validate(self._post("/query", cube_query))

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> ConvaiAnalytics:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    # ---------- HTTP transport (used by resources/) ----------

    def _get(self, path: str, params: dict[str, Any]) -> Any:
        # Python kwargs are already snake_case; backend Query aliases are
        # snake_case too. No name transform — just drop None values and
        # stringify lists so the URL serializer gets a consistent shape.
        wire_params = {
            k: _stringify(_normalize_query_value(k, v))
            for k, v in params.items()
            if v is not None
        }
        return self._request("GET", path, params=wire_params, json=None)

    def _post(self, path: str, body: Any) -> Any:
        return self._request("POST", path, params=None, json=body)

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None,
        json: Any,
    ) -> Any:
        response = self._http.request(
            method,
            self._base_url + path,
            params=params,
            json=json,
        )
        if response.status_code >= 400:
            try:
                payload = response.json()
            except ValueError:
                payload = {"error": {"code": "non_json_error", "message": response.text}}
            retry_after_raw = response.headers.get("Retry-After")
            retry_after = int(retry_after_raw) if retry_after_raw else None
            raise error_from_response(response.status_code, payload, retry_after)

        return response.json()


# ---------- wire-format helpers ----------


def _stringify(v: Any) -> str:
    if isinstance(v, list):
        return ",".join(str(x) for x in v)
    if isinstance(v, bool):
        # FastAPI accepts "true" / "false" for boolean Query params.
        return "true" if v else "false"
    return str(v)


# Kept exported for tests / external users who built on top of the old
# `_deep_snake` helper. No longer used internally — generated Pydantic
# models accept the camelCase wire format directly via populate_by_name.
_SNAKE_RE = re.compile(r"(?<!^)(?=[A-Z])")


def _snakify(s: str) -> str:
    return _SNAKE_RE.sub("_", s).lower()


def _deep_snake(value: Any) -> Any:
    if isinstance(value, list):
        return [_deep_snake(v) for v in value]
    if isinstance(value, dict):
        return {_snakify(k): _deep_snake(v) for k, v in value.items()}
    return value
