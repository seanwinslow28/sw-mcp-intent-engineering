import { test } from "node:test";
import assert from "node:assert/strict";
import { auditIntentSpec } from "./audit.js";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * A document nothing was recognized in must score 0/25 (2026-08-29).
 *
 * It used to score 1/25. `stop.zero-interaction-mandate` is the one
 * conditional check in the rubric: its "(For scheduled agents)" precondition is
 * not applicable to a non-scheduled agent, and not-applicable was encoded as
 * `pass`. An empty document parses as non-autonomous, so it took that branch
 * and collected the point. That is a rubric item crediting a document it never
 * saw, which is the same disease as a chunk score published as a file score,
 * just smaller.
 *
 * The fix is narrow on purpose: the free pass is still correct for a real
 * non-autonomous spec, so the guard fires only when NOTHING was recognized.
 */

const score = (s: string): number => Number(s.split("/")[0]);

/** A real, non-autonomous spec: nothing here trips the scheduled-agent detector. */
const NON_AUTONOMOUS_SPEC = `## Objective
Support tickets pile up unresolved, which is a problem because customers wait too long. This matters so the team can respond faster. When facing trade-offs, prioritize quality over speed.

## Desired Outcomes
- Each customer ticket has a validated resolution status that exists in the system.
- Users see fewer than 3 open tickets older than 24 hours.

## Health Metrics
- metric: CSAT score, must not drop below 90% -> if trending wrong, route to a human.

## Stop Rules
- complete_when: every ticket has a resolution status and all verification checks pass.
`;

test("empty document: whitespace-only input scores 0/25, not 1/25", async () => {
  const out = await auditIntentSpec({ spec_text: " ".repeat(60) });

  assert.equal(score(out.validation_score), 0);
  assert.ok(
    out.section_findings.every((f) => f.status === "missing"),
    "every section must report missing when nothing was recognized",
  );
});

test("empty document: prose with no recognized sections scores 0/25", async () => {
  const prose = "This is a paragraph about nothing in particular. ".repeat(20);
  const out = await auditIntentSpec({ spec_text: prose });

  assert.equal(score(out.validation_score), 0);
});

test("empty document: a read past the end of a file scores 0/25 on zero characters", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "intent-empty-"));
  const file = path.join(dir, "spec.md");
  await fs.writeFile(file, NON_AUTONOMOUS_SPEC, "utf-8");

  const out = await auditIntentSpec({
    file_path: file,
    start_index: 100_000,
    max_length: 10_000,
  });

  assert.equal(out.coverage.chars_graded, 0);
  assert.equal(score(out.validation_score), 0);

  await fs.rm(dir, { recursive: true, force: true });
});

test("empty document: a genuine non-autonomous spec keeps its not-applicable pass", async () => {
  // Regression guard on the narrowness of the fix. This spec IS recognized, so
  // the scheduled-agent check stays not-applicable rather than being penalized.
  const out = await auditIntentSpec({ spec_text: NON_AUTONOMOUS_SPEC });

  assert.ok(score(out.validation_score) > 0, "a real spec must still score");
  assert.equal(
    out.section_findings.find((f) => f.section === "stop_rules_verification")
      ?.status !== "missing",
    true,
    "stop rules are present here and must not be forced to missing",
  );
});

test("empty document: the canonical skill still scores 23/25 whole", async () => {
  // The headline number. Its zero-interaction point is a real match (the skill
  // parses as autonomous), not the vacuous branch, so this fix must not move it.
  const out = await auditIntentSpec({
    file_path:
      "/Users/seanwinslow/Code-Brain/code-brain/.claude/skills/intent-engineering/SKILL.md",
  });

  assert.equal(out.validation_score, "23/25");
  assert.deepEqual(out.anti_patterns_detected, []);
  assert.equal(out.coverage.complete, true);
});
