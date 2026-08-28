# intent-engineering

`intent-engineering` is an MCP server that exposes three tools — `audit_intent_spec`, `generate_intent_spec_scaffold`, and `assess_retrofit_level` — letting any MCP-aware client (Claude Desktop, Cursor, Anti-Gravity) review, scaffold, and triage agent intent specs against a 9-section unified template synthesized from production-agent research.

Most agent failures aren't reasoning failures — they're intent failures. The spec is vague, the stop rules are missing, the outcome is an activity disguised as a state. This server makes that gap auditable from inside the harness the agent already runs in. The full reasoning, the rejected alternatives, and what would break in v0 live in [`docs/EXPLANATION.md`](docs/EXPLANATION.md).

## The trust surface, up front

- **It audits itself, and the first version of that claim was wrong.** Re-measured 2026-08-28, the canonical skill scores **14/25 with two anti-patterns** on the first chunk. This page used to say "23/25, zero anti-patterns" — a single paginated chunk reported as a whole-file score. The correction, and why it is the exact failure this server exists to catch, is in [Dogfood result](#dogfood-result-and-the-correction-that-came-with-it).
- **Read-only by design.** No tool writes files. The retrofit tool recommends; it does not apply.
- **File reads are guarded.** An early version would read any path you handed it, which made `/etc/passwd` a real disclosure bug. Every disk read now routes through one guard: extension allowlist, symlink resolution, root confinement, and a size cap.
- **The build refuses common failure modes.** SDK pinned to the stable v1.x line, a `prepublishOnly` guard that fails the build on any `console.log` in `src/`, and a changelog rule: no scope change without written approval before code.
- **Limitations are named, not hidden.** Stdio only, opinionated heading parser with its alias table documented, and the honest boundary that the mapper recognizes equivalent intent but does not invent it.

## Why this exists

### Problem
Engineering teams treat AI agents like reliable coworkers, but agents fail silently when given underspecified intent. The cost is shipped features that solve the wrong problem — and the failure mode is invisible until production. PMs feel this pain twice: once writing the spec, and again when an agent confidently delivers something off-target. There's no shared protocol for "audit this spec before an agent runs on it."

### Solution
A Model Context Protocol server that exposes three tools any MCP-aware client (Claude Desktop, Cursor, etc.) can call: `audit_intent_spec` audits a spec against a 25-item rubric, `generate_intent_spec_scaffold` scaffolds new specs by kind, `assess_retrofit_level` retrofits older docs. Published to npm as `@swins/intent-engineering-mcp` and to the official MCP registry as `com.seanwinslow/intent-engineering` via DNS-verified namespace.

### Tradeoffs and Decisions
- **TypeScript over Python**: the MCP TS SDK has the deepest client coverage (Claude Desktop, Cursor) — at the cost of locking out the Python-native data science crowd.
- **stdio transport over HTTP**: zero-infra v0, but couples the server to a process-bound client. v1 will add SSE for cloud agents.
- **DNS-verified namespace (`com.seanwinslow/*`) over GitHub-handle namespace**: locks the brand surface to a domain I control; required a separate Ed25519 keypair + apex TXT record, which is more upfront friction than `mcp-publisher login github`.

### What I Learned
The MCP protocol is essentially a contract for "I am a tool an LLM can call without me writing a wrapper." Once that landed, the server became a thin protocol adapter over an existing skill — and the OPTIONAL-fields pattern I'd developed on a separate knowledge-graph project translated directly.

The part I got wrong is the more useful lesson. I published a dogfood score of 23/25 taken from one paginated call and presented it as the whole file's grade. Re-measuring four months later caught it. **A tool that eats its own dog food earns credibility fast. A tool that catches its author misquoting it earns more.**

## Three tools

| Tool | Input | Output |
|---|---|---|
| `audit_intent_spec` | A spec (`spec_text` or `file_path`) | Score out of 25, per-section findings, detected anti-patterns, top 3 recommendations |
| `generate_intent_spec_scaffold` | `kind` (blank / level-1-mvr / full-9-section), optional hints | A paste-ready YAML scaffold + next-step actions |
| `assess_retrofit_level` | An existing prompt or SKILL.md | Recommended retrofit level (L1 / L2 / L3) with blast-radius + complexity + autonomy reasoning |

The 25-item validation checklist, 5 fatal anti-patterns, 4 autonomy levels, and 9-section template all come from the canonical [`intent-engineering` skill](https://github.com/seanwinslow28/claude-code-superuser-pack/tree/main/.claude/skills/intent-engineering). The MCP server is a thin protocol adapter, not a fork.

## Quickstart

Requires Node 20+ and an MCP-aware client (Claude Desktop, Cursor, etc.).

**One config entry, no clone.** Add this to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "intent-engineering": {
      "command": "npx",
      "args": ["-y", "@swins/intent-engineering-mcp"]
    }
  }
}
```

**Or from source:**

```bash
git clone https://github.com/seanwinslow28/sw-mcp-intent-engineering.git
cd sw-mcp-intent-engineering
npm install
npm run build
```

Then point the config's `command` at `node` with `args: ["<ABSOLUTE_PATH_TO_REPO>/build/index.js"]`.

Restart Claude Desktop. Open Settings → Developer to confirm the server shows as `running`:

![intent-engineering server connected in Claude Desktop](docs/screenshots/intent-engineering-mcp-connected.png)

The three tools then appear in the tool list under `intent-engineering` in any new conversation.

## Try it

Paste this into Claude Desktop after the server is connected:

> Run `audit_intent_spec` on this spec:
>
> ```
> ## Objective
> Make support tickets resolve faster.
>
> ## Outcomes
> - Tickets close in <2h
> - CSAT stays high
>
> ## Stop Rules
> (none)
> ```

You'll get back a score out of 25, a list of detected anti-patterns (this spec hits at least three), and three concrete recommendations to fix it. The full I/O contract lives in [`docs/v0-scope.md`](docs/v0-scope.md) §4.

## Dogfood result, and the correction that came with it

**Re-measured 2026-08-28.** The canonical `intent-engineering` SKILL.md, audited by this server with default settings, scores **14/25 with two anti-patterns detected** (`vibe-coded-edge-cases`, `missing-stop-rules`). Five sections pass, three warn, one is missing.

Reproduce it in one call:

```
audit_intent_spec({ file_path: "<path>/.claude/skills/intent-engineering/SKILL.md" })
```

**This page previously claimed 23/25 with zero anti-patterns. That was a chunk score reported as a file score.** `audit_intent_spec` paginates: it reads `max_length` characters per call (default 10,000) and returns a `next_chunk_token` when more remains. The skill is roughly 32,000 characters, so **no single call has ever graded the whole document.** The 23/25 came from one call during Phase 3 verification on 2026-05-08 and was written up as though it covered the file. Auditing that same file as it stood that week returns **17/25 with one anti-pattern** on the first chunk — the original figure does not reproduce even against the original file.

Two things worth stating plainly, because this is a spec-auditing tool:

- **The tool was not wrong; the reading was.** Pagination is documented in the tool description and was deliberately verified in Phase 3 — that session's own 30k round-trip table shows the first chunk scoring 23/25 and later chunks scoring 1/25. The number was miscopied out of a pagination test into a headline, not miscomputed.
- **This is the failure mode the server exists to catch, committed by its author.** A figure with no stated denominator, taken from a partial read, published as a summary. The 25-item rubric checks whether *your* outcomes are measurable. Nothing in it stops you from quoting your own tool out of context.

**Known gap, not yet built:** there is no whole-file mode. Grading the full skill today means walking every chunk and aggregating by hand, and a chunk that omits a section is not evidence the section is absent. A `--whole-file` aggregation is the obvious next addition and is deliberately listed here rather than quietly shipped.

At scale: the same server audited all 118 first-party skills in my Claude Code Superuser Pack in under a second. 24% scored L1-mvr (the spec just needs an intent header), 36% scored L2-structured (needs Health Metrics + Decision Authority), and 40% scored L3-full (autonomous-loop or high-blast-radius skills that warrant a 9-section conversion). Zero parse errors across the batch. The full CSV is at `examples/superuser-pack-retrofit-assessment.csv`.

## Limitations

The audit is opinionated about heading structure, but it now recognizes a conservative set of alias headings in addition to the canonical ones — `## Purpose` / `## When to Use` map to Objective, `## Success Criteria` / `## Definition of Done` to Desired Outcomes, `## Completion` / `## Exit Criteria` to Stop Rules, and so on (the full table lives in `src/intent/parser.ts`). When a section is recognized from a non-canonical heading the audit says so in its notes, so the score stays legible. Earlier, skills using different heading vocabularies scored 1/25 because *none* of their present sections were recognized; that false-negative is fixed. Two honest boundaries remain: headings that are *not* true intent equivalents (procedural ones like `## How to Apply`, `## Instructions`, `## Usage`) are deliberately left unmapped rather than credited to the wrong section, and a spec that genuinely lacks the nine intent sections still scores low — the mapper recognizes equivalent intent, it does not invent it.

