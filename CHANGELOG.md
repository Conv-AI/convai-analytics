# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Measure / segment / group-by constants modules.** Resource facades no longer hardcode strings like `"turnP95"` or `"endToEndTurnLatency"`. The TypeScript SDK exports `MEASURES`, `SEGMENTS`, `GROUP_BY`, `METRIC_NAMES`, and `METRIC_NAME_PREFIXES` from `@convai/analytics`; the Python SDK exposes the same shape via `convai_analytics.measures.{Measures, Segments, GroupBy, MetricNames, MetricNamePrefixes}`. A typo here surfaces as a TS / Python error rather than a server-side 400.
- **Pre-flight validator for `client.query(...)`.** Mirrors the constraints the backend's `POST /v1/analytics/query` enforces: ≥1 / ≤12 total members; all members prefixed `SessionMetrics.`; no `second` granularity; `limit` 1–5000. Raises a typed `ConvaiAnalyticsError` with `code` set to `empty_query`, `query_too_wide`, `invalid_member`, `forbidden_granularity`, or `invalid_limit` *before* the round trip. Backend remains the source of truth for any constraint the validator misses.
- **`make ts-typecheck-recipes` Makefile target + CI step.** Typechecks `examples/node/**/*.ts` and `recipes/charts/**/*.ts` against the live SDK source via `tsconfig.recipes.json`. Catches bitrot when SDK types tighten or methods rename — those scripts live outside the package's own typecheck scope so they used to drift silently.
- 6 new TypeScript tests + 9 new Python tests covering the query-validation paths.

### Fixed

- `recipes/charts/p95_over_time.ts` was calling `client.latency.overTime({ percentile: "p95" })`; the facade actually accepts `percentiles: Percentile[]`. Caught by the new recipe-typecheck step.
- `recipes/charts/latency_waterfall.ts` was passing `s.startTime` (now nullable in the generated types) to `Date.parse` without a guard. Drops untimed spans before computing `t0`.

## [0.2.0] - 2026-05-05

The full v1 endpoint surface is now wired. `timeseries`, `breakdown`,
`metrics/catalog`, paginated `sessions.list`, `sessions.get`,
`interactions.get`, `regression-detection`, and `query` all call live
backend endpoints; the placeholder pre-flight `NotYetSupportedError` for
those methods is gone. The convenience facades
(`client.latency.byComponent`, `client.providers.compare`,
`client.errors.summary`, `client.usage.summary` / `.interactions`,
`client.errors.overTime`, `client.latency.overTime`) work end-to-end on
top of the wired primitives.

### Added

- **`client.timeseries(...)`** — bucketed values for a measure across a
  time window. Defaults: `measure="count"`, `granularity="hour"`,
  `range="last_24h"`. Accepts the full filter dimension set
  (`characterId`, `appKey`, `experienceId`, `endUserId`, `provider`,
  `model`, `processor`, `status`, `metricName`, `metricNamePrefix`,
  `segment`, `groupBy`).
- **`client.breakdown(...)`** — group-by aggregation for a measure with a
  `limit` (1–500, default 50) and the same filter set as `timeseries`.
- **`client.catalog()`** — lists the metric names visible at the caller's
  plan tier.
- **`client.sessions.list(...)`** — paginated session list with
  `sort` (`recent`/`longest`/`slowest`), `limit` (1–100, default 25),
  and an opaque `cursor` returned via `nextCursor` for the next page.
- **`client.sessions.get(id)`** — full per-session timeline.
- **`client.interactions.get(id)`** — per-interaction component waterfall.
- **`client.regressionDetection(...)`** — rolling-window regression
  detection (business plan or higher). Accepts `measure`,
  `baselineRange`, `currentRange`, `groupBy`, and a `threshold` (0.0–10.0,
  default 0.15).
- **`client.query(cubeQuery)`** — restricted query passthrough
  (business plan or higher) for the long tail of questions.
- Pre-flight range validation for `timeseries`, `breakdown`, and
  `regressionDetection` (both `baselineRange` and `currentRange`).
- Test suites for both SDKs covering every endpoint:
  - TypeScript: 28 node:test cases across `validation.test.ts`,
    `endpoints.test.ts`, `facades.test.ts`, and `types.test.ts`. Tests
    use a stub `fetch` to assert URL, method, headers, query params,
    and request body.
  - Python: 29 pytest cases across `test_validation.py`,
    `test_endpoints.py`, and `test_facades.py`. Tests use
    `pytest-httpx` to stub the wire.

### Changed

- **Public response types are now generated aliases.** `SummaryResponse`,
  `TimeseriesResponse`, `BreakdownResponse`, `SessionListResponse`,
  `SessionDetail`, `InteractionTrace`, `CatalogResponse`,
  `RegressionDetectionResponse`, `CubeQueryResponse`, and their nested
  types are re-exports of the auto-generated `_generated.ts` /
  `_generated.py`. Drift between the SDK and the OpenAPI snapshot is now
  caught at compile time (TypeScript) or import time (Python).
