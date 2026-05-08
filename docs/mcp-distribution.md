# MCP Distribution Plan

The Convai Analytics MCP server is published from `packages/mcp` as `@convai/analytics-mcp`.

## Canonical Registry

The canonical MCP registry identity is:

```text
io.github.conv-ai/convai-analytics-mcp
```

The registry manifest lives in:

- [`../server.json`](../server.json)
- [`../packages/mcp/server.json`](../packages/mcp/server.json)

Both manifests point to the npm package and use `CONVAI_API_KEY` as the only required credential.

## Npm

Publish the JavaScript packages in this order:

1. `@convai/analytics`
2. `@convai/analytics-mcp`
3. `@convai/analytics-cli`

The source tree uses local `file:` dependencies so CI can test unpublished packages. The publish workflow rewrites those local dependencies to the exact release version before running `npm publish`.

## Official MCP Registry

After the npm package is public, publish `server.json` to the Official MCP Registry. The GitHub Actions workflow `.github/workflows/publish-mcp-registry.yml` handles this with GitHub OIDC:

```text
Actions -> Publish MCP Registry -> Run workflow -> version 0.2.0
```

Requirements:

- The repo needs an `NPM_TOKEN` secret with publish rights to the `@convai` npm scope.
- The package `@convai/analytics-mcp` must include `mcpName` matching `server.json`.
- The GitHub org namespace `io.github.conv-ai/*` must be authorized by the registry OIDC flow.

## Secondary Marketplaces

After the Official MCP Registry entry exists, submit or claim listings in:

- GitHub MCP Registry, once it ingests the official registry entry.
- Smithery, preferably after we ship a remote Streamable HTTP server or MCPB bundle; local stdio discovery can still be listed manually.
- Glama, which indexes public MCP servers and can display install snippets.
- PulseMCP and mcp.so for additional SEO and directory presence.
- Docker MCP Catalog after we publish a signed container image.

## Awareness Checklist

- Add MCP install snippets to Convai public docs.
- Add a changelog item in the Convai dashboard or docs site.
- Announce in customer/community channels with the message: "Ask Convai Analytics from Claude, Cursor, Codex, and VS Code using your Convai API key."
- Include example prompts for production-readiness latency sign-off, slow-session drilldown, usage trends, active-session concurrency, provider/model latency, and reliability trends.