Other v0 boundaries worth naming up front:

- **Read-only.** No tool writes files. `assess_retrofit_level` recommends; it does not retrofit. A v0.2 `apply_retrofit` would live behind explicit user confirmation.
- **Stdio transport only.** No Streamable HTTP, no SSE, no remote hosting. Run it locally next to your client.
- **No `prompts` or `resources` primitives.** Three tools and that's it. Adding more before the surface is stable would be premature.

## Project layout

```
sw-mcp-intent-engineering/
├── src/
│   ├── index.ts                    # MCP server boot + tool registration
│   └── intent/
│       ├── audit.ts                # audit_intent_spec logic
│       ├── scaffold.ts             # generate_intent_spec_scaffold logic
│       ├── retrofit.ts             # assess_retrofit_level logic
│       ├── checklist.ts            # 25-item validation checklist
│       ├── anti-patterns.ts        # 5 fatal anti-pattern detectors
│       ├── parser.ts               # YAML frontmatter + markdown heading parser
│       └── templates/              # YAML scaffolds (blank / level-1-mvr / full-9-section)
├── docs/
│   ├── v0-scope.md                 # binding scope-lock for v0
│   ├── EXPLANATION.md              # 4Q comprehension artifact (why MCP, what would break, what I learned)
│   └── claude-code-responses-and-tests/   # archived phase-verification outputs
├── package.json
├── tsconfig.json
├── server.json                     # registry metadata
├── CHANGELOG.md
├── README.md
└── LICENSE
```

`src/index.ts` is a thin protocol adapter. All tool logic lives in `src/intent/*`.

## Build discipline

- SDK pinned at `@modelcontextprotocol/sdk@1.29.0` (stable v1.x line, not the v2 pre-alpha)
- All logging goes to `console.error`. A `prepublishOnly` grep guard fails the build if any `console.log` appears in `src/`
- Tool implementations import the validation checklist, anti-pattern definitions, and template strings from local modules that mirror the skill. They do not paraphrase or reinvent skill content
- Scope changes require explicit approval in [`CHANGELOG.md`](CHANGELOG.md) before code is written

## Further reading

- [`docs/EXPLANATION.md`](docs/EXPLANATION.md) — the 4Q comprehension artifact (what this is, why this approach, what would break, what I learned)
- [`docs/v0-scope.md`](docs/v0-scope.md) — binding v0 scope-lock and ship gate
- [seanwinslow.com/transactions/intent-engineering-mcp](https://seanwinslow.com/transactions/intent-engineering-mcp) — deep-dive write-up with Loom demo

## License

MIT. See [`LICENSE`](LICENSE).
