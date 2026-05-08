# Publishing Convai Analytics Packages

This repo currently keeps the JavaScript package versions aligned:

- `@convai/analytics` from `packages/typescript`
- `@convai/analytics-cli` from `cli`
- `@convai/analytics-mcp` from `packages/mcp`

The Python package, `convai-analytics`, is published separately from `packages/python`.

## Preflight

From the repo root:

```bash
make ts-install
make ts-lint
make ts-test
make ts-build
make mcp-install
make mcp-lint
make mcp-test
make mcp-build
make mcp-smoke
make py-install
make py-lint
make py-test
```

For a live MCP smoke with a real user key:

```bash
export CONVAI_API_KEY="ck_live_your_key_here"
export CONVAI_ANALYTICS_BASE_URL="https://analytics-api.convai.com/v1/analytics"
export CONVAI_ANALYTICS_E2E_RANGE="last_30d"
cd packages/mcp
npm run e2e:prod
```

## JavaScript Packages

Confirm package metadata before broad public release:

```bash
cd packages/typescript
npm pack --dry-run

cd ../../cli
npm pack --dry-run

cd ../packages/mcp
npm pack --dry-run
```

Publish, preserving aligned versions:

```bash
cd packages/typescript
npm publish --access public

cd ../../cli
npm publish --access public

cd ../packages/mcp
npm publish --access public
```

## Python Package

Build and publish separately:

```bash
cd packages/python
uv build
uv publish
```

## Security Checklist

- Package tarballs contain only public SDK, CLI, MCP, docs, and examples.
- No package contains service credentials, direct database clients, BigQuery connection code, Cube secrets, or tenant/account override paths.
- MCP startup and tool errors do not print `CONVAI_API_KEY`.
- Plan-gated tools surface 402/403 as typed MCP tool errors rather than silently falling back.
