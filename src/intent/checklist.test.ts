import { test } from "node:test";
import assert from "node:assert/strict";
import { VALIDATION_CHECKLIST } from "./checklist.js";
import { ANTI_PATTERN_IDS, ANTI_PATTERN_DETECTORS } from "./anti-patterns.js";

// A2 schema-drift tripwire (test-only). These snapshots are deliberately loud:
// any accidental edit to the validation checklist or anti-pattern constants fails
// CI and forces a deliberate snapshot update — a docs/v0-scope.md §9 CHANGELOG
// moment, not a silent drift. The dogfood self-audit guards the scoring side; this
// guards the contract side.

// Frozen, source-order snapshot of the 25 checklist item ids.
const CHECKLIST_IDS = [
  "objective.problem-not-solution",
  "objective.why-it-matters",
  "objective.guides-trade-offs",
  "objective.standalone-readable",
  "outcomes.states-not-activities",
  "outcomes.user-perspective",
  "outcomes.count-2-to-4",
  "outcomes.measurable-without-self-report",
  "health.one-per-outcome",
  "health.anti-game",
  "health.behavioral-adjustment",
  "constraints.architectural-enforcement",
  "constraints.steering-flexible",
  "constraints.no-contradiction",
  "autonomy.every-decision-assigned",
  "autonomy.justified-by-blast-radius",
  "autonomy.full-genuinely-low-risk",
  "stop.halt-covers-critical",
  "stop.escalate-with-thresholds",
  "stop.infinite-loop-defense",
  "stop.zero-interaction-mandate",
  "edge.empty-null-handled",
  "edge.network-api-failure",
  "edge.conflict-priority",
  "edge.at-least-five",
];

test("checklist: exactly 25 validation items (per v0-scope.md §3)", () => {
  assert.equal(VALIDATION_CHECKLIST.length, 25);
});

test("checklist: item ids match the frozen snapshot in source order", () => {
  assert.deepEqual(
    VALIDATION_CHECKLIST.map((i) => i.id),
    CHECKLIST_IDS,
  );
});

test("anti-patterns: exactly 5 ids", () => {
  assert.equal(ANTI_PATTERN_IDS.length, 5);
});

test("anti-patterns: detector keys cannot drift from the id list", () => {
  assert.deepEqual(Object.keys(ANTI_PATTERN_DETECTORS), [...ANTI_PATTERN_IDS]);
});
