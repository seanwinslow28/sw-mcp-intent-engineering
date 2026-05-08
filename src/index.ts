#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "intent-engineering",
  version: "0.1.0",
});

server.registerTool(
  "ping",
  {
    title: "Ping",
    description:
      "Health check. Returns 'pong' to confirm the intent-engineering MCP server is connected.",
    inputSchema: {},
  },
  async () => ({
    content: [{ type: "text", text: "pong" }],
  }),
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("intent-engineering MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting intent-engineering MCP server:", err);
  process.exit(1);
});