- `client.summary()` is now an `async` method in TypeScript (was
  synchronous-with-promise-return-shape). The shape change only affects
  callers that wrap the call in `Promise.resolve(...)`.
- `RegressionDetectionResponse` aliases the backend's `RegressionResponse`
  schema; the SDK keeps the historical name on the public surface.
- `CubeQuery` now aliases the backend's `CubeQueryRequest` schema. The
  field names match what the backend accepts (`timeDimensions`,
  `dimensions`, etc.).

### Fixed

- **Python query-param encoding.** The previous Python client
  ran outgoing query-param keys through a snake_case → camelCase
  transform, sending camelCase keys to a backend that expected
  snake_case (e.g. `?characterId=…` instead of `?character_id=…`). The
  backend silently ignored the misnamed params, producing unfiltered
  responses. The transform is removed; Python kwargs flow through
  unchanged because they're already snake_case and so is the backend's
  query-string contract.
- The Python response path no longer runs `_deep_snake` on the wire
  payload. Generated Pydantic models accept the camelCase wire format
  directly via `populate_by_name=True` + alias generation, so the
  conversion is unnecessary work.

### Notes

- This release was tested against the Convai Analytics backend at
  `info.version` `0.1.0`, recorded in `openapi/convai-analytics-api.json`.
- `NotYetSupportedError` remains in the public error hierarchy as an
  exported class but is no longer raised by any SDK method. It will
  return when a future endpoint is announced before being wired (a rare
  case after this release).

## [0.1.0] - 2026-05-05

First publicly usable release. Today only `client.summary()` calls a live
backend endpoint; every other SDK method, CLI command, and convenience facade
raises a typed `NotYetSupportedError` pre-flight, so a customer or coding
agent never gets a confusing 404. The OpenAPI spec at
`openapi/convai-analytics-api.json` is now the source of truth for shipped
endpoints, and the SDK's response types are generated from it.

### Added

- `NotYetSupportedError` — typed pre-flight error raised by every SDK method
  whose backend endpoint hasn't shipped yet (`timeseries`, `breakdown`,
  `catalog`, `regressionDetection`, `query`, `sessions.*`, `interactions.*`,
  and all `latency` / `providers` / `errors` / `usage` facade methods).
  Carries the endpoint path and a hint about when server-side support is
  expected.
- `InvalidRangeError` — typed pre-flight error raised when `summary()` is
  given a range token outside the supported set (`last_15m`, `last_1h`,
  `last_6h`, `last_24h`, `last_7d`, `last_30d`).
- `PlanRequiredError` / `PlanInsufficientError` — typed errors mapped from
  402 / 403 responses, surfacing the required plan tier in the message.
- OpenAPI snapshot at `openapi/convai-analytics-api.json` and the supporting
  toolchain: `make sync-openapi` (pulls from the deployed API),
  `make sync-openapi-local` (regenerates offline from a sibling backend
  checkout), `make gen-types` (regenerates `_generated.{ts,py}`), and
  `make check-openapi` (CI gate that fails on a stale snapshot).
- Generated type modules at `packages/typescript/src/_generated.ts` (via
  `openapi-typescript`) and `packages/python/convai_analytics/_generated.py`
  (via `datamodel-code-generator`). The SDK's public `SummaryResponse`,
  `ResponseMeta`, and `EffectiveRange` are now re-exports of the generated
  definitions.
- GitHub Actions workflow running typecheck, lint, tests, a generated-types
  drift check, and a snapshot freshness check across both packages.
- Capability banner and endpoint status table in the top-level README and
  `docs/getting-started.md`, marking each endpoint as `live` or pointing at
  its planned release window.
- Live end-to-end smoke example at `examples/node/account-summary.ts`.

### Changed

- `SummaryParams` is now a closed interface of `range`, `characterId`,
  `appKey`, and `experienceId`. Previously declared fields that the backend
  silently ignored (`endUserId`, `metricName`, `metricNamePrefix`,
  `provider`, `model`, `processor`, `status`, `startTime`, `endTime`) are
  no longer accepted: TypeScript rejects them at compile time, and Python
  raises a clear `ValueError` for unknown keyword arguments.
- `client.summary()` validates the `range` token client-side before issuing
  the request; an unknown token raises `InvalidRangeError` rather than
  producing a server-side Cube error.
- `client.summary()` is now `async` in TypeScript so the range-validation
  throw becomes a Promise rejection (consistent with the rest of the
  client surface).
- CLI commands other than `summary` (`timeseries`, `chart`, `interaction`,
  `sessions`) exit non-zero with the `NotYetSupportedError` message rather
  than firing an HTTP request that 404s.

### Fixed

- `client.summary()` no longer silently accepts fields the backend ignores;
  passing an unsupported field is now a typed error rather than a wrong
  answer with unfiltered numbers.
- Python package's `__init__.py` re-export ordering, which previously
  triggered a circular import between `__version__` and `client.py`.

### Notes

- This release was tested against the Convai Analytics backend at
  `info.version` `0.1.0`, recorded in `openapi/convai-analytics-api.json`.
  See [openapi/README.md](openapi/README.md) for how SDK versions relate to
  the backend version pinned in the snapshot.
