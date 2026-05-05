# OpenAPI

This directory mirrors the canonical OpenAPI 3.1 spec published by `Conv-AI/convai-analytics-api` at `/openapi.json` (FastAPI publishes it automatically).

## Source of truth

The `convai-analytics-api` service owns the spec. This repo's copy is a frozen snapshot, refreshed via:

```bash
make sync-openapi
# or override the source URL:
ANALYTICS_API_OPENAPI=https://analytics-api-preview.convai.com/v1/analytics/openapi.json make sync-openapi
```

The fetched spec is written to `openapi/convai-analytics-api.json`. Commit it to record what API contract this version of the SDK was generated against.

## Why mirror it

- **SDK code generation.** The TypeScript and Python SDKs are partially generated from the spec; the rest is hand-written ergonomic wrappers.
- **Type checking against a known contract.** A breaking change in the API repo shows up as a diff here.
- **MCP server (Phase 7).** The future MCP server reads this spec to build tool definitions.

## Notes

- The spec is versioned alongside the SDK (not the API). When the API publishes a new spec version we bump the SDK and re-sync.
- Until Phase 4 of the API repo lands real endpoints, only `/healthz`, `/readyz`, and `/openapi.json` itself appear in the spec.
