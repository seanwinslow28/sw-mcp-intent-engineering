import { test } from "node:test";
import assert from "node:assert/strict";
import { auditIntentSpec, AuditIntentSpecInputSchema } from "./audit.js";

/**
 * Whole-file grading (2026-08-29, CHANGELOG "whole-file audit aggregation").
 *
 * These tests pin the behavior that the 2026-08-28 dogfood correction was
 * about: before this change, a call with no pagination arguments graded only
 * the first 10,000 characters and reported the result in a shape
 * indistinguishable from a whole-document grade. The canonical skill is 32,556
 * characters, so three quarters of it had never been graded in one call.
 */

const OBJECTIVE = `## Objective
Support tickets pile up unresolved, which is a problem because customers wait too long and churn. This matters so the support team can respond faster. When facing trade-offs, prioritize resolution quality over raw speed.`;

const STOP_RULES = `## Stop Rules
- halt_when: critical data corruption detected → halt and alert the on-call engineer.
- escalate_when: confidence below 80%, or after 3 consecutive failures in a row.
- complete_when: every ticket has a resolution status and all verification checks pass.`;

const EDGE_CASES = `## Edge Cases
- When the ticket body is empty, halt and request more information.
- When the support API is down, queue the ticket and retry later.
- When two priorities conflict, urgent SLA tickets take precedence over routine ones.
- When a duplicate ticket exists, merge it into the original.
- When the customer is unidentified, escalate to a human reviewer.`;

/**
 * Filler that carries no heading and matches no section pattern, so the only
 * thing it changes is where the later headings fall relative to the old
 * 10,000-character default.
 */
const FILLER_PARAGRAPH = [
  "The support workflow has accumulated a great deal of institutional detail over the years.",
  "Much of it is narrative rather than specification, and it sits between the sections that matter.",
  "This paragraph exists only to push the sections below it past the old default window.",
].join(" ");

const filler = (approxChars: number): string => {
  const out: string[] = [];
  let len = 0;
  while (len < approxChars) {
    out.push(FILLER_PARAGRAPH);
    len += FILLER_PARAGRAPH.length + 2;
  }
  return out.join("\n\n");
};

/** A spec whose Stop Rules and Edge Cases sections sit well beyond 10,000 chars. */
const LONG_SPEC = `${OBJECTIVE}\n\n${filler(12_000)}\n\n${STOP_RULES}\n\n${EDGE_CASES}\n`;

const statusOf = (
  out: Awaited<ReturnType<typeof auditIntentSpec>>,
  section: string,
): string | undefined =>
  out.section_findings.find((f) => f.section === section)?.status;

test("the fixture is long enough to have tripped the old 10,000-char default", () => {
  assert.ok(
    LONG_SPEC.length > 12_000,
    `fixture should exceed the old default; got ${LONG_SPEC.length}`,
  );
  assert.ok(
    LONG_SPEC.indexOf("## Stop Rules") > 10_000,
    "Stop Rules must sit past the old default window for this suite to mean anything",
  );
  assert.ok(LONG_SPEC.length < 50_000, "fixture must stay inside the spec_text max");
});

test("whole-file: a default call grades sections past the old 10,000-char window", async () => {
  const out = await auditIntentSpec({ spec_text: LONG_SPEC });

  // The exact regression behind the 23/25 correction: these two sections are
  // present in the document but were invisible to a default call.
  assert.notEqual(statusOf(out, "stop_rules_verification"), "missing");
  assert.notEqual(statusOf(out, "edge_cases"), "missing");
});

test("whole-file: a default call reports complete whole_file coverage", async () => {
  const out = await auditIntentSpec({ spec_text: LONG_SPEC });

  assert.equal(out.coverage.mode, "whole_file");
  assert.equal(out.coverage.complete, true);
  assert.equal(out.coverage.chars_total, LONG_SPEC.length);
  assert.equal(out.coverage.chars_graded, LONG_SPEC.length);
  assert.equal(out.next_chunk_token, null);
});

test("whole-file: an explicit window still grades only that window, and says so", async () => {
  const out = await auditIntentSpec({
    spec_text: LONG_SPEC,
    start_index: 0,
    max_length: 5_000,
  });

  assert.equal(out.coverage.mode, "window");
  assert.equal(out.coverage.complete, false);
  assert.equal(out.coverage.chars_graded, 5_000);
  assert.equal(out.coverage.chars_total, LONG_SPEC.length);
  assert.notEqual(out.next_chunk_token, null);

  // A windowed grade must remain visibly partial: this is the property whose
  // absence let a chunk score be published as a file score.
  assert.notEqual(statusOf(out, "stop_rules_verification"), "pass");
});

test("whole-file: max_length alone opts into a window from the start", async () => {
  const out = await auditIntentSpec({ spec_text: LONG_SPEC, max_length: 5_000 });

  assert.equal(out.coverage.mode, "window");
  assert.equal(out.coverage.chars_graded, 5_000);
  assert.equal(out.coverage.complete, false);
});

test("whole-file: a window that reaches the end is complete but still a window", async () => {
  const out = await auditIntentSpec({
    spec_text: LONG_SPEC,
    start_index: 0,
    max_length: 20_000,
  });

  assert.equal(out.coverage.mode, "window");
  assert.equal(out.coverage.complete, true);
  assert.equal(out.coverage.chars_graded, LONG_SPEC.length);
  assert.equal(out.next_chunk_token, null);
});

test("whole-file: a resumed window reports only the characters it graded", async () => {
  const first = await auditIntentSpec({ spec_text: LONG_SPEC, max_length: 5_000 });
  assert.equal(first.next_chunk_token, "5000");

  const second = await auditIntentSpec({
    spec_text: LONG_SPEC,
    start_index: Number(first.next_chunk_token),
    max_length: 5_000,
  });
  assert.equal(second.coverage.mode, "window");
  assert.equal(second.coverage.chars_graded, 5_000);
  assert.equal(second.coverage.chars_total, LONG_SPEC.length);
});

test("whole-file: start_index 0 alone means the whole document, not a truncation", async () => {
  const out = await auditIntentSpec({ spec_text: LONG_SPEC, start_index: 0 });

  assert.equal(out.coverage.chars_graded, LONG_SPEC.length);
  assert.equal(out.coverage.complete, true);
  assert.equal(out.next_chunk_token, null);
});

test("schema: an omitted max_length stays undefined (no injected 10,000 default)", () => {
  const parsed = AuditIntentSpecInputSchema.parse({ spec_text: LONG_SPEC });

  // The injected default was the mechanism: every caller who omitted the field
  // silently received a 10,000-character window.
  assert.equal(parsed.max_length, undefined);
  assert.equal(parsed.start_index, undefined);
});

test("schema: max_length bounds are unchanged (500..20000)", () => {
  assert.throws(() =>
    AuditIntentSpecInputSchema.parse({ spec_text: LONG_SPEC, max_length: 499 }),
  );
  assert.throws(() =>
    AuditIntentSpecInputSchema.parse({ spec_text: LONG_SPEC, max_length: 20_001 }),
  );
  assert.equal(
    AuditIntentSpecInputSchema.parse({ spec_text: LONG_SPEC, max_length: 20_000 })
      .max_length,
    20_000,
  );
});
