import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIntentSpec } from "./parser.js";
import { auditIntentSpec } from "./audit.js";

// Shared section bodies. Each row is [canonicalHeading, aliasHeading, body].
// Both spec variants reuse the SAME body, so any score difference between them
// is attributable purely to heading recognition — the thing A1 fixes.
const SECTIONS: Array<[string, string, string]> = [
  [
    "## Objective",
    "## Purpose",
    `Support tickets pile up unresolved, which is a problem because customers wait too long and churn. This matters so the support team can respond faster. When facing trade-offs, prioritize resolution quality over raw speed.`,
  ],
  [
    "## Desired Outcomes",
    "## Success Criteria",
    `- Each customer ticket has a validated resolution status that exists in the system.
- Users see fewer than 3 open tickets older than 24 hours.
- Stakeholder dashboards contain accurate ticket counts.`,
  ],
  [
    "## Health Metrics",
    // "## Metrics" is intentionally NOT an alias (a PRD's "Metrics" usually means
    // success metrics, not anti-Goodhart health metrics), so both columns use the
    // canonical heading here to keep the score-equivalence assertion honest.
    "## Health Metrics",
    `- metric: CSAT score, must not drop below 90% → if trending wrong, halt auto-close and route to a human.
- metric: resolution accuracy, stay above 95% → if trending wrong, escalate to a senior agent.
- metric: reopen rate, must not exceed 5% → if trending wrong, fall back to manual review.`,
  ],
  [
    "## Constraints",
    "## Requirements",
    `- Never delete customer data; enforced via disallowedTools.
- Prefer concise replies when the issue is simple.`,
  ],
  [
    "## Decision Authority",
    "## Decision Authority",
    `- full_autonomous: auto-tagging tickets — this is low-risk and reversible.
- guarded_autonomous: sending canned replies — rollback by retracting them.
- proposal_first: closing a ticket — requires approval from the team lead.
- human_required: issuing refunds — irreversible, so a human must execute.`,
  ],
  [
    "## Stop Rules",
    "## Completion",
    `- halt_when: critical data corruption detected → halt and alert the on-call engineer.
- escalate_when: confidence below 80%, or after 3 consecutive failures in a row.
- complete_when: every ticket has a resolution status and all verification checks pass.`,
  ],
  [
    "## Edge Cases",
    "## Error Handling",
    `- When the ticket body is empty, halt and request more information.
- When the support API is down, queue the ticket and retry later.
- When two priorities conflict, urgent SLA tickets take precedence over routine ones.
- When a duplicate ticket exists, merge it into the original.
- When the customer is unidentified, escalate to a human reviewer.`,
  ],
];

function assemble(useAlias: boolean): string {
  return SECTIONS.map(([canonical, alias, body]) => `${useAlias ? alias : canonical}\n${body}`).join(
    "\n\n",
  );
}

const CANONICAL_SPEC = assemble(false);
const ALIAS_SPEC = assemble(true);

const score = (s: string): number => Number(s.split("/")[0]);

test("parser: alias headings route to the canonical sections", () => {
  const spec = parseIntentSpec(ALIAS_SPEC);
  assert.equal(spec.sections.objective.present, true);
  assert.equal(spec.sections.desired_outcomes.present, true);
  assert.equal(spec.sections.health_metrics.present, true);
  assert.equal(spec.sections.constraints.present, true);
  assert.equal(spec.sections.stop_rules_verification.present, true);
  assert.equal(spec.sections.edge_cases.present, true);
});

test("parser: alias matches record the literal sourceHeading; canonical do not", () => {
  const alias = parseIntentSpec(ALIAS_SPEC);
  assert.equal(alias.sections.objective.sourceHeading, "## Purpose");
  assert.equal(alias.sections.desired_outcomes.sourceHeading, "## Success Criteria");
  assert.equal(alias.sections.stop_rules_verification.sourceHeading, "## Completion");

  const canonical = parseIntentSpec(CANONICAL_SPEC);
  assert.equal(canonical.sections.objective.sourceHeading, undefined);
  assert.equal(canonical.sections.desired_outcomes.sourceHeading, undefined);
});

