# EXPLANATION.md

A 4Q comprehension artifact for the `intent-engineering` MCP server. The 4Q framework (Nate B. Jones) is the explanation artifact in the generative era. It is the equivalent of a commit message in traditional software, optimized for "does this person understand what they shipped?" instead of "did the bytes change?".

---

## What is this?

An MCP server that exposes three tools over the standard Model Context Protocol: `audit_intent_spec`, `generate_intent_spec_scaffold`, and `assess_retrofit_level`. Any MCP-aware client (Claude Desktop, Cursor, Anti-Gravity) can call them to review, scaffold, or triage agent intent specs against a 9-section unified template.

The template, the 25-item validation checklist, the 5 fatal anti-patterns, and the 4 autonomy levels all come from the `intent-engineering` skill in my personal Claude Code Superuser Pack. The MCP server reinvents none of it. It is a thin protocol adapter that lets the skill's logic reach any agent harness, not just the one that ships it.

---

## Why this approach?

**Why MCP, and not something else.** Three alternatives I considered and rejected:

- **A REST API.** Rejected because no agent harness reads OpenAPI specs natively at agent-call time. You'd write a per-harness client wrapper for Claude Desktop, another for Cursor, another for Anti-Gravity. MCP is the protocol every serious agent client now speaks; one server, every client.
- **A CLI.** Rejected because CLIs aren't tool-shaped from an agent's perspective. An agent can shell out, but it doesn't get structured input schemas, validation, or paginated output. The audit's `next_chunk_token` pattern would be ugly in a CLI; it's native in MCP.
- **A slash command inside one harness.** Rejected because it locks you to one client. Slash commands are great for personal workflows; they're a dead end for distribution.

**Why exactly three tools.** Each tool maps to one mode of the underlying skill: review, write, retrofit. Adding a fourth (`compare_approaches`, say) would either duplicate logic the model can already do in chat, or extend the surface before it's stable. The Gemini DR Max research report on MCP production patterns flagged "more than 4 tools" as a smell in v0 servers; three is intentional.

**Why Stdio transport.** Two reasons. First, v0 is a local-only Claude Desktop demo, so there is no infrastructure to host. Second, Streamable HTTP and SSE both add deployment complexity (auth, transport-state lifecycle, network surface) that buys nothing for a personal-laptop use case. Stdio is the right primitive for "the agent client spawns my server as a subprocess." Both production-pattern research reports converged on Stdio for v0.

**Why TypeScript and `@modelcontextprotocol/sdk@1.29.0`.** TypeScript because the MCP TypeScript SDK has the deepest client coverage and the cleanest Zod schema integration. Version `1.29.0` because the v2 line is pre-alpha on the SDK's `main` branch, and pinning to the stable v1.x line is the only defensible v0 choice. Treating SDK versioning as a live decision rather than a default is the kind of thing that bites people six months later.

**Why domain-verified registry namespace (`com.seanwinslow/intent-engineering`).** The MCP registry accepts two namespace forms: `io.github.<username>/<package>` or `<reversed-domain>/<package>` with DNS TXT verification. I went with the domain-verified form because (a) my GitHub handle ends in a number for legacy reasons, and the domain-verified namespace reads cleaner, and (b) DNS verification is a stronger trust signal than "this GitHub user controls this username." Worth doing once, even for a personal artifact.

---

## What would break?

These are live, knowingly accepted risks, not fixed defects. Two of the three boundaries this section first named have since been worked on, so what follows is what is still true today, plus the residue each fix left behind. Where a boundary closed, it says so.

**1. The alias table is a judgment about intent, and it can be wrong in both directions.** This section used to say the audit expected `## Objective` and `## Desired Outcomes` as literal headings, and that four of five real SKILL.md files scored `1/25` because none of their sections were recognized. **That false negative is fixed.** A1 (2026-06-17) added a conservative alias table to `src/intent/parser.ts` mapping equivalent headings onto the canonical nine, canonical entries matching first so the dogfood audit was unaffected, and the audit now says in its per-section notes when it recognized a heading from an alias.

What replaces it is a subtler risk. Every alias in that table is a claim that two headings mean the same thing, and the table is now load-bearing for scoring. Add a wrong one and the audit credits a section that isn't really there, which is worse than the false negative it fixed: an invented passing score on a tool whose whole job is catching invented claims. Guarding against that is why procedural headings (`## How to Apply`, `## Instructions`, `## Usage`, `## Examples`) are deliberately left unmapped, which is itself an accepted false negative in the other direction. A spec that genuinely states its objective under `## How to Apply` still scores low. I take the conservative error on purpose, and the table grows only on evidence.

**2. The skill and the TS constants can still drift apart.** The checklist and tool descriptions live in two places: as TS constants in `src/intent/*`, and as canonical markdown in the underlying skill. A2 (2026-06-17) added a snapshot tripwire in `src/intent/checklist.test.ts` that freezes the 25 checklist ids and the anti-pattern ids, so an accidental edit fails CI loudly instead of drifting quietly.

