"""ConvaiAnalytics — main Python SDK entry point."""

from __future__ import annotations

import os
import re
from typing import Any

import httpx

from . import __version__ as _sdk_version
from .errors import (
    InvalidRangeError,
    NotYetSupportedError,
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

# Mirrors `_CUBE_RANGE_TOKENS` in convai-analytics-api/routes/summary.py.
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
# Backend `/summary` only reads these. Other CommonFilters land in API Phase 2.
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
            f"Additional filters (endUserId, metricName, provider, model, "
            f"processor, status, startTime, endTime) land in API Phase 2.",
        )


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

        Accepted kwargs: ``range`` (one of ``last_15m | last_1h | last_6h |
        last_24h | last_7d | last_30d``, default ``last_24h``),
        ``character_id``, ``app_key``, ``experience_id``.
        """
        _validate_summary_params(params)
        return SummaryResponse.model_validate(self._get("/summary", params))

    def timeseries(self, **params: Any) -> TimeseriesResponse:
        """``GET /v1/analytics/timeseries`` — measure × granularity time series."""
        del params
        raise NotYetSupportedError("/timeseries", "API Phase 2")

    def breakdown(self, **params: Any) -> BreakdownResponse:
        """``GET /v1/analytics/breakdown`` — group-by aggregation for one measure."""
        del params
        raise NotYetSupportedError("/breakdown", "API Phase 2")

    def catalog(self) -> CatalogResponse:
        """``GET /v1/analytics/metrics/catalog`` — what your plan can query."""
        raise NotYetSupportedError("/metrics/catalog", "API Phase 2")

    def regression_detection(self, **params: Any) -> RegressionDetectionResponse:
        """``GET /v1/analytics/regression-detection`` — rolling p95 regression vs baseline.

        Requires the ``business`` plan or higher (otherwise 403).
        Backed by the BigQuery escape hatch on the server.
        """
        del params
        raise NotYetSupportedError("/regression-detection", "API Phase 3")

    def query(self, cube_query: dict[str, Any]) -> CubeQueryResponse:
        """``POST /v1/analytics/query`` — restricted Cube passthrough.

        Requires ``business`` plan or higher. Use only when a hand-shaped
        query cannot be expressed via the named endpoints; prefer the named
        ones for forward compatibility.
        """
        del cube_query
        raise NotYetSupportedError("POST /query", "API Phase 3")

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> ConvaiAnalytics:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    # ---------- HTTP transport (used by resources/) ----------

    def _get(self, path: str, params: dict[str, Any]) -> Any:
        wire_params = {
            _camelize(k): _stringify(v)
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

        return _deep_snake(response.json())


# ---------- wire-format helpers ----------


_CAMEL_RE = re.compile(r"_([a-z])")


def _camelize(s: str) -> str:
    return _CAMEL_RE.sub(lambda m: m.group(1).upper(), s)


_SNAKE_RE = re.compile(r"(?<!^)(?=[A-Z])")


def _snakify(s: str) -> str:
    return _SNAKE_RE.sub("_", s).lower()


def _stringify(v: Any) -> str:
    if isinstance(v, list):
        return ",".join(str(x) for x in v)
    return str(v)


def _deep_snake(value: Any) -> Any:
    if isinstance(value, list):
        return [_deep_snake(v) for v in value]
    if isinstance(value, dict):
        return {_snakify(k): _deep_snake(v) for k, v in value.items()}
    return value
