# Changelog

All notable scope-lock and contract changes are recorded here, per
[`docs/v0-scope.md`](docs/v0-scope.md) §9 ("Any change requires my written
approval in the repo's `CHANGELOG.md` before code is touched").

## [Unreleased]

### Changed

- **2026-05-08 — scope-lock §6 example fix + autonomous-detector tightening.**
  scope-lock §6 example call referenced
  `.claude/skills/format-on-edit/SKILL.md`, which doesn't exist
  (`format-on-edit` is a hook, not a skill). Sean approved swapping to
  `.claude/skills/personal-task-management/SKILL.md`, which fits the §6
  example's "low blast / L1-mvr" profile. Updating the path also surfaced
  a parser false-positive: `detectAutonomous` was matching bare `loop`
  (catching "open loops", "feedback loop", "3-question loop") and bare
  `autonomous` (catching "autonomous decision"), pushing
  `personal-task-management` and similar skills to `autonomous-loop`
  complexity in error. Tightened both `parser.ts` `detectAutonomous` and
  `retrofit.ts` `detectComplexity` to require co-occurring scheduling
  signals (`autonomous\s+(agent|skill|run|loop|mode|...)`,
  `polling\s+(loop|interval)`, `infinite\s+loop`, `every\s+\d+\s+(minutes?|...)`,
  etc.). Re-ran the §6 example call against personal-task-management; the
  documented example output now matches the tool's actual output (L1-mvr,
  low blast, multi-step, proposal-first). No Zod schema change. Approved
  by Sean in chat 2026-05-08.

- **2026-05-08 — Validation checklist count: 40 → 25.**
  scope-lock §3 and §4 originally described "the 40-item validation
  checklist." The canonical SKILL.md
  (`.claude/skills/intent-engineering/SKILL.md`, "Validation Checklist"
  section) defines 25 items across 7 sub-sections: Objective Quality (4),
  Outcome Quality (4), Health Metric Quality (3), Constraint Quality (3),
  Autonomy Quality (3), Stop Rule Quality (4), Edge Case Quality (4).
  Source-of-truth discipline (scope-lock §3) makes SKILL.md canonical and
  forbids paraphrasing or inventing new items. Reconciled scope-lock prose
  to "25-item" so docs and implementation match. `validation_score` in
  `audit_intent_spec` output reads `"X/25"` (e.g. `"8/25"`). No Zod schema
  change — `validation_score` remains `z.string()`. Approved by Sean in
  chat 2026-05-08, before any Phase 2 code was written.