**That narrows the risk without closing it.** The tripwire compares the constants against a frozen copy of *themselves*. Nothing in this repository reads the skill. If the skill grows a twenty-sixth check tomorrow, every test still passes and the server keeps grading against a rubric that no longer matches its own source of truth. The discipline is still "change both in the same commit, log it in `CHANGELOG.md`". That is a habit, not a mechanism. It has been exercised once already, when the validation count was corrected from 40 to 25 mid-build. A generated-from-skill build step is the real fix and is not built.

**3. There is still no whole-file audit.** `audit_intent_spec` paginates, reading `max_length` characters per call (default 10,000). Grading a long document means walking every chunk and aggregating by hand, and **a chunk that omits a section is not evidence the section is absent.** A3 (2026-06-17) added a regression test pinning the behavior when a heading straddles a chunk boundary, so it is documented and tested. Tested is not the same as safe.

This section originally called the worst case "a per-chunk section showing as `missing` and the LLM aggregating across calls." That understated it. The real worst case is a chunk score published as a file score, and it is this project's own headline number that it happened to. See the next section, and the README's [correction](../README.md#dogfood-result-and-the-correction-that-came-with-it). The risk stands unchanged until `--whole-file` aggregation ships. `assess_retrofit_level` carries none of this: it reads whole files and refuses anything over 1 MiB loudly, so a batch grade cannot repeat the mistake.

**4. Clients that cannot pass file paths degrade to `spec_text`.** Web-only chat surfaces and sandboxed environments fall back silently, so the same audit run in two harnesses can have different ergonomics. This one is by design. The XOR validation between `spec_text` and `file_path` makes the degradation explicit rather than hidden, and it is a tradeoff I would take again.

---

## What did I learn?

Two things, in increasing order of how often they'll come up in interviews.

**The first is procedural.** MCP is essentially a contract for "I am a tool an agent harness can call without me writing a wrapper for each harness." Once that landed, the server became almost embarrassingly simple. `src/index.ts` registers three tools and connects an Stdio transport, and that is the entire protocol surface. The interesting code lives in `src/intent/*` (parser, checklist, anti-patterns, retrofit heuristics), which is just normal TypeScript with no protocol awareness. The OPTIONAL field pattern translated cleanly from the underlying skill: `file_path` and `spec_text` are both optional, with a XOR `.refine()` keeping them mutually exclusive. That kept the tools resilient to clients that can pass file paths and clients that can't.

**The second is conceptual, and it needed a correction four months later.** I audited my own canonical `intent-engineering` SKILL.md with the very server it ships, and reported `23/25` with zero anti-patterns. **That number was one paginated chunk presented as the whole file's grade.** Re-measured 2026-08-28 with default settings, the same file returns `14/25` with two anti-patterns; the file as it stood in May returns `17/25` with one. The audit reads 10,000 characters per call and the skill is about 32,000, so no single call ever saw all of it. The full correction is in the README's [Dogfood result](../README.md#dogfood-result-and-the-correction-that-came-with-it) section.

The underlying point survives the correction, and is worth separating from the number: the skill was written months before the server existed and still parses as a mostly well-formed intent spec without retrofitting. That was the actual claim. Dressing it in a score I had not measured properly is what went wrong, and it is a cleaner example of the intent-versus-instruction gap than the original paragraph was.

The lesson isn't "I'm great at writing specs." The lesson is that **intent** is more durable than instructions. The skill was written months before the MCP server existed, against a template I refined while researching production-agent failures (Klarna's intent gap, and the activity-versus-outcome confusion that surfaces across most of the SKILL.md files I have audited: 4 of the 5 skills I ran the audit against during Phase 3 hit `vibe-coded-edge-cases` and `missing-stop-rules`). When I built the server I did not need to retrofit the skill to make the tool work. The spec was already shaped right. That's the real argument for intent-engineering as a discipline: write the intent once, well, and the artifacts that consume it (tools, evaluators, runbooks) stay aligned without per-artifact rework.

The corollary, and the thing I'll be talking about most in interviews: when an agent fails in production, the post-mortem usually points at the model or the prompt. It almost never points at the intent, because nobody wrote the intent down. Klarna's high-profile support-agent rollback was a missing health-metric problem, not a missing-capability problem. Building a tool that surfaces those gaps before the agent ships is more useful than a smarter model. That's the bet.

A third learning, about working with agents instead of in spite of them. I asked Claude Code to audit all 118 first-party skills in my Superuser Pack. The handoff prompt asked it to do one specific pre-batch check — grep the three previously-Block-tagged skill bodies for residue from a prior sanitization pass. Claude Code did that check, found those three clean, then ran the same grep pack-wide on its own initiative before committing the CSV. It found residue in eight other skills my original audit had missed (The Block in skill bodies, Campus references in a sibling skill, Simon in one prompt example) and patched them with minimal targeted edits before the CSV could ship publicly. My instruction was "audit three files." The intent, what I actually wanted, was "don't ship me a regrettable artifact." The agent honored the intent. That gap between instruction and intent is the entire reason this server exists.
