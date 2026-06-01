#!/usr/bin/env node
import { promises as fs } from "node:fs";
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
import {
  RETROFIT_INPUT_SCHEMA_SHAPE,
  AssessRetrofitLevelInputSchema,
  assessRetrofitLevel,
} from "./intent/retrofit.js";
import { SafeFsError } from "./intent/safe-fs.js";
import {
  recordInvocation,
  type AuditInputSource,
} from "./intent/audit-log.js";

const server = new McpServer({
  name: "intent-engineering",
  version: "0.1.1",
});

/**
 * Best-effort input length for the audit ledger:
 *   - text input  -> characters supplied by the caller
 *   - file input  -> bytes on disk (the file already passed the safe-fs guard,
 *                    so this stat is bounded to <= 1 MiB and side-effect free)
 * Returns 0 if the size can't be determined. Never throws.
 */
async function fileByteLen(filePath: string): Promise<number> {
  try {
    return (await fs.stat(filePath)).size;
  } catch {
    return 0;
  }
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Shape of the unvalidated args we may inspect when parsing fails. */
type RawFileArgs = { file_path?: unknown; spec_text?: unknown; skill_text?: unknown };

/** Infer input_source from raw (pre-validation) args for rejection logging. */
function inferSource(raw: unknown): AuditInputSource {
  const r = (raw ?? {}) as RawFileArgs;
  return typeof r.file_path === "string" && r.file_path.length > 0
    ? "file"
    : "text";
}

server.registerTool(
  "audit_intent_spec",
  {
    title: "Audit Intent Spec",
    description:
      "Audit an intent spec against the 25-item validation checklist and the 5 fatal anti-patterns from the intent-engineering skill. Provide either spec_text (raw spec) OR file_path (absolute path to a markdown or YAML file). For long inputs, use start_index + max_length to paginate; the response includes next_chunk_token when more content remains.",
    inputSchema: AUDIT_INPUT_SCHEMA_SHAPE,
  },
  async (rawArgs) => {
    const tool = "audit_intent_spec";
    let args;
    try {
      args = AuditIntentSpecInputSchema.parse(rawArgs);
    } catch (e) {
      const msg = errMessage(e);
      await recordInvocation({
        tool,
        input_source: inferSource(rawArgs),
        outcome: "rejected",
        input_len: 0,
        reject_reason: msg,
      });
      return {
        isError: true,
        content: [{ type: "text", text: `${tool} error: ${msg}` }],
      };
    }

    const source: AuditInputSource = args.file_path ? "file" : "text";
    try {
      const out = await auditIntentSpec(args);
      await recordInvocation({
        tool,
        input_source: source,
        file_path: args.file_path,
        input_len: args.file_path
          ? await fileByteLen(args.file_path)
          : (args.spec_text?.length ?? 0),
        outcome: "ok",
      });
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    } catch (e) {
      const msg = errMessage(e);
      const rejected = e instanceof SafeFsError;
      await recordInvocation({
        tool,
        input_source: source,
        file_path: args.file_path,
        input_len: args.spec_text?.length ?? 0,
        outcome: rejected ? "rejected" : "error",
        reject_reason: rejected ? msg : undefined,
      });
      return {
        isError: true,
        content: [{ type: "text", text: `${tool} error: ${msg}` }],
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
    const tool = "generate_intent_spec_scaffold";
    let args;
    try {
      args = GenerateIntentSpecScaffoldInputSchema.parse(rawArgs);
    } catch (e) {
      const msg = errMessage(e);
      await recordInvocation({
        tool,
        input_source: "text",
        outcome: "rejected",
        input_len: 0,
        reject_reason: msg,
      });
      return {
        isError: true,
        content: [{ type: "text", text: `${tool} error: ${msg}` }],
      };
    }

    try {
      const out = generateIntentSpecScaffold(args);
      await recordInvocation({
        tool,
        input_source: "text",
        input_len: args.objective_hint?.length ?? 0,
        outcome: "ok",
      });
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    } catch (e) {
      const msg = errMessage(e);
      await recordInvocation({
        tool,
        input_source: "text",
        input_len: args.objective_hint?.length ?? 0,
        outcome: "error",
      });
      return {
        isError: true,
        content: [{ type: "text", text: `${tool} error: ${msg}` }],
      };
    }
  },
);

server.registerTool(
  "assess_retrofit_level",
  {
    title: "Assess Retrofit Level",
    description:
      "Look at an existing prompt or SKILL.md and recommend the right retrofit level (L1-mvr / L2-structured / L3-full) with reasoning grounded in the intent-engineering skill's blast-radius / complexity / autonomy framework. Provide either skill_text (raw text) OR file_path (absolute path to an existing SKILL.md or prompt file).",
    inputSchema: RETROFIT_INPUT_SCHEMA_SHAPE,
  },
  async (rawArgs) => {
    const tool = "assess_retrofit_level";
    let args;
    try {
      args = AssessRetrofitLevelInputSchema.parse(rawArgs);
    } catch (e) {
      const msg = errMessage(e);
      await recordInvocation({
        tool,
        input_source: inferSource(rawArgs),
        outcome: "rejected",
        input_len: 0,
        reject_reason: msg,
      });
      return {
        isError: true,
        content: [{ type: "text", text: `${tool} error: ${msg}` }],
      };
    }

    const source: AuditInputSource = args.file_path ? "file" : "text";
    try {
      const out = await assessRetrofitLevel(args);
      await recordInvocation({
        tool,
        input_source: source,
        file_path: args.file_path,
        input_len: args.file_path
          ? await fileByteLen(args.file_path)
          : (args.skill_text?.length ?? 0),
        outcome: "ok",
      });
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    } catch (e) {
      const msg = errMessage(e);
      const rejected = e instanceof SafeFsError;
      await recordInvocation({
        tool,
        input_source: source,
        file_path: args.file_path,
        input_len: args.skill_text?.length ?? 0,
        outcome: rejected ? "rejected" : "error",
        reject_reason: rejected ? msg : undefined,
      });
      return {
        isError: true,
        content: [{ type: "text", text: `${tool} error: ${msg}` }],
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
