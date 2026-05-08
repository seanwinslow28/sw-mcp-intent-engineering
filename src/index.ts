#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  AUDIT_INPUT_SCHEMA_SHAPE,
  AuditIntentSpecInputSchema,
  auditIntentSpec,
} from "./intent/audit.js";
import {
  SCAFFOLD_INPUT_SCHEMA_SHAPE,
  GenerateIntentSpecScaffoldInputSchema,
  generateIntentSpecScaffold,
} from "./intent/scaffold.js";

const server = new McpServer({
  name: "intent-engineering",
  version: "0.1.0",
});

server.registerTool(
  "audit_intent_spec",
  {
    title: "Audit Intent Spec",
    description:
      "Audit an intent spec against the 25-item validation checklist and the 5 fatal anti-patterns from the intent-engineering skill. Provide either spec_text (raw spec) OR file_path (absolute path to a markdown or YAML file). For long inputs, use start_index + max_length to paginate; the response includes next_chunk_token when more content remains.",
    inputSchema: AUDIT_INPUT_SCHEMA_SHAPE,
  },
  async (rawArgs) => {
    const args = AuditIntentSpecInputSchema.parse(rawArgs);
    try {
      const out = await auditIntentSpec(args);
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `audit_intent_spec error: ${msg}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "generate_intent_spec_scaffold",
  {
    title: "Generate Intent Spec Scaffold",
    description:
      "Return the appropriate intent-spec template (blank, Level-1 MVR, or full 9-section) with optional pre-filled objective_hint, autonomy_level, and agent_name. Use this when starting a new agent/skill or retrofitting an existing one.",
    inputSchema: SCAFFOLD_INPUT_SCHEMA_SHAPE,
  },
  async (rawArgs) => {
    const args = GenerateIntentSpecScaffoldInputSchema.parse(rawArgs);
    try {
      const out = generateIntentSpecScaffold(args);
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `generate_intent_spec_scaffold error: ${msg}`,
          },
        ],
      };
    }
  },
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
