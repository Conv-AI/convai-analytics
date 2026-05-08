# OpenAPI

This directory mirrors the canonical OpenAPI 3.1 spec published by [`Conv-AI/convai-analytics-api`](https://github.com/Conv-AI/convai-analytics-api) at `/openapi.json` (FastAPI publishes it automatically). The committed snapshot at [convai-analytics-api.json](convai-analytics-api.json) is the source of truth from which `_generated.ts` and `_generated.py` are derived.

## Refresh the snapshot

When the API ships a new endpoint or schema change, regenerate the snapshot and rerun the type generators:

```bash
# When the API is deployed and reachable
make sync-openapi
# Or override the source URL
ANALYTICS_API_OPENAPI=https://analytics-api-preview.convai.com/v1/analytics/openapi.json make sync-openapi

# Or if the API isn't deployed yet — generate from a local checkout
make sync-openapi-local        # defaults to ANALYTICS_API_REPO=../convai-analytics-api

# Then regenerate the typed stubs in both SDKs
make gen-types
```

Commit `convai-analytics-api.json` together with the regenerated `_generated.{ts,py}` so reviewers can see the schema diff alongside the type diff.

## Why mirror it

- **SDK code generation.** `SummaryResponse`, `ResponseMeta`, etc. in the TypeScript and Python SDKs are aliases over the generated types — the schema is the contract. Types for endpoints the API hasn't shipped yet (Phase 2/3) are still hand-written and will flip to generated as those endpoints land.
- **CI gate.** The `generated-types-up-to-date` job in [.github/workflows/ci.yml](../.github/workflows/ci.yml) regenerates the types and fails the build if the committed `_generated.{ts,py}` drifts from `convai-analytics-api.json`.
- **MCP server (later phase).** The future MCP server will read this spec to build tool definitions.

## Version pinning

The SDK's own version (the `version` fields in `packages/typescript/package.json`, `packages/python/pyproject.toml`, and `cli/package.json`) is **independent** from the backend's `info.version` inside the OpenAPI snapshot. They evolve on different cadences:

- **`info.version`** in [convai-analytics-api.json](convai-analytics-api.json) records which backend release this SDK was tested against. It is set by FastAPI from the API repo's package version and refreshes whenever you re-run `make sync-openapi` (or `make sync-openapi-local`). Treat it as a pin: "the schemas in this file came from backend vX.Y.Z."
- **SDK version** is what customers install (`@convai/analytics@x.y.z`, `convai-analytics==x.y.z`). Bump it on the SDK's own schedule — not in lockstep with the backend.

Re-syncing the snapshot pulls in whatever `info.version` the backend currently reports. Most refreshes are additive (new endpoints, new fields) and don't require an SDK version bump on their own. **Bump the SDK version when a re-sync brings in a breaking schema change** that materially shifts the SDK's public surface — e.g. a removed field, a renamed type, a tightened response shape that downstream code needs to adapt to. The CHANGELOG entry for that SDK release should call out the backend `info.version` it was synced against so customers can correlate.

## What's currently in the snapshot

Today (v0.1) only the shipped endpoints appear: `GET /v1/analytics/summary` plus `/healthz` and `/readyz`. Phase 2 will add `/timeseries`, `/breakdown`, `/sessions`, `/sessions/{id}`, `/interactions/{id}`, `/metrics/catalog`. Phase 3 adds `/regression-detection` and `POST /query`. The schema grows, the SDK's hand-written stubs collapse into generated aliases, the `NotYetSupportedError` stubs disappear.
