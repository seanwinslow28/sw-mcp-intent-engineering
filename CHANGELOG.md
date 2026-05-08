# Changelog

All notable scope-lock and contract changes are recorded here, per
[`docs/v0-scope.md`](docs/v0-scope.md) §9 ("Any change requires my written
approval in the repo's `CHANGELOG.md` before code is touched").

## [Unreleased]

### Changed

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