test("audit: alias-headed and canonical-headed specs score identically (no false-fail)", async () => {
  const aliasOut = await auditIntentSpec({ spec_text: ALIAS_SPEC });
  const canonicalOut = await auditIntentSpec({ spec_text: CANONICAL_SPEC });
  assert.equal(aliasOut.validation_score, canonicalOut.validation_score);
  // "audits sensibly": a complete, well-formed spec should score high regardless
  // of which heading vocabulary it uses — emphatically not the old 1/25.
  assert.ok(
    score(aliasOut.validation_score) >= 20,
    `expected a strong score, got ${aliasOut.validation_score}`,
  );
});

test("audit: legibility — notes name the heading a section was recognized from", async () => {
  const out = await auditIntentSpec({ spec_text: ALIAS_SPEC });
  const objective = out.section_findings.find((f) => f.section === "objective");
  assert.ok(objective);
  assert.match(objective.notes, /recognized from heading "## Purpose"/);
});

test("audit: a genuinely incomplete spec still scores low (no invented passing scores)", async () => {
  const incomplete = `## When to Use\nThis skill summarizes meeting notes when asked.\n`;
  const out = await auditIntentSpec({ spec_text: incomplete });
  // Objective is recognized (alias), but every content-bearing scored section is
  // absent. (Stop Rules aggregates to "warn" not "missing" here only because of a
  // pre-existing quirk — stop.zero-interaction-mandate auto-passes for
  // non-autonomous specs; that is unrelated to A1 and does not lift the score.)
  assert.equal(out.section_findings.find((f) => f.section === "objective")?.status !== "missing", true);
  for (const key of [
    "desired_outcomes",
    "health_metrics",
    "constraints",
    "decision_authority",
    "edge_cases",
  ] as const) {
    assert.equal(
      out.section_findings.find((f) => f.section === key)?.status,
      "missing",
      `${key} should be missing`,
    );
  }
  assert.ok(score(out.validation_score) <= 4, `expected a low score, got ${out.validation_score}`);
});

test("parser: '## Important Constraints' is recognized as Constraints (alias)", () => {
  const spec = parseIntentSpec(`## Important Constraints\n- Never ship without legal review.\n`);
  assert.equal(spec.sections.constraints.present, true);
  assert.equal(spec.sections.constraints.sourceHeading, "## Important Constraints");
});

test("parser: '## Requirements' is still recognized as Constraints (alias)", () => {
  const spec = parseIntentSpec(`## Requirements\n- Must support dark mode.\n`);
  assert.equal(spec.sections.constraints.present, true);
  assert.equal(spec.sections.constraints.sourceHeading, "## Requirements");
});

test("parser: '## Metrics' is NOT recognized as Health Metrics (alias dropped)", () => {
  const spec = parseIntentSpec(`## Metrics\n- CSAT score stays above 90%.\n`);
  assert.equal(spec.sections.health_metrics.present, false);
});

test("audit: procedural headings stay unmapped (## How to Apply is not Desired Outcomes)", () => {
  const spec = parseIntentSpec(`## How to Apply\n- First do this\n- Then do that\n`);
  assert.equal(spec.sections.desired_outcomes.present, false);
  // It should not be silently credited to any scored section.
  for (const key of Object.keys(spec.sections) as Array<keyof typeof spec.sections>) {
    assert.equal(spec.sections[key].present, false, `${key} should not be present`);
  }
});

// --- A3: pagination boundary (test-only, confirms documented behavior) ---

test("audit: a section heading straddling a pagination chunk boundary shows missing in that chunk", async () => {
  // Truncate the input mid-way through the "## Edge Cases" heading.
  const headingIdx = CANONICAL_SPEC.indexOf("## Edge Cases");
  assert.ok(headingIdx > 500, "edge-cases heading should be well past the 500-char min");
  const cut = headingIdx + 5; // lands inside "## Ed|ge Cases"

  const truncated = await auditIntentSpec({
    spec_text: CANONICAL_SPEC,
    start_index: 0,
    max_length: cut,
  });
  // Documented worst case: the split section reports missing for this chunk...
  assert.equal(
    truncated.section_findings.find((f) => f.section === "edge_cases")?.status,
    "missing",
  );
  // ...and pagination continues so the model can aggregate across calls.
  assert.notEqual(truncated.next_chunk_token, null);

  // Sanity: with the full input (no truncation), the same section IS found —
  // proving the "missing" above is purely a chunk-boundary artifact.
  const full = await auditIntentSpec({ spec_text: CANONICAL_SPEC });
  assert.notEqual(
    full.section_findings.find((f) => f.section === "edge_cases")?.status,
    "missing",
  );
  assert.equal(full.next_chunk_token, null);
});
