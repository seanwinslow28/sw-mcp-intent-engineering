#!/usr/bin/env node
/**
 * Batch audit: walks every SKILL.md in Sean's Superuser Pack and calls
 * assessRetrofitLevel directly (same logic the MCP transport invokes,
 * no transport overhead for a one-shot batch job). Outputs a flat
 * RFC 4180 CSV to examples/superuser-pack-retrofit-assessment.csv.
 *
 * Scope-lock §10.6 deliverable.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type RetrofitLevel = "L1-mvr" | "L2-structured" | "L3-full";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Walk up until we find package.json — handles both `scripts/audit-superuser-pack.ts`
// (source) and `scripts/.dist/audit-superuser-pack.js` (compiled) layouts.
async function findRepoRoot(start: string): Promise<string> {
  let current = start;
  for (let i = 0; i < 6; i++) {
    try {
      await fs.access(path.join(current, "package.json"));
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  throw new Error(`Could not locate repo root from ${start}`);
}
const REPO_ROOT = await findRepoRoot(__dirname);
const retrofitUrl = pathToFileURL(path.join(REPO_ROOT, "build/intent/retrofit.js")).href;
const { assessRetrofitLevel } = (await import(retrofitUrl)) as {
  assessRetrofitLevel: (input: { file_path: string }) => Promise<{
    current_state: string;
    recommended_level: RetrofitLevel;
    reasoning: string;
    estimated_time: string;
    blast_radius: string;
    complexity: string;
    autonomy_assumed: string;
    next_steps: string[];
  }>;
};

const HOME = process.env.HOME ?? "";
/**
 * Corpus location. The original hardcoded path
 * (`~/Code-Brain/claude-code-superuser-pack`) went dead: that checkout no
 * longer contains the skills, and the 118-file corpus lives on in
 * `code-brain/.claude/skills/` (recorded 2026-08-28 during the README
 * re-verification). Parameterized 2026-08-29 so a stale default fails loudly
 * and can be overridden without editing this file.
 *
 * Precedence: argv[2] > SUPERUSER_PACK_ROOT > the code-brain default.
 *
 * Corpus drift: the shipped CSV and the README's percentages are over 118
 * files (2026-05). The default root holds 135 as of 2026-08-29. A re-run grades
 * a superset, so its counts are not comparable to the published 118-file split
 * unless the file list is filtered to match. Report N with any figure taken
 * from a re-run.
 */
const SOURCE_ROOT = path.resolve(
  process.argv[2] ??
    process.env.SUPERUSER_PACK_ROOT ??
    path.join(HOME, "Code-Brain/code-brain"),
);
const SKILLS_DIR = path.join(SOURCE_ROOT, ".claude/skills");
const OUTPUT_PATH = path.join(REPO_ROOT, "examples/superuser-pack-retrofit-assessment.csv");

const BUDGET_MS = 90 * 60 * 1000;
const PROGRESS_INTERVAL = 10;

type LevelOrError = RetrofitLevel | "ERROR";

async function walkSkillFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name === "SKILL.md") {
        results.push(full);
      }
    }
  }
  return results.sort();
}

function csvCell(value: string | undefined | null): string {
  if (value === undefined || value === null) return "";
  const s = String(value);
  if (/["\n\r,]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(values: Array<string | undefined | null>): string {
  return values.map(csvCell).join(",");
}

async function main(): Promise<void> {
  const start = Date.now();
  let files: string[];
  try {
    files = await walkSkillFiles(SKILLS_DIR);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      throw new Error(
        `No skills directory at ${SKILLS_DIR}. Pass the corpus root as the first argument, or set SUPERUSER_PACK_ROOT.`,
      );
    }
    throw err;
  }
  const total = files.length;
  if (total === 0) {
    throw new Error(
      `Found no SKILL.md files under ${SKILLS_DIR}. Pass the corpus root as the first argument, or set SUPERUSER_PACK_ROOT.`,
    );
  }
  process.stderr.write(`Discovered ${total} SKILL.md files under ${SKILLS_DIR}\n`);
  process.stderr.write(`Output: ${OUTPUT_PATH}\n`);
  process.stderr.write(`Budget: 90 minutes\n\n`);

  const headers = [
    "skill_path",
    "current_state",
    "recommended_level",
    "reasoning",
    "blast_radius",
    "complexity",
    "autonomy_assumed",
    "estimated_time",
    "next_steps",
  ];

  const dataRows: string[] = [];
  const counts: Record<LevelOrError, number> = {
    "L1-mvr": 0,
    "L2-structured": 0,
    "L3-full": 0,
    ERROR: 0,
  };
  const errorList: Array<{ skill: string; message: string }> = [];

  let partial = false;
  let stoppedAt = 0;

  for (let i = 0; i < total; i++) {
    const elapsedMs = Date.now() - start;
    if (elapsedMs >= BUDGET_MS) {
      partial = true;
      stoppedAt = i;
      break;
    }

    const filePath = files[i] as string;
    const relPath = path.relative(SOURCE_ROOT, filePath);
    let level: LevelOrError;

    try {
      const result = await assessRetrofitLevel({ file_path: filePath });
      level = result.recommended_level;
      dataRows.push(
        csvRow([
          relPath,
          result.current_state,
          result.recommended_level,
          result.reasoning,
          result.blast_radius,
          result.complexity,
          result.autonomy_assumed,
          result.estimated_time,
          (result.next_steps ?? []).join(" | "),
        ]),
      );
    } catch (err) {
      level = "ERROR";
      const message = (err instanceof Error ? err.message : String(err)).slice(0, 200);
      dataRows.push(csvRow([relPath, "", "ERROR", message, "", "", "", "", ""]));
      errorList.push({ skill: relPath, message });
    }

    counts[level] += 1;
    const processed = i + 1;
    if (processed % PROGRESS_INTERVAL === 0 || processed === total) {
      const elapsedSec = Math.round((Date.now() - start) / 1000);
      process.stderr.write(`[${processed}/${total}] ${relPath} → ${level} (${elapsedSec}s elapsed)\n`);
    }
  }

  const processed = partial ? stoppedAt : total;
  const headerLine = partial
    ? `# Partial: audited ${processed} of ${total} — stopped at 90-min budget per scope-lock §10.6\n`
    : "";
  const content = headerLine + headers.join(",") + "\n" + dataRows.join("\n") + "\n";

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, content, "utf-8");

  const elapsedSec = Math.round((Date.now() - start) / 1000);
  process.stderr.write(`\n=== Summary ===\n`);
  process.stderr.write(`Output written: ${OUTPUT_PATH}\n`);
  process.stderr.write(`Processed: ${processed} of ${total}\n`);
  process.stderr.write(`Elapsed: ${elapsedSec}s\n`);
  process.stderr.write(`L1-mvr:        ${counts["L1-mvr"]}\n`);
  process.stderr.write(`L2-structured: ${counts["L2-structured"]}\n`);
  process.stderr.write(`L3-full:       ${counts["L3-full"]}\n`);
  process.stderr.write(`ERROR:         ${counts.ERROR}\n`);
  if (errorList.length > 0) {
    process.stderr.write(`\nError details:\n`);
    for (const e of errorList) {
      process.stderr.write(`  ${e.skill}: ${e.message}\n`);
    }
  }
  if (partial) {
    process.stderr.write(`\n*** PARTIAL: 90-min hard stop hit at ${processed} skills. ***\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`FATAL: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
