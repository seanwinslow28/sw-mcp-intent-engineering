# Changelog

All notable scope-lock and contract changes are recorded here, per
[`docs/v0-scope.md`](docs/v0-scope.md) §9 ("Any change requires my written
approval in the repo's `CHANGELOG.md` before code is touched").

## [0.1.1] — 2026-06-01 — prompt-injection / file-disclosure hardening

Security hardening release (Task 23). No public tool contract or output-shape
changes; all additions are guards, validation tightening, and an audit log.
See [`docs/SECURITY.md`](docs/SECURITY.md) for the full threat model.

### Security

- **Arbitrary file-read fix (primary).** `audit_intent_spec` and
  `assess_retrofit_level` previously did `fs.stat` + `fs.readFile` on the raw
  `file_path` — no extension allowlist, no size cap, no root confinement, and
  `fs.stat` follows symlinks. That was an arbitrary-read primitive
  (e.g. `audit_intent_spec({file_path: "/etc/passwd"})`). Both tools now route
  every disk read through the new `src/intent/safe-fs.ts` `loadFileSafely`
  helper: absolute-path resolution, extension allowlist
  (`.md/.markdown/.yaml/.yml/.txt`), `fs.realpath` symlink resolution, optional
  `INTENT_ENGINEERING_ALLOWED_ROOT` confinement (with `..`-escape guard),
  regular-file check, and a 1 MiB size cap. Typed errors:
  `DisallowedExtensionError`, `OutsideRootError`, `NotARegularFileError`,
  `FileTooLargeError`.
- **Strict input schemas.** Added `.strict()` to all three Zod input schemas so
  unknown/extra keys are rejected. Existing exactly-one-of refinements
  (`spec_text` XOR `file_path`, `skill_text` XOR `file_path`) retained.

### Added

- **Invocation audit log.** `src/intent/audit-log.ts` `recordInvocation` appends
  one JSON line per call to `~/.intent-engineering-mcp/audit.jsonl`
  (`ts`, `tool`, `input_source`, `file_path?`, `input_len`, `outcome`,
  `reject_reason?`). Fail-open (never throws into the tool path); disable with
  `INTENT_ENGINEERING_AUDIT_LOG=0`. Wired into all three tool handlers.
- **Test suite.** `node:test`-based tests (`src/intent/*.test.ts`, zero new
  runtime deps) covering the safe-fs guard, `.strict()` rejection, the one-of
  refine regression lock, and the audit log. Run with `npm test`. Compiled test
  files are excluded from the published npm tarball.
- `docs/SECURITY.md` — threat model, defenses applied, defenses deferred (with
  rationale), known limitations, references.

## [0.2.0] — 2026-06-17

Released as 0.2.0 (minor, not patch) because A1 changes the scoring output for
existing inputs — a non-breaking behavior change with no input/output schema change —
matching the README's own "v0.2 enhancement" language for the heading-vocabulary mapper.

### Changed

- **2026-06-17 — A1: heading-vocabulary mapper.** The Markdown section parser
  (`src/intent/parser.ts`) now recognizes a conservative set of alias headings in
  addition to the canonical nine, routing them to the canonical sections before
  scoring: e.g. `## Purpose` / `## When to Use` → Objective, `## Goal` → User Goal,
  `## Success Criteria` / `## Definition of Done` → Desired Outcomes,
  `## Context` / `## Background` → Strategic Context,
  `## Requirements` / `## Important Constraints` → Constraints,
  `## Error Handling` / `## Exceptions` → Edge Cases,
  `## Completion` / `## Exit Criteria` / `## Validation` → Stop Rules & Verification.
  Motivation: real SKILL.md files using different heading vocabulary previously
  scored `1/25` because *zero* present sections were recognized (README
  "Limitations", `docs/EXPLANATION.md` "What would break?" #1). Canonical headings
  always match first (alias entries are appended after canonical ones), so the
  dogfood self-audit is unaffected — re-verified at **23/25, zero anti-patterns**.
  Procedural headings that are not true intent equivalents (e.g. `## How to Apply`,
  `## Instructions`, `## Usage`, `## Examples`) are deliberately left unmapped, and
  genuinely-absent sections still report `missing` — no invented passing scores.
  For legibility, when a section is recognized from a non-canonical heading, the
  audit's per-section `notes` now say so (e.g. `(recognized from heading
  "## When to Use")`). **No input/output schema change** — `validation_score`,
  `section_findings`, and the rest keep their exact shapes; only score values and
  free-text `notes` content change. **No tool-count change** (still 3). Approved by
  Sean in chat 2026-06-17, before code was written.

- **2026-06-17 — A3: pagination boundary regression test (test-only).** Added a
  `node:test` case (`src/intent/parser.test.ts`) exercising `audit_intent_spec`
  pagination (`start_index` + `max_length`) when a section heading straddles a chunk
  boundary, confirming the documented behavior (`docs/EXPLANATION.md` #3): the split
  section reports `missing` within the truncated chunk and the model aggregates
  across calls. No code, schema, or output-shape change. Approved by Sean in chat
  2026-06-17.

- **2026-06-17 — A2: schema-drift snapshot tripwire (test-only).** Added
  `src/intent/checklist.test.ts`, a `node:test` that snapshots the contract
  constants: `VALIDATION_CHECKLIST` length (25) and its 25 item ids in source order,
  `ANTI_PATTERN_IDS` length (5), and that `ANTI_PATTERN_DETECTORS` keys exactly equal
  `ANTI_PATTERN_IDS` (detectors and ids can't drift apart). The point is a loud
  tripwire: any accidental edit to the checklist or anti-pattern constants fails CI
  and forces a deliberate snapshot update — a §9 CHANGELOG moment rather than silent
  drift. The dogfood self-audit guards the scoring side. No code, schema, or
  output-shape change. Approved by Sean in chat 2026-06-17.

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
