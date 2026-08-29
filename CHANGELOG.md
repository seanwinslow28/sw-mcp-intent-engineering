# Changelog

All notable scope-lock and contract changes are recorded here, per
[`docs/v0-scope.md`](docs/v0-scope.md) §9 ("Any change requires my written
approval in the repo's `CHANGELOG.md` before code is touched").

## [Unreleased] — 2026-08-29 — whole-file audit aggregation (schema change)

### Scope approval (§9)

`docs/v0-scope.md` §9 requires written approval in this file before any input
or output schema is changed. **Approved by Sean on 2026-08-29, recorded here
before code was written.** Two changes are approved, both to
`audit_intent_spec`:

1. **Input.** Whole-document grading becomes the default. `start_index` and
   `max_length` stay accepted with unchanged types and bounds, but they become
   an explicit opt-in window rather than an always-on chunker. `max_length`
   loses its `.default(10_000)`, so an omitted value now means "grade all of
   it" instead of "grade the first 10,000 characters".
2. **Output.** A `coverage` object is added, reporting the grading mode, the
   characters graded, the characters available, and whether the grade is
   complete.

**Why the default flips rather than a flag being added.** The pagination was
modelled on the official `fetch` server (§4 cites that lineage), where
paginating is correct because that server's *response* grows with the page it
returns. This tool's response does not grow: a score, nine section findings, at
most five anti-patterns, three recommendations, the same size whether it reads
500 characters or 32,000. Input size was already bounded elsewhere and still is
(50,000 characters for `spec_text` via Zod, 1 MiB for files via `safe-fs.ts`).
So chunking bounded the one side of this tool that never needed bounding, and
the cost of it was a wrong published number. A flag would have left the trap
armed for anyone who forgot to pass it, which is the same failure mode that
produced the 23/25 claim.

**Why `coverage` is part of the same approval.** The 2026-08-28 correction was
possible because a chunk score and a file score were typographically identical:
`"14/25"` reads the same whether it graded 10,000 characters or all 32,556.
Flipping the default fixes the common path; `coverage` is what makes a partial
grade impossible to mistake for a complete one on the paths that remain.

**Not approved and not built:** a redundant `whole_file` boolean. Absence of
the window parameters already means whole file, and a flag that could contradict
an explicit `max_length` would add a conflict case with no capability behind it.

### Added

- **Whole-document grading, and it is now the default.** `audit_intent_spec`
  grades all of the input unless a window is explicitly requested. A window is
  requested by supplying `start_index`, `max_length`, or both.
- **A `coverage` block on every audit response**, reporting `mode`
  (`whole_file` / `window`), `chars_graded`, `chars_total`, and `complete`.
  `complete` is true only when a single call graded the document start to end,
  so it answers a different question from `next_chunk_token`: a resumed window
  that reaches the end of the input has nothing left to fetch
  (`next_chunk_token: null`) while still not having graded the document
  (`complete: false`).
- **10 tests** in `src/intent/whole-file.test.ts` covering the default path, the
  coverage block in both modes, window opt-in via either parameter, resumed
  windows, and the schema change. Suite: **45 passing, up from 35.** The
  existing A3 chunk-boundary test in `parser.test.ts` is unchanged and still
  passes; it supplies both window parameters, so it now reads as an explicit
  windowed-grading test.

### Changed

- `audit_intent_spec`'s tool description now states that it grades whole
  documents by default and points at `coverage`.
- `docs/v0-scope.md` §4 amended: input schema, output schema, and the
  "Pagination behavior" section, which is renamed "Grading scope" and retains
  the superseded design as a quoted block. Done-criterion 8 is annotated rather
  than rewritten, since it passed at the 2026-05-25 gate as written.

### Fixed

- **The 2026-08-28 dogfood correction was itself wrong, and is retracted.**
  Graded whole on 2026-08-29, the canonical `intent-engineering` SKILL.md
  scores **23/25 with zero anti-patterns** (7 sections pass, 2 warn, 0
  missing), across all 32,356 characters. That is exactly the figure published
  in May 2026 and retracted last night. **The original claim reproduces; the
  retraction was the error.**

  What actually happened, with every number reproduced:

  | What was graded | Score | Anti-patterns |
  |---|---|---|
  | May-era file (17,885 chars), whole | 23/25 | none |
  | May-era file, first 10,000 chars | 17/25 | 1 |
  | Today's file (32,356 chars), whole | 23/25 | none |
  | Today's file, first 10,000 chars | 14/25 | 2 |
  | Any read starting past end of file | 1/25 then, 0/25 now | 2 |

  Graded whole, **every revision in the file's git history scores 23/25 with
  zero anti-patterns**: `ebf41b3d` (2026-03-03, 17,942 chars), `9c76e762`
  (2026-05-04, 17,885), `d0117843` (2026-06-10, 17,900), `c8f90d79`
  (2026-07-05, 32,356). The grade is stable across five months and a commit
  that nearly doubled the file, and it was independently re-confirmed in a
  2026-06-17 working session while the file still fit in one call (recorded in
  `vault/20_projects/substack-studio/continuation-prompts/CONTINUATION-2026-06-17-mcp-strengthening.md`).
  What changed on 2026-07-05 was the measurability, not the grade.

  In May the skill was 17,885 characters. `max_length` caps at 20,000, so the
  whole file fit inside a single call and the Phase 3 session's "first chunk"
  was the entire document. That session's `1/25` rows were reads starting past
  the end of the file, grading zero characters, not partial grades of real
  content. By July the skill had grown to 32,356 characters and crossed the
  20,000-character ceiling, so no single call could grade it. The 2026-08-28
  re-measurement used the 10,000-character default, got 14/25, found it did not
  match 23/25, and concluded the original had been a chunk mistaken for a file.
  It described the error correctly and applied it to the wrong measurement: the
  chunk was the new one.

  Both mistakes have one cause. Until today the response could not tell a
  reader how much of the document it had graded, so neither figure was
  checkable without going back to the source, and both were published. The
  `coverage` block exists because being careful was demonstrably not enough:
  the retraction was written deliberately, cited its own evidence, and was
  still wrong.

- **A document nothing is recognized in scored 1/25. It now scores 0/25.**
  `stop.zero-interaction-mandate` is the rubric's one conditional item. Its
  "(For scheduled agents)" precondition does not apply to a non-scheduled
  agent, and not-applicable was encoded as `pass`. An empty file, a
  whitespace-only input, a read starting past the end of a document, or prose
  matching no heading in either table all parse as non-autonomous, so they took
  that branch and collected the point. This is why the Phase 3 round-trip
  table's past-the-end reads showed `1/25` rather than `0/25`, which made "no
  data" look like "a weak grade". A check crediting a document it never saw is
  the same disease as a chunk score published as a file score, one point wide.

  The guard is narrow: it fires only when **no** section was recognized, so the
  not-applicable pass stays correct for a real non-autonomous spec. It sits in
  `buildSectionFindings` rather than in the predicate, so any future conditional
  check that would pass vacuously is caught by the same guard. Anti-pattern
  detection is deliberately unchanged: those are debits, not credits, and a
  document with no edge cases genuinely lacks them. The headline 23/25 is
  unaffected, and a test pins it: the canonical skill parses as autonomous, so
  its zero-interaction point is a real match and never took the vacuous branch.
  Five tests in `src/intent/empty-document.test.ts`. Suite now **50 passing**.

- **Correction to this entry's own first published table.** Its
  "read past end of file" row said `none` anti-patterns. That cell was inferred,
  not measured. A past-the-end read fires **two** (`vibe-coded-edge-cases`,
  `missing-stop-rules`), because those detectors correctly report that a
  document with no edge cases and no stop rules has neither. Corrected above and
  in `README.md`. Noted rather than quietly edited, since the entire point of
  the table is that its cells were measured.

- **`README.md` and `docs/EXPLANATION.md` re-corrected.** Both led with the
  retracted story. Both now carry the measurement table, the mechanism (a file
  that outgrew the tool's single-call ceiling), and the sharper version of the
  lesson.

### Verified

- Suite **45/45 passing** (`npm test`, which runs `tsc` first, so the schema
  and output-shape changes are type-checked).
- Every figure in this entry re-measured 2026-08-29 against
  `build/intent/audit.js` on two files: the live skill at
  `code-brain/.claude/skills/intent-engineering/SKILL.md`, and the May-era file
  recovered from `code-brain` commit `9c76e762` (2026-05-04, the last revision
  before the 2026-05-08 audit).
- **Provenance check on the re-correction:** the first-chunk numbers measured
  here reproduce the 2026-08-28 entry's published figures exactly (17/25 with
  one anti-pattern on the May file, 14/25 with two on today's). Same files,
  same tool, same method. That is what establishes that the disagreement is
  about what was graded, not about how it was graded.

### Still not built

- **Nothing reads the skill.** The 25 checks remain TS constants mirroring
  canonical markdown, guarded only by a snapshot of themselves. Unchanged by
  this release and still the largest live risk. See `docs/EXPLANATION.md` §2.
- **`coverage` protects the tool's output, not its quotation.** Both published
  mistakes happened after a number left the response and entered a sentence.
  Nothing here prevents that.

## [Unreleased] — 2026-08-28 — dogfood-claim correction (docs only)

> **Superseded 2026-08-29.** The correction recorded below is itself wrong.
> The original 23/25 reproduces when the file is graded whole. See the
> whole-file entry above for the measurement table.

No code, schema, or tool-contract change. Documentation accuracy only, so no
scope approval was required under §9.

### Fixed

- **The README's dogfood claim was a chunk score reported as a file score.**
  `README.md` and `docs/EXPLANATION.md` both stated the canonical
  `intent-engineering` SKILL.md scores `23/25` with zero anti-patterns. That
  figure came from a single `audit_intent_spec` call during Phase 3
  verification (2026-05-08). The audit paginates at `max_length` characters
  per call (default 10,000); the skill is roughly 32,000 characters, so no
  single call has graded the whole file. Re-measured 2026-08-28: the current
  file returns **14/25 with two anti-patterns** on the first chunk, and the
  file as it stood in the audit week returns **17/25 with one**. Neither
  reproduces the published figure. Both documents now state the measured
  result, the date, the reproduction command, and why the original was wrong.

### Verified

- **Every remaining README number re-measured 2026-08-28** after the dogfood
  correction put the rest of the page under suspicion. The 118-skill batch
  claims reproduce: 0 parse errors, 94 ms wall-clock (the "under a second"
  claim), same 118 files re-run via the `audit-superuser-pack` logic. The
  24/36/40 level split matches the shipped CSV (23.7/36.4/39.8%); the same
  files today split 20/38/42 — corpus drift, noted in the README. Dogfood
  first-chunk score reproduces exactly (14/25, `vibe-coded-edge-cases` +
  `missing-stop-rules`, 5 pass / 3 warn / 1 missing). Structural counts
  reproduce (25-item checklist, 5 anti-pattern detectors, SDK pinned 1.29.0).
  `assess_retrofit_level` confirmed **not** to share the audit's pagination
  hazard: whole-file reads, loud refusal over 1 MiB (`safe-fs.ts`), loud
  schema rejection of `skill_text` over 50k — no silent partial grade is
  possible. One environmental fact recorded: the Superuser Pack checkout at
  `~/Code-Brain/claude-code-superuser-pack` no longer contains the corpus;
  all 118 files live on in `code-brain/.claude/skills/`, which is what the
  re-measurement ran against.

### Known gaps, named rather than shipped

- **No whole-file audit mode.** Grading a document longer than `max_length`
  requires walking every chunk and aggregating by hand, and a chunk that omits
  a section is not evidence the section is absent. A `--whole-file`
  aggregation is the obvious next addition. Not built.

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
