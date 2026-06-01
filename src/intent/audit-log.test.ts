import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { recordInvocation, auditLogPath } from "./audit-log.js";

const HOME_VARS = ["HOME", "USERPROFILE"] as const;
const DISABLE_ENV = "INTENT_ENGINEERING_AUDIT_LOG";

/**
 * Run `fn` with HOME pointed at a fresh tmp dir so the ledger writes somewhere
 * hermetic. os.homedir() reads $HOME on POSIX (libuv), so this fully isolates
 * the test from the real home directory. Restores env afterward.
 */
async function withTmpHome(
  fn: (home: string) => Promise<void>,
): Promise<void> {
  const home = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "ie-home-")));
  const prev: Record<string, string | undefined> = {};
  for (const v of HOME_VARS) {
    prev[v] = process.env[v];
    process.env[v] = home;
  }
  const prevDisable = process.env[DISABLE_ENV];
  delete process.env[DISABLE_ENV];
  try {
    await fn(home);
  } finally {
    for (const v of HOME_VARS) {
      if (prev[v] === undefined) delete process.env[v];
      else process.env[v] = prev[v];
    }
    if (prevDisable === undefined) delete process.env[DISABLE_ENV];
    else process.env[DISABLE_ENV] = prevDisable;
  }
}

async function readLines(file: string): Promise<string[]> {
  const raw = await fs.readFile(file, "utf-8");
  return raw.split("\n").filter((l) => l.length > 0);
}

test("a successful call appends one well-formed JSONL line", async () => {
  await withTmpHome(async () => {
    const wrote = await recordInvocation({
      tool: "audit_intent_spec",
      input_source: "text",
      input_len: 1234,
      outcome: "ok",
    });
    assert.equal(wrote, true);

    const lines = await readLines(auditLogPath());
    assert.equal(lines.length, 1);

    const entry = JSON.parse(lines[0]!);
    assert.equal(entry.tool, "audit_intent_spec");
    assert.equal(entry.input_source, "text");
    assert.equal(entry.input_len, 1234);
    assert.equal(entry.outcome, "ok");
    // ts is present and a valid ISO-8601 timestamp.
    assert.equal(typeof entry.ts, "string");
    assert.equal(Number.isNaN(Date.parse(entry.ts)), false);
    // No reject_reason on a clean call.
    assert.equal("reject_reason" in entry, false);
  });
});

test("a rejected call logs outcome:'rejected' with reject_reason and file_path", async () => {
  await withTmpHome(async () => {
    await recordInvocation({
      tool: "audit_intent_spec",
      input_source: "file",
      file_path: "/etc/passwd",
      input_len: 0,
      outcome: "rejected",
      reject_reason: 'extension "(none)" is not in the allowlist',
    });

    const lines = await readLines(auditLogPath());
    assert.equal(lines.length, 1);

    const entry = JSON.parse(lines[0]!);
    assert.equal(entry.outcome, "rejected");
    assert.equal(entry.input_source, "file");
    assert.equal(entry.file_path, "/etc/passwd");
    assert.match(entry.reject_reason, /allowlist/);
  });
});

test("two calls append two lines (append-only, not truncating)", async () => {
  await withTmpHome(async () => {
    await recordInvocation({
      tool: "assess_retrofit_level",
      input_source: "text",
      input_len: 10,
      outcome: "ok",
    });
    await recordInvocation({
      tool: "assess_retrofit_level",
      input_source: "text",
      input_len: 20,
      outcome: "error",
    });
    const lines = await readLines(auditLogPath());
    assert.equal(lines.length, 2);
    assert.equal(JSON.parse(lines[1]!).outcome, "error");
  });
});

test("disabling via INTENT_ENGINEERING_AUDIT_LOG=0 writes nothing", async () => {
  await withTmpHome(async () => {
    process.env[DISABLE_ENV] = "0";
    const wrote = await recordInvocation({
      tool: "audit_intent_spec",
      input_source: "text",
      input_len: 5,
      outcome: "ok",
    });
    assert.equal(wrote, false);
    await assert.rejects(() => fs.readFile(auditLogPath(), "utf-8"));
  });
});
