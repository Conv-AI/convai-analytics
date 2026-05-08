# Authentication

## API key

Every request to `analytics-api.convai.com/v1/analytics/*` carries the `CONVAI-API-KEY` header. The same key you use elsewhere in the Convai API.

```http
GET /v1/analytics/summary?range=last_24h HTTP/1.1
Host: analytics-api.convai.com
CONVAI-API-KEY: ck_live_...
```

The SDK and CLI read the key from the `CONVAI_API_KEY` environment variable by default; pass `apiKey` / `api_key` explicitly to override.

```ts
new ConvaiAnalytics({ apiKey: "ck_live_..." });
```

```python
ConvaiAnalytics(api_key="ck_live_...")
```

The key resolves server-side (via Convai Middleman) to a `(tenant_id, plan)` pair. **All authorization happens server-side** — every query is forcibly scoped to your tenant before any data is read. The SDK does not (and cannot) influence the scoping.

Keep the key server-side. `CONVAI_API_KEY` is a bearer credential: whoever has it can query analytics for the resolved account subject to that account's plan and quota. Do not put it in browser JavaScript, mobile apps, public repos, shared notebooks, screenshots, or log output. For product UIs, proxy analytics requests through your own backend or a Convai-managed authenticated surface instead of calling the API directly from an untrusted client.

## Plan tiers

The analytics API is gated by plan:

| Plan | API access | Visibility tiers | Notes |
|---|---|---|---|
| free / starter | ✅ | PUBLIC | Small monthly API quota for evaluation. |
| **scale** | ✅ | PUBLIC | Basic REST endpoints, rate-limited. |
| **business** | ✅ | PUBLIC + ENTERPRISE | Adds `regression-detection` and the `query` passthrough; per-processor breakdowns. |
| **enterprise** | ✅ | PUBLIC + ENTERPRISE | Higher quotas, longer retention, SLAs. |
| internal (Convai staff) | ✅ | PUBLIC + ENTERPRISE + INTERNAL | Used by Convai support and engineering only. |

A request below the required plan returns:
- **402 Payment Required** if your plan is below `scale` (no API access at all).
- **403 Forbidden** if you have API access but the specific endpoint requires a higher plan (e.g. `regression-detection` requires `business`).

## Rate limits

Token-bucket per API key, returned in standard headers:

| Plan | Sustained rate | Daily cap |
|---|---|---|
| scale | 60 req/min | 1,000 req/day |
| business | 300 req/min | 10,000 req/day |
| enterprise | 1,000 req/min | unlimited (soft) |

When you exceed the limit you get **429 Too Many Requests** with a `Retry-After` header (seconds until the bucket refills). The SDK does not auto-retry by default — agents should respect `Retry-After` rather than hammering.

## Visibility tiers

Every metric row in the Convai telemetry has a `visibility` tag: `public`, `enterprise`, or `internal`. Your plan determines which tiers your queries can see:

- **scale** → `public` only
- **business** / **enterprise** → `public` + `enterprise`
- **internal** → all three (Convai staff only)

This is enforced inside the Cube semantic layer — the `INTERNAL` tier never leaves Convai's perimeter, regardless of how a query is constructed.

## Errors

Every error response has a stable JSON shape:

```json
{
  "error": {
    "code": "plan_below_required",
    "message": "Endpoint /v1/analytics/regression-detection requires plan 'business' (current: 'scale').",
    "details": { "required_plan": "business", "current_plan": "scale" }
  }
}
```

The TS and Python SDKs raise typed exceptions:

| HTTP | TS exception | Python exception |
|---|---|---|
| 401 | `AuthenticationError` | `AuthenticationError` |
| 402 | `PlanRequiredError` | `PlanRequiredError` |
| 403 | `PlanInsufficientError` | `PlanInsufficientError` |
| 404 | `NotFoundError` | `NotFoundError` |
| 422 | `ValidationError` | `ValidationError` |
| 429 | `RateLimitError` (carries `retryAfter`) | `RateLimitError` (carries `retry_after`) |
| 5xx | `ServerError` | `ServerError` |

The SDKs also raise two **pre-flight** errors that never reach the wire (so they have no HTTP status):

| Source | TS exception | Python exception | When |
|---|---|---|---|
| client-side | `InvalidRangeError` | `InvalidRangeError` | The `range` argument is not one of the accepted tokens. |
| client-side | `NotYetSupportedError` | `NotYetSupportedError` | The SDK method maps to an endpoint the analytics API has not yet shipped (see [README endpoint catalog](../README.md#endpoint-catalog-v1) for status). |

Both subclass `ConvaiAnalyticsError`, so a single `except ConvaiAnalyticsError` (Python) or `instanceof ConvaiAnalyticsError` (TS) handler catches them alongside HTTP errors.

## Local development against preview

Convai runs a preview environment at `analytics-api-preview.convai.com`. To point the SDK at it:

```bash
export CONVAI_ANALYTICS_BASE_URL=https://analytics-api-preview.convai.com/v1/analytics
```

Use a preview-tier API key (issued separately from prod keys).
