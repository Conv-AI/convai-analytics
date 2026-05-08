#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createAnalyticsMcpServer } from "./server.js";

const HELP = `Convai Analytics MCP Server

Usage:
  CONVAI_API_KEY=your_convai_key npx -y @convai/analytics-mcp

Environment:
  CONVAI_API_KEY                Required for tool/resource calls
  CONVAI_ANALYTICS_BASE_URL     Optional, defaults to production analytics API

This server uses local stdio transport and wraps the public @convai/analytics SDK only.
`;

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(HELP);
    return;
  }

  const server = createAnalyticsMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Convai Analytics MCP server failed: ${message}\n`);
  process.exit(1);
});

export { createAnalyticsMcpServer } from "./server.js";
export { ANALYTICS_TOOLS } from "./tools.js";
