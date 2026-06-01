# Security

This document describes the threat model for `@swins/intent-engineering-mcp`,
the defenses applied in v0.1.1, the defenses deliberately deferred (and why),
the known limitations, and references. It is scoped to the actual attack
surface of this server — a local **stdio** MCP server with three read-and-analyze
tools — not to a generic MCP-security checklist.

## 1. Threat model

The server exposes three tools (`audit_intent_spec`, `assess_retrofit_level`,
`generate_intent_spec_scaffold`). Two of them accept a `file_path` and read it
from disk; all three accept text. The MCP **trust boundary** matters here: in
the MCP architecture the *client* (the host application driving the model) is
trusted to connect, and the server runs with the privileges of the user who
launched it. We do **not** treat the client as an attacker. The risk is what
flows *through* the trusted client: tool arguments that originate from an
untrusted source — a pasted document, a web page, a retrieved file — and that an
upstream model may have been manipulated into producing.

**Actors.** (1) A *prompt-injected upstream model* — content the model ingested
tells it to call `audit_intent_spec({file_path: "/etc/passwd"})` and exfiltrate
the result. (2) A *malicious or buggy MCP client* that sends malformed or
over-broad tool arguments. (3) A *local operator* who later needs to audit what
the server actually did.

**Vectors.** **(LEAD) Arbitrary file read via `file_path`.** This is the primary
threat and the reason for this release. Before v0.1.1, the file-reading tools
called `fs.stat()` + `fs.readFile()` on the raw `file_path` with no extension
allowlist, no size cap, and no root confinement — and `fs.stat` *follows
symlinks*. So `audit_intent_spec({file_path: "/etc/passwd"})`, or a `.md`
symlink pointing at `~/.ssh/id_rsa`, would return file contents straight to the
model. That is an arbitrary-read / file-disclosure primitive. **(2)** Unbounded
or unexpected input — oversized payloads, or extra/unknown keys smuggled into a
tool call to probe for loose parsing. **(3)** No record of what was read, so a
disclosure attempt would leave no trace.

## 2. Defenses applied (v0.1.1)

- **`loadFileSafely` (the safe-fs guard, `src/intent/safe-fs.ts`).** A single
  chokepoint for every disk read. It: resolves to an absolute path; enforces an
  **extension allowlist** (`.md`, `.markdown`, `.yaml`, `.yml`, `.txt`);
  resolves symlinks with `fs.realpath` and re-checks the *real* target;
  optionally confines reads to `INTENT_ENGINEERING_ALLOWED_ROOT` (prefix check on
  the resolved real path, with a `..`-escape guard); rejects anything that isn't
  a **regular file**; and rejects files over **1 MiB**. Failures throw typed
  errors (`DisallowedExtensionError`, `OutsideRootError`, `NotARegularFileError`,
  `FileTooLargeError`). Both file-reading tools now route through it; there are no
  other `fs.readFile` call sites in `src/`.
- **`.strict()` schemas.** The three Zod input schemas reject unknown keys, so a
  client cannot smuggle unexpected fields past validation. The existing
  exactly-one-of (`spec_text` XOR `file_path`) refinements are retained.
- **Verified length bounds.** `spec_text` and `skill_text` remain bounded
  `min(50/100).max(50_000)`; file reads are capped at 1 MiB by the guard above.
- **Append-only audit log (`src/intent/audit-log.ts`).** Each invocation writes
  one JSON line to `~/.intent-engineering-mcp/audit.jsonl` recording the tool,
  input source, `file_path` (if any), input length, and outcome
  (`ok` / `error` / `rejected`) with a reject reason. It is **fail-open**: a
  logging failure never propagates into the tool path. Disable with
  `INTENT_ENGINEERING_AUDIT_LOG=0`.

## 3. Defenses deferred — and why

These are common MCP-hardening items that **do not map to this server's
surface**. Listing them is scope-to-surface reasoning, not a backlog.

- **OAuth 2.1 / PKCE authorization.** The MCP auth spec targets HTTP/SSE
  transports. This server is **stdio-only**: there is no network listener and no
  remote caller to authenticate. Adding OAuth would secure a door that does not
  exist.
- **Process sandboxing / seccomp.** Sandboxing contains untrusted *code
  execution*. This server has **no exec path** — no `child_process`, no `eval`,
  no shelling out. Its only side effect is reading allowlisted text files, which
  the safe-fs guard already constrains.
- **Output URL / content filtering.** Tools that echo fetched external content
  can become exfiltration channels. This server **echoes no external content**:
  outputs are computed analysis (scores, findings, templates) over the supplied
  input. There is no untrusted HTML/URL surface to filter.

## 4. Known limitations

- **Trusted client assumption.** A fully compromised client running as the user
  can still call tools within policy; we constrain *what* a call can read, not
  *whether* a trusted client may call.
- **Plaintext local log.** `audit.jsonl` is unencrypted and world-readable per
  the user's umask; it may record attempted `file_path` values. It is an
  operator aid, not a tamper-proof audit trail.
- **No rate limiting.** Nothing throttles repeated calls; a busy client could
  spin the tools (bounded by the 1 MiB read cap, but unthrottled).
- **Opt-in root confinement.** `INTENT_ENGINEERING_ALLOWED_ROOT` is unset by
  default, so the default posture allows any *allowlisted-extension, regular,
  ≤1 MiB* file. Operators handling sensitive hosts should set a root.

## 5. References

- **CVE-2025-32711 ("EchoLeak")** — a zero-click prompt-injection /
  data-exfiltration flaw in **Microsoft 365 Copilot**, reported by **Aim Labs**.
  Cited here purely as an *analogy* for how untrusted content flowing through a
  trusted assistant becomes an exfiltration vector. It is **not** an Anthropic or
  MCP vulnerability and is not attributed to either.
- **Model Context Protocol security guidance** —
  <https://modelcontextprotocol.io> (security best practices and the
  authorization specification).
- **MCP 2026 security roadmap** — the protocol's evolving guidance on
  transport authorization, tool trust, and client/server boundaries; tracked
  upstream at <https://modelcontextprotocol.io>.
