import { ConvaiAnalytics } from "@convai/analytics";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { errorResult, jsonResult, requireApiKey } from "./results.js";
import { ANALYTICS_TOOLS } from "./tools.js";

export interface CreateServerOptions {
  env?: NodeJS.ProcessEnv;
}

export function createAnalyticsMcpServer(options: CreateServerOptions = {}): McpServer {
  const env = options.env ?? process.env;
  const server = new McpServer({
    name: "@convai/analytics-mcp",
    version: "0.2.0",
  });

  const clientFactory = () =>
    new ConvaiAnalytics({
      apiKey: requireApiKey(env),
      baseUrl: env.CONVAI_ANALYTICS_BASE_URL,
    });

  for (const tool of ANALYTICS_TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = await tool.handler(clientFactory(), args);
          return jsonResult(result);
        } catch (err) {
          return errorResult(err);
        }
      },
    );
  }

  registerPrompts(server);
  registerResources(server, clientFactory);
  return server;
}
