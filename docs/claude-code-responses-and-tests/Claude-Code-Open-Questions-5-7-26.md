**Open clarifications before I'd start coding (none are blocking — answer or wave through):**

1. **Working directory.** This session is in claude-code-superuser-pack, not \~/Code/sw-mcp-intent-engineering/. Phase 0 didn't need the new repo, but Phase 1 does — npm init etc. must run there. Recommended: when you approve, you launch a fresh Claude Code session in \~/Code/sw-mcp-intent-engineering/ and paste the build prompt there. I can't cd between repos cleanly, and committing scaffolding into this repo would be wrong.  
2. **docs/v0-scope.md.** Scope-lock §0 says it gets moved to the new repo on creation. Should the Phase 1 commit also include docs/v0-scope.md and docs/CLAUDE-CODE-BRIEF.md? I'd recommend yes — Decision 1 of the unified roadmap explicitly closes when v0-scope.md is committed there. Default plan: yes, include both in the Phase 1 commit unless you say otherwise.  
3. **npm scope.** Plan is to verify @swinslow availability via npm publish \--dry-run in Phase 1 (no actual publish). If taken, fall back to @swins. Confirm that fallback is still acceptable before Day 1, or want me to check npm view @swinslow availability first thing in Phase 1?

**STOPPING.** Awaiting your "approved — proceed with Phase 1" (or change requests).

