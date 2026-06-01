import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Best-effort append-only invocation ledger.
 *
 * Every tool call records one JSON line to ~/.intent-engineering-mcp/audit.jsonl
 * so an operator can answer "what did this server read, and what got rejected?"
 * after the fact. This is a *fail-open* ledger: logging must NEVER throw into
 * the tool path. If the home directory is read-only, the disk is full, or
 * anything else goes wrong, we swallow the error — a missing audit line is
 * strictly less bad than a tool call that crashes because logging failed.
 *
 * Disable entirely by setting INTENT_ENGINEERING_AUDIT_LOG="0".
 * See docs/SECURITY.md (§4 Known limitations: the log is local + plaintext).
 */

const DISABLE_ENV = "INTENT_ENGINEERING_AUDIT_LOG";
const LOG_DIR_NAME = ".intent-engineering-mcp";
const LOG_FILE_NAME = "audit.jsonl";

export type AuditOutcome = "ok" | "error" | "rejected";
export type AuditInputSource = "text" | "file";

export type AuditLogEntry = {
  ts: string; // ISO-8601 timestamp
  tool: string;
  input_source: AuditInputSource;
  file_path?: string;
  input_len: number;
  outcome: AuditOutcome;
  reject_reason?: string;
};

/** What callers pass in; `ts` is stamped here so handlers don't have to. */
export type AuditLogInput = Omit<AuditLogEntry, "ts">;

function isDisabled(): boolean {
  return process.env[DISABLE_ENV] === "0";
}

/** Resolve the audit log path. HOME override keeps tests hermetic. */
export function auditLogPath(): string {
  return path.join(os.homedir(), LOG_DIR_NAME, LOG_FILE_NAME);
}

/**
 * Append one JSON line describing a tool invocation. Best-effort: returns
 * normally even on failure, never throws. Returns `true` if a line was written,
 * `false` if logging was disabled or an error was swallowed (useful in tests).
 */
export async function recordInvocation(entry: AuditLogInput): Promise<boolean> {
  if (isDisabled()) return false;
  try {
    const full: AuditLogEntry = { ts: new Date().toISOString(), ...entry };
    const dir = path.dirname(auditLogPath());
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(auditLogPath(), JSON.stringify(full) + "\n", "utf-8");
    return true;
  } catch {
    // Fail open: a logging failure must never surface to the caller.
    return false;
  }
}
